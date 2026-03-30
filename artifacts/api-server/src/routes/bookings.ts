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
    const { status, listingId, startDate, endDate, customerEmail } = req.query;
    const conditions = [];
    if (status) conditions.push(eq(bookingsTable.status, status as any));
    if (listingId) conditions.push(eq(bookingsTable.listingId, Number(listingId)));
    if (startDate) conditions.push(gte(bookingsTable.startDate, String(startDate)));
    if (endDate) conditions.push(lte(bookingsTable.endDate, String(endDate)));
    if (customerEmail) conditions.push(eq(bookingsTable.customerEmail, String(customerEmail)));

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
    const basePrice = parseFloat(listing.pricePerDay) * days * (body.quantity ?? 1);

    // Sum selected addon prices
    const addons: Array<{ id: number; name: string; price: number; priceType: string; subtotal: number }> = body.addons ?? [];
    const addonsTotal = addons.reduce((sum, a) => {
      const subtotal = a.priceType === "per_day" ? a.price * days : a.price;
      return sum + subtotal;
    }, 0);

    const totalPrice = basePrice + addonsTotal;
    const addonsData = addons.length > 0 ? JSON.stringify(addons) : null;

    const { addons: _addons, assignedUnitIds: rawUnitIds, ...restBody } = body;
    const assignedUnitIds = Array.isArray(rawUnitIds) && rawUnitIds.length > 0 ? JSON.stringify(rawUnitIds) : null;
    const [created] = await db.insert(bookingsTable).values({
      ...restBody,
      totalPrice: String(totalPrice),
      addonsData,
      assignedUnitIds,
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

    // Status & notes (existing)
    if (body.status !== undefined) updateData.status = body.status;
    if (body.adminNotes !== undefined) updateData.adminNotes = body.adminNotes;
    if (body.depositPaid !== undefined) updateData.depositPaid = body.depositPaid != null ? String(body.depositPaid) : null;

    // Full edit fields
    if (body.customerName !== undefined) updateData.customerName = body.customerName;
    if (body.customerEmail !== undefined) updateData.customerEmail = body.customerEmail;
    if (body.customerPhone !== undefined) updateData.customerPhone = body.customerPhone || null;
    if (body.startDate !== undefined) updateData.startDate = body.startDate;
    if (body.endDate !== undefined) updateData.endDate = body.endDate;
    if (body.quantity !== undefined) updateData.quantity = Number(body.quantity);
    if (body.notes !== undefined) updateData.notes = body.notes || null;
    if (body.source !== undefined) updateData.source = body.source;
    if (body.assignedUnitIds !== undefined) {
      updateData.assignedUnitIds = Array.isArray(body.assignedUnitIds) && body.assignedUnitIds.length > 0
        ? JSON.stringify(body.assignedUnitIds)
        : null;
    }

    // Recalculate total if dates/qty/listingId changed
    if (body.startDate !== undefined || body.endDate !== undefined || body.quantity !== undefined || body.listingId !== undefined) {
      const bookingId = Number(req.params.id);
      const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId));
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }

      const listingId = body.listingId ?? existing.listingId;
      if (body.listingId !== undefined) updateData.listingId = Number(body.listingId);

      const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, listingId));
      if (listing) {
        const start = new Date(body.startDate ?? existing.startDate);
        const end = new Date(body.endDate ?? existing.endDate);
        const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        const qty = body.quantity ?? existing.quantity;
        const basePrice = parseFloat(listing.pricePerDay) * days * qty;
        const deposit = listing.depositAmount ? parseFloat(listing.depositAmount) : 0;
        updateData.totalPrice = String(basePrice + deposit);
      }
    }

    const previousStatus = (await db.select({ status: bookingsTable.status }).from(bookingsTable).where(eq(bookingsTable.id, Number(req.params.id))))[0]?.status;

    const [updated] = await db
      .update(bookingsTable)
      .set(updateData)
      .where(eq(bookingsTable.id, Number(req.params.id)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }

    // Fire automation if status changed
    if (body.status && body.status !== previousStatus) {
      const triggerMap: Record<string, string> = {
        confirmed: "booking_confirmed",
        active: "booking_activated",
        completed: "booking_completed",
        cancelled: "booking_cancelled",
      };
      const trigger = triggerMap[body.status];
      if (trigger) {
        fetch(`http://localhost:8080/api/communications/send-automation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger, bookingId: updated.id }),
        }).catch(() => {}); // Fire and forget — don't block the response
      }
    }

    const [listing] = await db.select({ title: listingsTable.title }).from(listingsTable).where(eq(listingsTable.id, updated.listingId));
    res.json(formatBooking(updated, listing?.title ?? "Unknown"));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update booking" });
  }
});

export default router;
