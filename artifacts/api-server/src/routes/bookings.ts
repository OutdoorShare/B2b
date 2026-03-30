import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { bookingsTable, listingsTable } from "@workspace/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

const router: IRouter = Router();

function formatBooking(b: typeof bookingsTable.$inferSelect, listingTitle: string) {
  return {
    ...b,
    listingTitle,
    totalPrice: parseFloat(b.totalPrice ?? "0"),
    depositPaid: b.depositPaid ? parseFloat(b.depositPaid) : null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

router.get("/bookings", async (req, res) => {
  try {
    const { status, listingId, startDate, endDate } = req.query;
    const conditions = [];
    if (status) conditions.push(eq(bookingsTable.status, status as any));
    if (listingId) conditions.push(eq(bookingsTable.listingId, Number(listingId)));
    if (startDate) conditions.push(gte(bookingsTable.startDate, String(startDate)));
    if (endDate) conditions.push(lte(bookingsTable.endDate, String(endDate)));

    const bookings = await db
      .select()
      .from(bookingsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(bookingsTable.createdAt);

    const listings = await db.select({ id: listingsTable.id, title: listingsTable.title }).from(listingsTable);
    const titleMap = Object.fromEntries(listings.map(l => [l.id, l.title]));

    res.json(bookings.map(b => formatBooking(b, titleMap[b.listingId] ?? "Unknown")));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

router.post("/bookings", async (req, res) => {
  try {
    const body = req.body;
    
    // Calculate total price
    const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, body.listingId));
    if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }

    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const totalPrice = parseFloat(listing.pricePerDay) * days * (body.quantity ?? 1);

    const [created] = await db.insert(bookingsTable).values({
      ...body,
      totalPrice: String(totalPrice),
    }).returning();

    res.status(201).json(formatBooking(created, listing.title));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

router.get("/bookings/:id", async (req, res) => {
  try {
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, Number(req.params.id)));
    if (!booking) { res.status(404).json({ error: "Not found" }); return; }

    const [listing] = await db.select({ title: listingsTable.title }).from(listingsTable).where(eq(listingsTable.id, booking.listingId));
    res.json(formatBooking(booking, listing?.title ?? "Unknown"));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch booking" });
  }
});

router.put("/bookings/:id", async (req, res) => {
  try {
    const body = req.body;
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (body.status) updateData.status = body.status;
    if (body.adminNotes !== undefined) updateData.adminNotes = body.adminNotes;
    if (body.depositPaid !== undefined) updateData.depositPaid = body.depositPaid != null ? String(body.depositPaid) : null;

    const [updated] = await db
      .update(bookingsTable)
      .set(updateData)
      .where(eq(bookingsTable.id, Number(req.params.id)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }

    const [listing] = await db.select({ title: listingsTable.title }).from(listingsTable).where(eq(listingsTable.id, updated.listingId));
    res.json(formatBooking(updated, listing?.title ?? "Unknown"));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update booking" });
  }
});

export default router;
