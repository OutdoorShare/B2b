import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { businessProfileTable, tenantsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

async function getTenantTrialInfo(tenantId: number | undefined) {
  if (!tenantId) return { plan: "starter" as const, trialEndsAt: null, trialActive: false, trialExpired: false };
  const [tenant] = await db.select({
    plan: tenantsTable.plan,
    trialEndsAt: tenantsTable.trialEndsAt,
  }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  if (!tenant) return { plan: "starter" as const, trialEndsAt: null, trialActive: false, trialExpired: false };
  const now = Date.now();
  const trialMs = tenant.trialEndsAt ? tenant.trialEndsAt.getTime() : null;
  const trialActive = tenant.plan === "starter" && trialMs !== null && trialMs > now;
  const trialExpired = tenant.plan === "starter" && trialMs !== null && trialMs <= now;
  return {
    plan: tenant.plan,
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
    const body = req.body;

    if (profiles.length === 0) {
      const [created] = await db.insert(businessProfileTable).values({
        ...body,
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
        depositPercent: String(body.depositPercent ?? "25"),
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
        ...body,
        depositPercent: body.depositPercent !== undefined ? String(body.depositPercent) : undefined,
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
