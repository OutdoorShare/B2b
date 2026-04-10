import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { quotesTable, listingsTable, businessProfileTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { sendQuoteEmail, withBrand, withSmtpCreds } from "../services/gmail";
import { getTenantSmtpCreds, getTenantBrand } from "../services/smtp-helper";

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

    // Enrich items with listing titles — only from this tenant's listings
    const enrichedItems = await Promise.all(
      (body.items ?? []).map(async (item: any) => {
        const listingConditions = [eq(listingsTable.id, item.listingId)];
        if (req.tenantId) listingConditions.push(eq(listingsTable.tenantId, req.tenantId));
        const [listing] = await db.select({ title: listingsTable.title }).from(listingsTable).where(and(...listingConditions));
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
      const conditions = [eq(quotesTable.id, Number(req.params.id))];
      if (req.tenantId) conditions.push(eq(quotesTable.tenantId, req.tenantId));
      const [existing] = await db.select().from(quotesTable).where(and(...conditions));
      if (existing) {
        updateData.totalPrice = String(Math.max(0, parseFloat(existing.subtotal) - body.discount));
      }
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.validUntil !== undefined) updateData.validUntil = body.validUntil;

    const whereConditions = [eq(quotesTable.id, Number(req.params.id))];
    if (req.tenantId) whereConditions.push(eq(quotesTable.tenantId, req.tenantId));
    const [updated] = await db
      .update(quotesTable)
      .set(updateData)
      .where(and(...whereConditions))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatQuote(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update quote" });
  }
});

router.post("/quotes/:id/send", async (req, res) => {
  try {
    const conditions = [eq(quotesTable.id, Number(req.params.id))];
    if (req.tenantId) conditions.push(eq(quotesTable.tenantId, req.tenantId));
    const [quote] = await db.select().from(quotesTable).where(and(...conditions));
    if (!quote) { res.status(404).json({ error: "Not found" }); return; }

    // Fetch business profile for company name + contact email
    const [profileRow] = quote.tenantId
      ? await db
          .select({ name: businessProfileTable.name, email: businessProfileTable.email, outboundEmail: businessProfileTable.outboundEmail })
          .from(businessProfileTable)
          .where(eq(businessProfileTable.tenantId, quote.tenantId))
      : [];

    const companyName = profileRow?.name ?? "Your Rental Company";
    const companyEmail = profileRow?.outboundEmail ?? profileRow?.email ?? null;

    const [smtpCreds, brand] = await Promise.all([
      getTenantSmtpCreds(quote.tenantId),
      getTenantBrand(quote.tenantId),
    ]);

    const items = (Array.isArray(quote.items) ? quote.items : []) as any[];
    await withBrand(brand, () =>
      withSmtpCreds(smtpCreds, () =>
        sendQuoteEmail({
          toEmail: quote.customerEmail,
          customerName: quote.customerName,
          quoteId: quote.id,
          companyName,
          companyEmail,
          startDate: quote.startDate,
          endDate: quote.endDate,
          items: items.map((item: any) => ({
            listingTitle: item.listingTitle ?? "Item",
            quantity: Number(item.quantity ?? 1),
            pricePerDay: Number(item.pricePerDay ?? 0),
            days: Number(item.days ?? 1),
            subtotal: Number(item.subtotal ?? 0),
          })),
          subtotal: parseFloat(quote.subtotal ?? "0"),
          discount: parseFloat(quote.discount ?? "0"),
          totalPrice: parseFloat(quote.totalPrice ?? "0"),
          notes: quote.notes,
          validUntil: quote.validUntil,
        })
      )
    );

    const [updated] = await db
      .update(quotesTable)
      .set({ status: "sent", updatedAt: new Date() })
      .where(and(...conditions))
      .returning();

    res.json(formatQuote(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to send quote" });
  }
});

export default router;
