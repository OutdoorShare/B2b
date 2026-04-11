import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { quotesTable, listingsTable, businessProfileTable, tenantsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { sendQuoteEmail, withBrand, withSmtpCreds } from "../services/gmail";
import { getTenantSmtpCreds, getTenantBrand } from "../services/smtp-helper";

const router: IRouter = Router();

async function enrichItems(rawItems: any[], tenantId: number | null): Promise<any[]> {
  return Promise.all(rawItems.map(async (item: any) => {
    if (item.type === "bundle") {
      const enrichedBundleItems = await Promise.all(
        (item.bundleItems ?? []).map(async (si: any) => {
          const conds = [eq(listingsTable.id, si.listingId)];
          if (tenantId) conds.push(eq(listingsTable.tenantId, tenantId));
          const [listing] = await db.select({ title: listingsTable.title }).from(listingsTable).where(and(...conds));
          return {
            listingId: si.listingId,
            listingTitle: listing?.title ?? "Unknown",
            quantity: si.quantity,
            pricePerDay: si.pricePerDay,
            days: si.days,
            subtotal: si.pricePerDay * si.days * si.quantity,
          };
        })
      );
      const itemsTotal = enrichedBundleItems.reduce((s, si) => s + si.subtotal, 0);
      const subtotal = (item.bundlePrice != null && item.bundlePrice > 0) ? item.bundlePrice : itemsTotal;
      return { type: "bundle", name: item.name, bundleItems: enrichedBundleItems, bundlePrice: item.bundlePrice ?? null, subtotal };
    }
    const conds = [eq(listingsTable.id, item.listingId)];
    if (tenantId) conds.push(eq(listingsTable.tenantId, tenantId));
    const [listing] = await db.select({ title: listingsTable.title }).from(listingsTable).where(and(...conds));
    return {
      listingId: item.listingId,
      listingTitle: listing?.title ?? "Unknown",
      quantity: item.quantity,
      pricePerDay: item.pricePerDay,
      days: item.days,
      subtotal: item.pricePerDay * item.days * item.quantity,
    };
  }));
}

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

router.get("/quotes/:id", async (req, res) => {
  try {
    const conditions = [eq(quotesTable.id, Number(req.params.id))];
    if (req.tenantId) conditions.push(eq(quotesTable.tenantId, req.tenantId));
    const [quote] = await db.select().from(quotesTable).where(and(...conditions));
    if (!quote) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatQuote(quote));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch quote" });
  }
});

// Public (no auth) — used for the customer-facing quote view link
router.get("/public/quotes/:id", async (req, res) => {
  try {
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, Number(req.params.id)));
    if (!quote) { res.status(404).json({ error: "Not found" }); return; }
    // Fetch company name for display
    const [profileRow] = quote.tenantId
      ? await db
          .select({ name: businessProfileTable.name, email: businessProfileTable.email, outboundEmail: businessProfileTable.outboundEmail })
          .from(businessProfileTable)
          .where(eq(businessProfileTable.tenantId, quote.tenantId))
      : [];
    res.json({
      ...formatQuote(quote),
      companyName: profileRow?.name ?? null,
      companyEmail: profileRow?.outboundEmail ?? profileRow?.email ?? null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch quote" });
  }
});

router.post("/quotes", async (req, res) => {
  try {
    const body = req.body;

    const enrichedItems = await enrichItems(body.items ?? [], req.tenantId ?? null);
    const subtotal = enrichedItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);
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
    const whereConditions = [eq(quotesTable.id, Number(req.params.id))];
    if (req.tenantId) whereConditions.push(eq(quotesTable.tenantId, req.tenantId));

    // Full edit: re-enrich items if provided
    if (body.items && Array.isArray(body.items)) {
      const enrichedItems = await enrichItems(body.items, req.tenantId ?? null);
      const subtotal = enrichedItems.reduce((sum: number, i: any) => sum + i.subtotal, 0);
      const discount = body.discount ?? 0;
      const totalPrice = Math.max(0, subtotal - discount);
      const [updated] = await db
        .update(quotesTable)
        .set({
          items: enrichedItems,
          subtotal: String(subtotal),
          discount: String(discount),
          totalPrice: String(totalPrice),
          startDate: body.startDate,
          endDate: body.endDate,
          customerName: body.customerName,
          customerEmail: body.customerEmail,
          customerPhone: body.customerPhone ?? null,
          notes: body.notes ?? null,
          validUntil: body.validUntil ?? null,
          status: body.status ?? "draft",
          updatedAt: new Date(),
        })
        .where(and(...whereConditions))
        .returning();
      if (!updated) { res.status(404).json({ error: "Not found" }); return; }
      res.json(formatQuote(updated));
      return;
    }

    // Partial update (status, discount, notes, validUntil only)
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (body.status) updateData.status = body.status;
    if (body.discount !== undefined) {
      updateData.discount = String(body.discount);
      const [existing] = await db.select().from(quotesTable).where(and(...whereConditions));
      if (existing) {
        updateData.totalPrice = String(Math.max(0, parseFloat(existing.subtotal) - body.discount));
      }
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.validUntil !== undefined) updateData.validUntil = body.validUntil;

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

    // Fetch business profile + tenant slug in parallel
    const [profileRow, tenantRow] = await Promise.all([
      quote.tenantId
        ? db
            .select({ name: businessProfileTable.name, email: businessProfileTable.email, outboundEmail: businessProfileTable.outboundEmail })
            .from(businessProfileTable)
            .where(eq(businessProfileTable.tenantId, quote.tenantId))
            .then(r => r[0])
        : Promise.resolve(undefined),
      quote.tenantId
        ? db
            .select({ slug: tenantsTable.slug })
            .from(tenantsTable)
            .where(eq(tenantsTable.id, quote.tenantId))
            .then(r => r[0])
        : Promise.resolve(undefined),
    ]);

    const companyName = profileRow?.name ?? "Your Rental Company";
    const companyEmail = profileRow?.outboundEmail ?? profileRow?.email ?? null;
    const tenantSlug = tenantRow?.slug ?? null;

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
          items,
          subtotal: parseFloat(quote.subtotal ?? "0"),
          discount: parseFloat(quote.discount ?? "0"),
          totalPrice: parseFloat(quote.totalPrice ?? "0"),
          notes: quote.notes,
          validUntil: quote.validUntil,
          tenantSlug,
          customerPhone: quote.customerPhone ?? null,
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
