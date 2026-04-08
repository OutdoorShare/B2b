import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { businessProfileTable, tenantsTable } from "@workspace/db/schema";
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

async function getTenantTrialInfo(tenantId: number | undefined) {
  const fallback = { plan: "starter" as const, trialEndsAt: null, trialActive: false, trialExpired: false, isBlocked: false, siteSlug: null as string | null, testMode: false };
  if (!tenantId) return fallback;
  const [tenant] = await db.select({
    plan: tenantsTable.plan,
    slug: tenantsTable.slug,
    trialEndsAt: tenantsTable.trialEndsAt,
    testMode: tenantsTable.testMode,
    subscriptionStatus: tenantsTable.subscriptionStatus,
  }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  if (!tenant) return fallback;
  const now = Date.now();
  const GRACE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in ms
  const trialMs = tenant.trialEndsAt ? tenant.trialEndsAt.getTime() : null;
  const subscriptionActive = ["active", "trialing"].includes(tenant.subscriptionStatus ?? "");
  const trialActive = trialMs !== null && trialMs > now && !subscriptionActive;
  const trialExpired = trialMs !== null && trialMs <= now && !subscriptionActive;
  // Only block the storefront after the 3-day grace period has passed
  const isBlocked = trialExpired && (now - (trialMs ?? 0)) > GRACE_MS;
  const graceEndsAt = trialMs !== null ? new Date(trialMs + GRACE_MS).toISOString() : null;
  return {
    plan: tenant.plan,
    siteSlug: tenant.slug,
    trialEndsAt: tenant.trialEndsAt ? tenant.trialEndsAt.toISOString() : null,
    trialActive,
    trialExpired,
    isBlocked,
    graceEndsAt,
    testMode: !!tenant.testMode,
  };
}

router.get("/business", async (req, res) => {
  if (!req.tenantId) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  try {
    const [profileWhere, trialInfo, tenantRow] = await Promise.all([
      db.select().from(businessProfileTable).where(eq(businessProfileTable.tenantId, req.tenantId)).limit(1),
      getTenantTrialInfo(req.tenantId),
      db.select({ platformFeePercent: tenantsTable.platformFeePercent }).from(tenantsTable).where(eq(tenantsTable.id, req.tenantId)).limit(1),
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
    const tenantFeePercent = tenantRow[0]?.platformFeePercent != null
      ? parseFloat(tenantRow[0].platformFeePercent)
      : PLATFORM_FEE_PERCENT * 100;
    res.json({
      ...pSafe,
      senderPasswordSet: !!p.senderPassword,
      depositPercent: parseFloat(p.depositPercent ?? "25"),
      bundleDiscountPercent: parseFloat(p.bundleDiscountPercent ?? "0"),
      platformFeePercent: tenantFeePercent,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      ...trialInfo,
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
      passPlatformFeePercent,
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
      ...(passPlatformFeePercent     !== undefined && { passPlatformFeePercent: passPlatformFeePercent !== null ? String(passPlatformFeePercent) : null }),
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

    // Re-fetch trial info with potentially new slug
    const trialInfo = await getTenantTrialInfo(req.tenantId);

    const p = updated;
    const { senderPassword: _sp3, ...pSafe3 } = p;
    res.json({
      ...pSafe3,
      senderPasswordSet: !!p.senderPassword,
      depositPercent: parseFloat(p.depositPercent ?? "25"),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      ...trialInfo,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update business profile" });
  }
});

export default router;
