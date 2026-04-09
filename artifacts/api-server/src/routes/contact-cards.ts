import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contactCardsTable, listingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAdminToken } from "../middleware/admin-auth";

const router: IRouter = Router();

// GET /api/contact-cards
router.get("/contact-cards", requireAdminToken as any, async (req, res) => {
  try {
    const cards = await db
      .select()
      .from(contactCardsTable)
      .where(eq(contactCardsTable.tenantId, req.tenantId))
      .orderBy(contactCardsTable.name);
    res.json(cards);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch contact cards" });
  }
});

// GET /api/contact-cards/:id
router.get("/contact-cards/:id", requireAdminToken as any, async (req, res) => {
  try {
    const [card] = await db
      .select()
      .from(contactCardsTable)
      .where(and(eq(contactCardsTable.id, Number(req.params.id)), eq(contactCardsTable.tenantId, req.tenantId)));
    if (!card) { res.status(404).json({ error: "Not found" }); return; }
    res.json(card);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch contact card" });
  }
});

// POST /api/contact-cards
router.post("/contact-cards", requireAdminToken as any, async (req, res) => {
  try {
    const { name, address, phone, email, specialInstructions, prepWhatToWear, prepWhatToBring, prepVehicleTowRating, prepAdditionalTips } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }
    const [card] = await db
      .insert(contactCardsTable)
      .values({
        tenantId: req.tenantId,
        name: name.trim(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        specialInstructions: specialInstructions?.trim() || null,
        prepWhatToWear: prepWhatToWear?.trim() || null,
        prepWhatToBring: prepWhatToBring?.trim() || null,
        prepVehicleTowRating: prepVehicleTowRating?.trim() || null,
        prepAdditionalTips: prepAdditionalTips?.trim() || null,
      })
      .returning();
    res.status(201).json(card);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create contact card" });
  }
});

// PUT /api/contact-cards/:id
router.put("/contact-cards/:id", requireAdminToken as any, async (req, res) => {
  try {
    const { name, address, phone, email, specialInstructions, prepWhatToWear, prepWhatToBring, prepVehicleTowRating, prepAdditionalTips } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }
    const [card] = await db
      .update(contactCardsTable)
      .set({
        name: name.trim(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        specialInstructions: specialInstructions?.trim() || null,
        prepWhatToWear: prepWhatToWear?.trim() || null,
        prepWhatToBring: prepWhatToBring?.trim() || null,
        prepVehicleTowRating: prepVehicleTowRating?.trim() || null,
        prepAdditionalTips: prepAdditionalTips?.trim() || null,
        updatedAt: new Date(),
      })
      .where(and(eq(contactCardsTable.id, Number(req.params.id)), eq(contactCardsTable.tenantId, req.tenantId)))
      .returning();
    if (!card) { res.status(404).json({ error: "Not found" }); return; }
    res.json(card);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update contact card" });
  }
});

// DELETE /api/contact-cards/:id
router.delete("/contact-cards/:id", requireAdminToken as any, async (req, res) => {
  try {
    const cardId = Number(req.params.id);
    // Unlink from listings first
    await db
      .update(listingsTable)
      .set({ contactCardId: null })
      .where(and(eq(listingsTable.contactCardId, cardId), eq(listingsTable.tenantId, req.tenantId)));
    const [deleted] = await db
      .delete(contactCardsTable)
      .where(and(eq(contactCardsTable.id, cardId), eq(contactCardsTable.tenantId, req.tenantId)))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete contact card" });
  }
});

export default router;
