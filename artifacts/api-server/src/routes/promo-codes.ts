import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { promoCodesTable, tenantsTable } from "@workspace/db/schema";
import { eq, and, or, isNull, gt, sql } from "drizzle-orm";
import type { Request } from "express";

const router: IRouter = Router();

function requireAdminAuth(req: Request, res: any, next: any) {
  if (!req.tenantId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

// ── Admin: List promo codes ───────────────────────────────────────────────────
router.get("/promo-codes", requireAdminAuth, async (req, res) => {
  try {
    const codes = await db
      .select()
      .from(promoCodesTable)
      .where(eq(promoCodesTable.tenantId, req.tenantId!))
      .orderBy(promoCodesTable.createdAt);
    res.json(codes);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Create promo code ──────────────────────────────────────────────────
router.post("/promo-codes", requireAdminAuth, async (req, res) => {
  try {
    const { code, discountType, discountValue, maxUses, minBookingAmount, expiresAt, isActive } = req.body;
    if (!code || !discountType || discountValue == null) {
      res.status(400).json({ error: "code, discountType, and discountValue are required" });
      return;
    }
    if (!["percent", "fixed"].includes(discountType)) {
      res.status(400).json({ error: "discountType must be 'percent' or 'fixed'" });
      return;
    }
    if (discountType === "percent" && (Number(discountValue) <= 0 || Number(discountValue) > 100)) {
      res.status(400).json({ error: "Percent discount must be between 1 and 100" });
      return;
    }
    if (discountType === "fixed" && Number(discountValue) <= 0) {
      res.status(400).json({ error: "Fixed discount must be greater than 0" });
      return;
    }

    const upperCode = String(code).toUpperCase().trim().replace(/\s+/g, "");

    // Check uniqueness per tenant
    const existing = await db
      .select()
      .from(promoCodesTable)
      .where(and(eq(promoCodesTable.tenantId, req.tenantId!), eq(promoCodesTable.code, upperCode)));
    if (existing.length > 0) {
      res.status(409).json({ error: "A promo code with this name already exists" });
      return;
    }

    const [created] = await db.insert(promoCodesTable).values({
      tenantId: req.tenantId!,
      code: upperCode,
      discountType: discountType as "percent" | "fixed",
      discountValue: String(discountValue),
      maxUses: maxUses ? Number(maxUses) : null,
      minBookingAmount: minBookingAmount ? String(minBookingAmount) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: isActive !== false,
    }).returning();

    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "23505" || e.message?.includes("promo_codes_tenant_code_unique")) {
      res.status(409).json({ error: "A promo code with this name already exists" });
      return;
    }
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Update promo code ──────────────────────────────────────────────────
router.put("/promo-codes/:id", requireAdminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { discountType, discountValue, maxUses, minBookingAmount, expiresAt, isActive } = req.body;

    const [existing] = await db
      .select()
      .from(promoCodesTable)
      .where(and(eq(promoCodesTable.id, id), eq(promoCodesTable.tenantId, req.tenantId!)));
    if (!existing) {
      res.status(404).json({ error: "Promo code not found" });
      return;
    }

    const [updated] = await db.update(promoCodesTable).set({
      discountType: discountType ?? existing.discountType,
      discountValue: discountValue != null ? String(discountValue) : existing.discountValue,
      maxUses: maxUses !== undefined ? (maxUses ? Number(maxUses) : null) : existing.maxUses,
      minBookingAmount: minBookingAmount !== undefined ? (minBookingAmount ? String(minBookingAmount) : null) : existing.minBookingAmount,
      expiresAt: expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : existing.expiresAt,
      isActive: isActive !== undefined ? isActive : existing.isActive,
      updatedAt: new Date(),
    }).where(eq(promoCodesTable.id, id)).returning();

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Delete promo code ──────────────────────────────────────────────────
router.delete("/promo-codes/:id", requireAdminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db
      .select()
      .from(promoCodesTable)
      .where(and(eq(promoCodesTable.id, id), eq(promoCodesTable.tenantId, req.tenantId!)));
    if (!existing) {
      res.status(404).json({ error: "Promo code not found" });
      return;
    }
    await db.delete(promoCodesTable).where(eq(promoCodesTable.id, id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Public: Check if tenant has any usable promo codes ───────────────────────
// GET /api/promo-codes/has-active?tenantSlug=demo-outdoorshare
router.get("/promo-codes/has-active", async (req, res) => {
  try {
    const { tenantSlug } = req.query as { tenantSlug?: string };
    if (!tenantSlug) {
      res.status(400).json({ hasActive: false, error: "tenantSlug is required" });
      return;
    }
    const [tenant] = await db.select({ id: tenantsTable.id }).from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
    if (!tenant) {
      res.json({ hasActive: false });
      return;
    }
    const now = new Date();
    const codes = await db
      .select({ id: promoCodesTable.id })
      .from(promoCodesTable)
      .where(
        and(
          eq(promoCodesTable.tenantId, tenant.id),
          eq(promoCodesTable.isActive, true),
          or(isNull(promoCodesTable.expiresAt), gt(promoCodesTable.expiresAt, now)),
          or(
            isNull(promoCodesTable.maxUses),
            sql`${promoCodesTable.usesCount} < ${promoCodesTable.maxUses}`
          )
        )
      )
      .limit(1);
    res.json({ hasActive: codes.length > 0 });
  } catch (e: any) {
    res.status(500).json({ hasActive: false, error: e.message });
  }
});

// ── Public: Validate a promo code ─────────────────────────────────────────────
// POST /api/promo-codes/validate { code, tenantSlug, bookingAmountCents }
router.post("/promo-codes/validate", async (req, res) => {
  try {
    const { code, tenantSlug, bookingAmountCents } = req.body;
    if (!code || !tenantSlug) {
      res.status(400).json({ valid: false, error: "code and tenantSlug are required" });
      return;
    }

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
    if (!tenant) {
      res.status(404).json({ valid: false, error: "Tenant not found" });
      return;
    }

    const upperCode = String(code).toUpperCase().trim();
    const [promo] = await db
      .select()
      .from(promoCodesTable)
      .where(and(eq(promoCodesTable.tenantId, tenant.id), eq(promoCodesTable.code, upperCode)));

    if (!promo) {
      res.json({ valid: false, error: "Invalid promo code" });
      return;
    }
    if (!promo.isActive) {
      res.json({ valid: false, error: "This promo code is no longer active" });
      return;
    }
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      res.json({ valid: false, error: "This promo code has expired" });
      return;
    }
    if (promo.maxUses != null && promo.usesCount >= promo.maxUses) {
      res.json({ valid: false, error: "This promo code has reached its usage limit" });
      return;
    }

    const bookingAmount = bookingAmountCents ? Number(bookingAmountCents) / 100 : 0;
    if (promo.minBookingAmount && bookingAmount < parseFloat(promo.minBookingAmount)) {
      res.json({
        valid: false,
        error: `This code requires a minimum booking of $${parseFloat(promo.minBookingAmount).toFixed(2)}`,
      });
      return;
    }

    // Calculate discount amount in dollars
    const discountValue = parseFloat(promo.discountValue);
    let discountAmount: number;
    if (promo.discountType === "percent") {
      discountAmount = bookingAmount * (discountValue / 100);
    } else {
      discountAmount = discountValue;
    }
    discountAmount = Math.min(discountAmount, bookingAmount);

    res.json({
      valid: true,
      code: promo.code,
      discountType: promo.discountType,
      discountValue,
      discountAmount: Math.round(discountAmount * 100) / 100,
      description:
        promo.discountType === "percent"
          ? `${discountValue}% off`
          : `$${discountValue.toFixed(2)} off`,
    });
  } catch (e: any) {
    res.status(500).json({ valid: false, error: e.message });
  }
});

// ── Internal: Mark promo code used (called after booking confirmed) ────────────
router.post("/promo-codes/use", async (req, res) => {
  try {
    const { code, tenantSlug } = req.body;
    if (!code || !tenantSlug) { res.status(400).json({ error: "code and tenantSlug required" }); return; }
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    const upperCode = String(code).toUpperCase().trim();
    const [promo] = await db
      .select()
      .from(promoCodesTable)
      .where(and(eq(promoCodesTable.tenantId, tenant.id), eq(promoCodesTable.code, upperCode)));
    if (promo) {
      await db.update(promoCodesTable)
        .set({ usesCount: promo.usesCount + 1, updatedAt: new Date() })
        .where(eq(promoCodesTable.id, promo.id));
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
