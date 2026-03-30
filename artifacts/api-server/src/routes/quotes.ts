import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { quotesTable, listingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function formatQuote(q: typeof quotesTable.$inferSelect) {
  return {
    ...q,
    subtotal: parseFloat(q.subtotal ?? "0"),
    discount: parseFloat(q.discount ?? "0"),
    totalPrice: parseFloat(q.totalPrice ?? "0"),
    items: Array.isArray(q.items) ? q.items : [],
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

router.get("/quotes", async (req, res) => {
  try {
    const where = req.tenantId ? eq(quotesTable.tenantId, req.tenantId) : undefined;
    const quotes = await db.select().from(quotesTable).where(where).orderBy(quotesTable.createdAt);
    res.json(quotes.map(formatQuote));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch quotes" });
  }
});

router.post("/quotes", async (req, res) => {
  try {
    const body = req.body;

    // Enrich items with listing titles
    const enrichedItems = await Promise.all(
      (body.items ?? []).map(async (item: any) => {
        const [listing] = await db.select({ title: listingsTable.title }).from(listingsTable).where(eq(listingsTable.id, item.listingId));
        const subtotal = item.pricePerDay * item.days * item.quantity;
        return {
          listingId: item.listingId,
          listingTitle: listing?.title ?? "Unknown",
          quantity: item.quantity,
          pricePerDay: item.pricePerDay,
          days: item.days,
          subtotal,
        };
      })
    );

    const subtotal = enrichedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const discount = body.discount ?? 0;
    const totalPrice = Math.max(0, subtotal - discount);

    const [created] = await db.insert(quotesTable).values({
      tenantId: req.tenantId ?? null,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone ?? null,
      items: enrichedItems,
      startDate: body.startDate,
      endDate: body.endDate,
      subtotal: String(subtotal),
      discount: String(discount),
      totalPrice: String(totalPrice),
      status: "draft",
      notes: body.notes ?? null,
      validUntil: body.validUntil ?? null,
    }).returning();

    res.status(201).json(formatQuote(created));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create quote" });
  }
});

router.put("/quotes/:id", async (req, res) => {
  try {
    const body = req.body;
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (body.status) updateData.status = body.status;
    if (body.discount !== undefined) {
      updateData.discount = String(body.discount);
      // Recalculate total
      const [existing] = await db.select().from(quotesTable).where(eq(quotesTable.id, Number(req.params.id)));
      if (existing) {
        updateData.totalPrice = String(Math.max(0, parseFloat(existing.subtotal) - body.discount));
      }
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.validUntil !== undefined) updateData.validUntil = body.validUntil;

    const [updated] = await db
      .update(quotesTable)
      .set(updateData)
      .where(eq(quotesTable.id, Number(req.params.id)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatQuote(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update quote" });
  }
});

export default router;
