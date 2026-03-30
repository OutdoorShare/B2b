import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { listingUnitsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

// GET /listings/:id/units
router.get("/listings/:id/units", async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    const units = await db
      .select()
      .from(listingUnitsTable)
      .where(eq(listingUnitsTable.listingId, listingId))
      .orderBy(listingUnitsTable.createdAt);
    res.json(units.map(u => ({ ...u, createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString() })));
  } catch {
    res.status(500).json({ error: "Failed to fetch units" });
  }
});

// POST /listings/:id/units
router.post("/listings/:id/units", async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    const { unitIdentifier, identifierType, label, notes } = req.body;
    if (!unitIdentifier) {
      res.status(400).json({ error: "unitIdentifier is required" });
      return;
    }
    const [unit] = await db.insert(listingUnitsTable).values({
      listingId,
      unitIdentifier: unitIdentifier.trim(),
      identifierType: identifierType ?? "serial",
      label: label ?? null,
      notes: notes ?? null,
    }).returning();
    res.status(201).json({ ...unit, createdAt: unit.createdAt.toISOString(), updatedAt: unit.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to create unit" });
  }
});

// PUT /listings/:listingId/units/:unitId
router.put("/listings/:listingId/units/:unitId", async (req, res) => {
  try {
    const listingId = parseInt(req.params.listingId);
    const unitId = parseInt(req.params.unitId);
    const { unitIdentifier, identifierType, label, status, notes } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (unitIdentifier !== undefined) updates.unitIdentifier = unitIdentifier.trim();
    if (identifierType !== undefined) updates.identifierType = identifierType;
    if (label !== undefined) updates.label = label || null;
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes || null;
    const [updated] = await db
      .update(listingUnitsTable)
      .set(updates)
      .where(and(eq(listingUnitsTable.id, unitId), eq(listingUnitsTable.listingId, listingId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Unit not found" }); return; }
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to update unit" });
  }
});

// DELETE /listings/:listingId/units/:unitId
router.delete("/listings/:listingId/units/:unitId", async (req, res) => {
  try {
    const listingId = parseInt(req.params.listingId);
    const unitId = parseInt(req.params.unitId);
    const [deleted] = await db
      .delete(listingUnitsTable)
      .where(and(eq(listingUnitsTable.id, unitId), eq(listingUnitsTable.listingId, listingId)))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Unit not found" }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete unit" });
  }
});

export default router;
