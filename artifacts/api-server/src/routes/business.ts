import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { businessProfileTable, tenantsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

async function getTenantTrialInfo(tenantId: number | undefined) {
  if (!tenantId) return { plan: "starter" as const, trialEndsAt: null, trialActive: false, trialExpired: false, siteSlug: null as string | null };
  const [tenant] = await db.select({
    plan: tenantsTable.plan,
    slug: tenantsTable.slug,
    trialEndsAt: tenantsTable.trialEndsAt,
  }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  if (!tenant) return { plan: "starter" as const, trialEndsAt: null, trialActive: false, trialExpired: false, siteSlug: null as string | null };
  const now = Date.now();
  const trialMs = tenant.trialEndsAt ? tenant.trialEndsAt.getTime() : null;
  const trialActive = tenant.plan === "starter" && trialMs !== null && trialMs > now;
  const trialExpired = tenant.plan === "starter" && trialMs !== null && trialMs <= now;
  return {
    plan: tenant.plan,
    siteSlug: tenant.slug,
    trialEndsAt: tenant.trialEndsAt ? tenant.trialEndsAt.toISOString() : null,
    trialActive,
    trialExpired,
  };
}

router.get("/business", async (req, res) => {
  try {
    const [profileWhere, trialInfo] = await Promise.all([
      req.tenantId
        ? db.select().from(businessProfileTable).where(eq(businessProfileTable.tenantId, req.tenantId)).limit(1)
        : db.select().from(businessProfileTable).limit(1),
      getTenantTrialInfo(req.tenantId),
    ]);

    let profiles = profileWhere;

    if (profiles.length === 0) {
      const [created] = await db.insert(businessProfileTable).values({
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      }).returning();
      profiles = [created];
    }

    const p = profiles[0];
    res.json({
      ...p,
      depositPercent: parseFloat(p.depositPercent ?? "25"),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      ...trialInfo,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch business profile" });
  }
});

router.put("/business", async (req, res) => {
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
      email, phone, website,
      location, address, city, state, zipCode, country,
      socialInstagram, socialFacebook, socialTwitter,
      depositRequired, depositPercent,
      cancellationPolicy, rentalTerms,
      kioskModeEnabled, embedCode,
    } = req.body;

    const safeBody = {
      ...(name               !== undefined && { name }),
      ...(tagline            !== undefined && { tagline }),
      ...(description        !== undefined && { description }),
      ...(logoUrl            !== undefined && { logoUrl }),
      ...(coverImageUrl      !== undefined && { coverImageUrl }),
      ...(primaryColor       !== undefined && { primaryColor }),
      ...(accentColor        !== undefined && { accentColor }),
      ...(email              !== undefined && { email }),
      ...(phone              !== undefined && { phone }),
      ...(website            !== undefined && { website }),
      ...(location           !== undefined && { location }),
      ...(address            !== undefined && { address }),
      ...(city               !== undefined && { city }),
      ...(state              !== undefined && { state }),
      ...(zipCode            !== undefined && { zipCode }),
      ...(country            !== undefined && { country }),
      ...(socialInstagram    !== undefined && { socialInstagram }),
      ...(socialFacebook     !== undefined && { socialFacebook }),
      ...(socialTwitter      !== undefined && { socialTwitter }),
      ...(depositRequired    !== undefined && { depositRequired }),
      ...(cancellationPolicy !== undefined && { cancellationPolicy }),
      ...(rentalTerms        !== undefined && { rentalTerms }),
      ...(kioskModeEnabled   !== undefined && { kioskModeEnabled }),
      ...(embedCode          !== undefined && { embedCode }),
      depositPercent: depositPercent !== undefined ? String(depositPercent) : undefined,
    };

    if (profiles.length === 0) {
      const [created] = await db.insert(businessProfileTable).values({
        ...safeBody,
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
        depositPercent: String(depositPercent ?? "25"),
        updatedAt: new Date(),
      }).returning();
      const p = created;
      res.json({
        ...p,
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

    const p = updated;
    res.json({
      ...p,
      depositPercent: parseFloat(p.depositPercent ?? "25"),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update business profile" });
  }
});

export default router;
