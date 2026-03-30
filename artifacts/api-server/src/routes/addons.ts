import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { listingAddonsTable } from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";

const router: IRouter = Router();

// GET all active addons for a listing
router.get("/listings/:id/addons", async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    const addons = await db
      .select()
      .from(listingAddonsTable)
      .where(eq(listingAddonsTable.listingId, listingId))
      .orderBy(asc(listingAddonsTable.sortOrder), asc(listingAddonsTable.createdAt));

    res.json(addons.map(a => ({
      ...a,
      price: parseFloat(a.price ?? "0"),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch addons" });
  }
});

// POST create an addon for a listing
router.post("/listings/:id/addons", async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    const { name, description, price, priceType, isRequired, isActive, sortOrder } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: "name and price are required" });
    }

    const [addon] = await db
      .insert(listingAddonsTable)
      .values({
        listingId,
        name,
        description: description || null,
        price: String(price),
        priceType: priceType || "flat",
        isRequired: isRequired ?? false,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    res.status(201).json({ ...addon, price: parseFloat(addon.price ?? "0") });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create addon" });
  }
});

// PUT update an addon
router.put("/listings/:id/addons/:addonId", async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    const addonId  = parseInt(req.params.addonId);
    const { name, description, price, priceType, isRequired, isActive, sortOrder } = req.body;

    const [updated] = await db
      .update(listingAddonsTable)
      .set({
        ...(name        !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price       !== undefined && { price: String(price) }),
        ...(priceType   !== undefined && { priceType }),
        ...(isRequired  !== undefined && { isRequired }),
        ...(isActive    !== undefined && { isActive }),
        ...(sortOrder   !== undefined && { sortOrder }),
      })
      .where(and(eq(listingAddonsTable.id, addonId), eq(listingAddonsTable.listingId, listingId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Addon not found" });
    res.json({ ...updated, price: parseFloat(updated.price ?? "0") });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update addon" });
  }
});

// DELETE an addon
router.delete("/listings/:id/addons/:addonId", async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    const addonId  = parseInt(req.params.addonId);

    await db
      .delete(listingAddonsTable)
      .where(and(eq(listingAddonsTable.id, addonId), eq(listingAddonsTable.listingId, listingId)));

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete addon" });
  }
});

export default router;
