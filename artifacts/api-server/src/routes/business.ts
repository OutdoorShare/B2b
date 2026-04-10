import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { businessProfileTable, tenantsTable, businessCustomFeesTable } from "@workspace/db/schema";
import { eq, ne, and } from "drizzle-orm";
import { PLATFORM_FEE_PERCENT } from "../services/stripe";
import { requireTenant } from "../middleware/admin-auth";
import { encrypt, isEncrypted } from "../lib/crypto";

const RESERVED_SLUGS = new Set(["admin", "superadmin", "get-started", "signup", "demo", "api"]);
// Slugs that must never be auto-rewritten by the name→slug sync (e.g. platform demo sites)
const SLUG_LOCK = new Set(["demo-outdoorshare"]);
// Design fields that are permanently pinned for slug-locked tenants (prevents accidental overwrites from admin UI)
const DESIGN_LOCKED_FIELDS = new Set(["name", "tagline", "description", "logoUrl", "coverImageUrl"]);

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

async function uniqueSlug(base: string, excludeTenantId: number): Promise<string> {
  let candidate = base;
  let counter = 1;
  while (true) {
    if (!RESERVED_SLUGS.has(candidate)) {
      const [existing] = await db.select({ id: tenantsTable.id })
        .from(tenantsTable)
        .where(and(eq(tenantsTable.slug, candidate), ne(tenantsTable.id, excludeTenantId)))
        .limit(1);
      if (!existing) return candidate;
    }
    candidate = `${base}-${counter++}`;
  }
}

const router: IRouter = Router();

async function getTenantInfo(tenantId: number | undefined) {
  const fallback = { plan: "starter" as const, isBlocked: false, siteSlug: null as string | null, testMode: false };
  if (!tenantId) return fallback;
  const [tenant] = await db.select({
    plan: tenantsTable.plan,
    slug: tenantsTable.slug,
    status: tenantsTable.status,
    testMode: tenantsTable.testMode,
  }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  if (!tenant) return fallback;
  return {
    plan: tenant.plan,
    siteSlug: tenant.slug,
    isBlocked: tenant.status === "suspended",
    testMode: !!tenant.testMode,
  };
}

router.get("/business", async (req, res) => {
  if (!req.tenantId) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  try {
    const [profileWhere, tenantInfo, tenantRow] = await Promise.all([
      db.select().from(businessProfileTable).where(eq(businessProfileTable.tenantId, req.tenantId)).limit(1),
      getTenantInfo(req.tenantId),
      db.select({ platformFeePercent: tenantsTable.platformFeePercent, plan: tenantsTable.plan }).from(tenantsTable).where(eq(tenantsTable.id, req.tenantId)).limit(1),
    ]);

    let profiles = profileWhere;

    if (profiles.length === 0) {
      const [created] = await db.insert(businessProfileTable).values({
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      }).returning();
      profiles = [created];
    }

    const p = profiles[0];
    const { senderPassword: _sp, ...pSafe } = p;
    // Expose the platform fee percent so the storefront can compute pass-through amounts.
    // Starter (Half Throttle) defaults to 10%; paid plans default to 5% when not explicitly set.
    const starterDefault = tenantRow[0]?.plan === "starter" ? 10 : PLATFORM_FEE_PERCENT * 100;
    const tenantFeePercent = tenantRow[0]?.platformFeePercent != null
      ? parseFloat(tenantRow[0].platformFeePercent)
      : starterDefault;
    res.json({
      ...pSafe,
      senderPasswordSet: !!p.senderPassword,
      depositPercent: parseFloat(p.depositPercent ?? "25"),
      bundleDiscountPercent: parseFloat(p.bundleDiscountPercent ?? "0"),
      platformFeePercent: tenantFeePercent,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      ...tenantInfo,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch business profile" });
  }
});

router.put("/business", requireTenant as any, async (req, res) => {
  try {
    const profiles = req.tenantId
      ? await db.select().from(businessProfileTable).where(eq(businessProfileTable.tenantId, req.tenantId)).limit(1)
      : await db.select().from(businessProfileTable).limit(1);

    // Strip derived / non-column fields that the GET response includes but the DB doesn't accept.
    // Pulling only explicit column names prevents Drizzle from choking on ISO-string timestamps,
    // trial info fields, plan, siteSlug, etc.
    const {
      name, tagline, description, logoUrl, coverImageUrl,
      primaryColor, accentColor,
      email, outboundEmail, senderEmail, senderPassword, phone, website,
      location, address, city, state, zipCode, country,
      socialInstagram, socialFacebook, socialTwitter,
      bundleDiscountPercent,
      depositRequired, depositPercent,
      cancellationPolicy, rentalTerms,
      kioskModeEnabled, instantBooking, embedCode,
      paymentPlanEnabled, paymentPlanDepositType,
      paymentPlanDepositFixed, paymentPlanDepositPercent,
      paymentPlanDaysBeforePickup,
      passPlatformFeeToCustomer,
      passPlatformFeeType,
      passPlatformFeePercent,
      passPlatformFeeFixed,
      protectionPlanOptional,
    } = req.body;

    // Require business address fields whenever they are submitted with content.
    // Empty strings ("") are treated as "not submitted" so branding/policies saves
    // that don't include address fields never trigger this validation.
    const addressFields = { address, city, state, zipCode };
    const addressPresent = Object.values(addressFields).some(
      v => v !== undefined && v !== null && String(v).trim() !== ""
    );
    if (addressPresent) {
      const missing = Object.entries(addressFields)
        .filter(([, v]) => !v || !String(v).trim())
        .map(([k]) => k);
      if (missing.length > 0) {
        return res.status(400).json({
          error: `Business address is incomplete. Missing: ${missing.join(", ")}.`,
        });
      }
    }

    const safeBody = {
      ...(name               !== undefined && { name }),
      ...(tagline            !== undefined && { tagline }),
      ...(description        !== undefined && { description }),
      ...(logoUrl            !== undefined && { logoUrl }),
      ...(coverImageUrl      !== undefined && { coverImageUrl }),
      ...(primaryColor       !== undefined && { primaryColor }),
      ...(accentColor        !== undefined && { accentColor }),
      ...(email              !== undefined && { email }),
      ...(outboundEmail      !== undefined && { outboundEmail }),
      ...(senderEmail        !== undefined && { senderEmail: senderEmail || null }),
      ...(senderPassword     !== undefined && senderPassword !== "" && {
        senderPassword: isEncrypted(senderPassword) ? senderPassword : encrypt(senderPassword)
      }),
      ...(senderPassword === "" && { senderPassword: null, senderEmail: null }),
      ...(phone              !== undefined && { phone }),
      ...(website            !== undefined && { website }),
      ...(location           !== undefined && { location }),
      ...(address            !== undefined && { address }),
      ...(city               !== undefined && { city }),
      ...(state              !== undefined && { state }),
      ...(zipCode            !== undefined && { zipCode }),
      ...(country            !== undefined && { country }),
      ...(socialInstagram       !== undefined && { socialInstagram }),
      ...(socialFacebook        !== undefined && { socialFacebook }),
      ...(socialTwitter         !== undefined && { socialTwitter }),
      ...(bundleDiscountPercent !== undefined && { bundleDiscountPercent: String(bundleDiscountPercent) }),
      ...(depositRequired       !== undefined && { depositRequired }),
      ...(cancellationPolicy !== undefined && { cancellationPolicy }),
      ...(rentalTerms        !== undefined && { rentalTerms }),
      ...(kioskModeEnabled   !== undefined && { kioskModeEnabled }),
      ...(instantBooking     !== undefined && { instantBooking }),
      ...(embedCode          !== undefined && { embedCode }),
      depositPercent: depositPercent !== undefined ? String(depositPercent) : undefined,
      ...(paymentPlanEnabled         !== undefined && { paymentPlanEnabled }),
      ...(paymentPlanDepositType     !== undefined && { paymentPlanDepositType }),
      ...(paymentPlanDepositFixed    !== undefined && { paymentPlanDepositFixed: String(paymentPlanDepositFixed) }),
      ...(paymentPlanDepositPercent  !== undefined && { paymentPlanDepositPercent: String(paymentPlanDepositPercent) }),
      ...(paymentPlanDaysBeforePickup !== undefined && { paymentPlanDaysBeforePickup: Number(paymentPlanDaysBeforePickup) }),
      ...(passPlatformFeeToCustomer  !== undefined && { passPlatformFeeToCustomer }),
      ...(passPlatformFeeType        !== undefined && { passPlatformFeeType }),
      ...(passPlatformFeePercent     !== undefined && { passPlatformFeePercent: passPlatformFeePercent !== null ? String(passPlatformFeePercent) : null }),
      ...(passPlatformFeeFixed       !== undefined && { passPlatformFeeFixed: passPlatformFeeFixed !== null ? String(passPlatformFeeFixed) : null }),
      ...(protectionPlanOptional     !== undefined && { protectionPlanOptional }),
    };

    // If this tenant is design-locked (e.g. the platform demo), strip design fields
    // so the admin UI cannot accidentally overwrite the pinned branding.
    if (req.tenantId) {
      const [cur] = await db.select({ slug: tenantsTable.slug }).from(tenantsTable).where(eq(tenantsTable.id, req.tenantId)).limit(1);
      if (cur && SLUG_LOCK.has(cur.slug)) {
        for (const field of DESIGN_LOCKED_FIELDS) delete (safeBody as Record<string, unknown>)[field];
      }
    }

    if (profiles.length === 0) {
      const [created] = await db.insert(businessProfileTable).values({
        ...safeBody,
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
        depositPercent: String(depositPercent ?? "25"),
        updatedAt: new Date(),
      }).returning();
      const p = created;
      const { senderPassword: _sp2, ...pSafe2 } = p;
      res.json({
        ...pSafe2,
        senderPasswordSet: !!p.senderPassword,
        depositPercent: parseFloat(p.depositPercent ?? "25"),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      });
      return;
    }

    const [updated] = await db
      .update(businessProfileTable)
      .set({
        ...safeBody,
        updatedAt: new Date(),
      })
      .where(eq(businessProfileTable.id, profiles[0].id))
      .returning();

    // Auto-sync tenant slug and name when the business name changes
    // (skipped for slug-locked tenants like the platform demo site)
    let newSlug: string | null = null;
    if (name !== undefined && req.tenantId) {
      const [cur] = await db.select({ slug: tenantsTable.slug }).from(tenantsTable).where(eq(tenantsTable.id, req.tenantId)).limit(1);
      if (cur && !SLUG_LOCK.has(cur.slug)) {
        const rawSlug = slugify(name);
        if (rawSlug) {
          newSlug = await uniqueSlug(rawSlug, req.tenantId);
          await db.update(tenantsTable)
            .set({ slug: newSlug, name, updatedAt: new Date() })
            .where(eq(tenantsTable.id, req.tenantId));
        }
      }
    }

    // Re-fetch tenant info with potentially new slug
    const tenantInfo = await getTenantInfo(req.tenantId);

    const p = updated;
    const { senderPassword: _sp3, ...pSafe3 } = p;
    res.json({
      ...pSafe3,
      senderPasswordSet: !!p.senderPassword,
      depositPercent: parseFloat(p.depositPercent ?? "25"),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      ...tenantInfo,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update business profile" });
  }
});

// ── Custom Fees ───────────────────────────────────────────────────────────────
// Company-defined mandatory fees that auto-apply to every booking.
// Platform rule: total custom fees > $100 on a booking → OutdoorShare takes 3%.
export const CUSTOM_FEE_THRESHOLD = 100;   // dollars
export const CUSTOM_FEE_PLATFORM_RATE = 0.03; // 3%

// Public: fetch active custom fees for a tenant (used in booking page)
router.get("/custom-fees", async (req, res) => {
  try {
    if (!req.tenantId) { res.status(404).json({ error: "Tenant not found" }); return; }
    const fees = await db.select()
      .from(businessCustomFeesTable)
      .where(and(eq(businessCustomFeesTable.tenantId, req.tenantId), eq(businessCustomFeesTable.isActive, true)));
    res.json(fees);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch custom fees" });
  }
});

// Admin: create a new custom fee
router.post("/custom-fees", requireTenant, async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { name, amount, priceType } = req.body ?? {};
    if (!name || !amount) { res.status(400).json({ error: "name and amount required" }); return; }
    const [fee] = await db.insert(businessCustomFeesTable).values({
      tenantId: req.tenantId,
      name: String(name).trim(),
      amount: String(parseFloat(amount).toFixed(2)),
      priceType: priceType === "per_day" ? "per_day" : "flat",
      isActive: true,
    }).returning();
    res.json(fee);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create custom fee" });
  }
});

// Admin: update a custom fee
router.put("/custom-fees/:id", requireTenant, async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const feeId = parseInt(req.params.id, 10);
    const { name, amount, priceType, isActive } = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = String(name).trim();
    if (amount !== undefined) update.amount = String(parseFloat(amount).toFixed(2));
    if (priceType !== undefined) update.priceType = priceType === "per_day" ? "per_day" : "flat";
    if (isActive !== undefined) update.isActive = !!isActive;
    const [updated] = await db.update(businessCustomFeesTable)
      .set(update)
      .where(and(eq(businessCustomFeesTable.id, feeId), eq(businessCustomFeesTable.tenantId, req.tenantId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Fee not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update custom fee" });
  }
});

// Admin: delete (soft-delete) a custom fee
router.delete("/custom-fees/:id", requireTenant, async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const feeId = parseInt(req.params.id, 10);
    await db.update(businessCustomFeesTable)
      .set({ isActive: false })
      .where(and(eq(businessCustomFeesTable.id, feeId), eq(businessCustomFeesTable.tenantId, req.tenantId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete custom fee" });
  }
});

export default router;
