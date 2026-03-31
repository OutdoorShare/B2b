import { Router } from "express";
import { db } from "../lib/db";
import { listingRulesTable } from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";

const router = Router();

// ── Public: get rules for a listing ───────────────────────────────────────────
router.get("/listings/:id/rules", async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    const rules = await db
      .select()
      .from(listingRulesTable)
      .where(eq(listingRulesTable.listingId, listingId))
      .orderBy(asc(listingRulesTable.sortOrder), asc(listingRulesTable.id));
    res.json(rules.map(r => ({ ...r, fee: parseFloat(r.fee) })));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch rules" });
  }
});

// ── Admin: create rule ─────────────────────────────────────────────────────────
router.post("/listing-rules", async (req, res) => {
  try {
    const { listingId, title, description, fee, sortOrder } = req.body;
    if (!listingId || !title) {
      res.status(400).json({ error: "listingId and title are required" }); return;
    }
    const [rule] = await db.insert(listingRulesTable).values({
      listingId: Number(listingId),
      tenantId: req.tenantId ?? null,
      title: title.trim(),
      description: description?.trim() || null,
      fee: String(parseFloat(fee ?? "0") || 0),
      sortOrder: Number(sortOrder ?? 0),
    }).returning();
    res.status(201).json({ ...rule, fee: parseFloat(rule.fee) });
  } catch (err) {
    res.status(500).json({ error: "Failed to create rule" });
  }
});

// ── Admin: update rule ─────────────────────────────────────────────────────────
router.put("/listing-rules/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, description, fee, sortOrder } = req.body;
    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (fee !== undefined) updates.fee = String(parseFloat(fee) || 0);
    if (sortOrder !== undefined) updates.sortOrder = Number(sortOrder);

    const conditions = [eq(listingRulesTable.id, id)];
    if (req.tenantId) conditions.push(eq(listingRulesTable.tenantId, req.tenantId));

    const [updated] = await db
      .update(listingRulesTable)
      .set(updates)
      .where(and(...conditions))
      .returning();

    if (!updated) { res.status(404).json({ error: "Rule not found" }); return; }
    res.json({ ...updated, fee: parseFloat(updated.fee) });
  } catch (err) {
    res.status(500).json({ error: "Failed to update rule" });
  }
});

// ── Admin: delete rule ─────────────────────────────────────────────────────────
router.delete("/listing-rules/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const conditions = [eq(listingRulesTable.id, id)];
    if (req.tenantId) conditions.push(eq(listingRulesTable.tenantId, req.tenantId));
    await db.delete(listingRulesTable).where(and(...conditions));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete rule" });
  }
});

export default router;
