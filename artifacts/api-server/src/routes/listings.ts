import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { listingsTable, categoriesTable, bookingsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, ilike, or, count, sum } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

function formatListing(l: typeof listingsTable.$inferSelect, categoryName?: string | null) {
  // Count bookings for this listing
  return {
    ...l,
    categoryName: categoryName ?? null,
    pricePerDay: parseFloat(l.pricePerDay ?? "0"),
    pricePerWeek: l.pricePerWeek ? parseFloat(l.pricePerWeek) : null,
    pricePerHour: l.pricePerHour ? parseFloat(l.pricePerHour) : null,
    depositAmount: l.depositAmount ? parseFloat(l.depositAmount) : null,
    availableQuantity: l.quantity,
    imageUrls: Array.isArray(l.imageUrls) ? l.imageUrls : [],
    includedItems: Array.isArray(l.includedItems) ? l.includedItems : [],
    totalBookings: 0,
    totalRevenue: 0,
    rating: null,
    reviewCount: 0,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

router.get("/listings", async (req, res) => {
  try {
    const { categoryId, status, search, minPrice, maxPrice } = req.query;
    
    const conditions = [];
    if (req.tenantId) conditions.push(eq(listingsTable.tenantId, req.tenantId));
    if (categoryId) conditions.push(eq(listingsTable.categoryId, Number(categoryId)));
    if (status) conditions.push(eq(listingsTable.status, status as any));
    if (minPrice) conditions.push(gte(listingsTable.pricePerDay, String(minPrice)));
    if (maxPrice) conditions.push(lte(listingsTable.pricePerDay, String(maxPrice)));
    if (search) {
      conditions.push(or(
        ilike(listingsTable.title, `%${search}%`),
        ilike(listingsTable.description, `%${search}%`)
      )!);
    }

    const listings = await db
      .select()
      .from(listingsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(listingsTable.createdAt);

    // Get categories for lookup
    const cats = await db.select().from(categoriesTable);
    const catMap = Object.fromEntries(cats.map(c => [c.id, c.name]));

    // Get booking stats
    const bookingStats = await db
      .select({
        listingId: bookingsTable.listingId,
        totalBookings: count(),
        totalRevenue: sum(bookingsTable.totalPrice),
      })
      .from(bookingsTable)
      .where(sql`${bookingsTable.status} != 'cancelled'`)
      .groupBy(bookingsTable.listingId);

    const statsMap = Object.fromEntries(
      bookingStats.map(s => [s.listingId, { totalBookings: Number(s.totalBookings), totalRevenue: parseFloat(s.totalRevenue ?? "0") }])
    );

    const result = listings.map(l => ({
      ...formatListing(l, catMap[l.categoryId ?? -1]),
      totalBookings: statsMap[l.id]?.totalBookings ?? 0,
      totalRevenue: statsMap[l.id]?.totalRevenue ?? 0,
    }));

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch listings" });
  }
});

router.post("/listings", async (req, res) => {
  try {
    const body = req.body;
    const [created] = await db.insert(listingsTable).values({
      ...body,
      tenantId: req.tenantId ?? null,
      pricePerDay: String(body.pricePerDay),
      pricePerWeek: body.pricePerWeek != null ? String(body.pricePerWeek) : null,
      pricePerHour: body.pricePerHour != null ? String(body.pricePerHour) : null,
      depositAmount: body.depositAmount != null ? String(body.depositAmount) : null,
      imageUrls: body.imageUrls ?? [],
      includedItems: body.includedItems ?? [],
    }).returning();

    res.status(201).json(formatListing(created));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create listing" });
  }
});

router.get("/listings/:id", async (req, res) => {
  try {
    const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, Number(req.params.id)));
    if (!listing) { res.status(404).json({ error: "Not found" }); return; }

    let categoryName: string | null = null;
    if (listing.categoryId) {
      const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, listing.categoryId));
      categoryName = cat?.name ?? null;
    }

    const [stats] = await db
      .select({ totalBookings: count(), totalRevenue: sum(bookingsTable.totalPrice) })
      .from(bookingsTable)
      .where(and(eq(bookingsTable.listingId, listing.id), sql`${bookingsTable.status} != 'cancelled'`));

    res.json({
      ...formatListing(listing, categoryName),
      totalBookings: Number(stats?.totalBookings ?? 0),
      totalRevenue: parseFloat(stats?.totalRevenue ?? "0"),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch listing" });
  }
});

router.put("/listings/:id", async (req, res) => {
  try {
    const body = req.body;
    const updateData: Record<string, any> = { ...body, updatedAt: new Date() };
    if (body.pricePerDay !== undefined) updateData.pricePerDay = String(body.pricePerDay);
    if (body.pricePerWeek !== undefined) updateData.pricePerWeek = body.pricePerWeek != null ? String(body.pricePerWeek) : null;
    if (body.pricePerHour !== undefined) updateData.pricePerHour = body.pricePerHour != null ? String(body.pricePerHour) : null;
    if (body.depositAmount !== undefined) updateData.depositAmount = body.depositAmount != null ? String(body.depositAmount) : null;

    const [updated] = await db
      .update(listingsTable)
      .set(updateData)
      .where(eq(listingsTable.id, Number(req.params.id)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatListing(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update listing" });
  }
});

router.delete("/listings/:id", async (req, res) => {
  try {
    await db.delete(listingsTable).where(eq(listingsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete listing" });
  }
});

export default router;
