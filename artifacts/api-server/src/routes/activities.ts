import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { activitiesTable, activityBookingsTable, tenantsTable, businessProfileTable, listingsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

const router: IRouter = Router();

// ── Public: list all active activities across all tenants ─────────────────────
router.get("/public/activities", async (req, res) => {
  try {
    const rows = await db
      .select({
        activity: activitiesTable,
        tenantName: tenantsTable.name,
        tenantSlug: tenantsTable.slug,
        bizName: businessProfileTable.name,
        bizCity: businessProfileTable.city,
        bizState: businessProfileTable.state,
        bizLat: businessProfileTable.lat,
        bizLng: businessProfileTable.lng,
        listing: {
          id: listingsTable.id,
          title: listingsTable.title,
          pricePerDay: listingsTable.pricePerDay,
          imageUrls: listingsTable.imageUrls,
          description: listingsTable.description,
        },
      })
      .from(activitiesTable)
      .innerJoin(tenantsTable, eq(activitiesTable.tenantId, tenantsTable.id))
      .leftJoin(businessProfileTable, eq(businessProfileTable.tenantId, tenantsTable.id))
      .leftJoin(listingsTable, eq(activitiesTable.listingId, listingsTable.id))
      .where(and(eq(activitiesTable.isActive, true), eq(tenantsTable.status, "active")))
      .orderBy(desc(activitiesTable.createdAt));

    res.json(rows.map(r => fmtPublic(r.activity, r, r.listing)));
  } catch (e: any) {
    console.error("[activities] public list error:", e.message);
    res.status(500).json({ error: "Failed to load activities" });
  }
});

const LISTING_COLS = {
  id: listingsTable.id,
  title: listingsTable.title,
  pricePerDay: listingsTable.pricePerDay,
  imageUrls: listingsTable.imageUrls,
  description: listingsTable.description,
};

function fmtListing(l: { id: number; title: string; pricePerDay: string; imageUrls: string[]; description: string } | null) {
  if (!l?.id) return null;
  return { ...l, pricePerDay: parseFloat(l.pricePerDay) || 0 };
}

function fmtPublic(
  activity: typeof activitiesTable.$inferSelect,
  biz: { tenantName: string; tenantSlug: string; bizName?: string | null; bizCity?: string | null; bizState?: string | null; bizLat?: string | null; bizLng?: string | null; bizLogoUrl?: string | null; bizTagline?: string | null },
  listing: { id: number; title: string; pricePerDay: string; imageUrls: string[]; description: string } | null
) {
  return {
    ...activity,
    pricePerPerson: activity.pricePerPerson ? parseFloat(activity.pricePerPerson) : 0,
    tenantName: biz.bizName || biz.tenantName,
    tenantSlug: biz.tenantSlug,
    location: activity.location || `${biz.bizCity || ""}${biz.bizCity && biz.bizState ? ", " : ""}${biz.bizState || ""}` || biz.tenantName,
    businessCity: biz.bizCity ?? null,
    businessState: biz.bizState ?? null,
    businessLat: biz.bizLat ? parseFloat(biz.bizLat) : null,
    businessLng: biz.bizLng ? parseFloat(biz.bizLng) : null,
    businessLogoUrl: (biz as any).bizLogoUrl ?? null,
    businessTagline: (biz as any).bizTagline ?? null,
    scheduleMode: activity.scheduleMode ?? "open",
    recurringSlots: activity.recurringSlots ?? [],
    specificSlots: activity.specificSlots ?? [],
    linkedListing: listing?.id ? { ...listing, pricePerDay: parseFloat(listing.pricePerDay) || 0 } : null,
  };
}

// ── Public: single activity detail ────────────────────────────────────────────
router.get("/public/activities/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

    const [row] = await db
      .select({
        activity: activitiesTable,
        tenantName: tenantsTable.name,
        tenantSlug: tenantsTable.slug,
        bizName: businessProfileTable.name,
        bizCity: businessProfileTable.city,
        bizState: businessProfileTable.state,
        bizLat: businessProfileTable.lat,
        bizLng: businessProfileTable.lng,
        bizLogoUrl: businessProfileTable.logoUrl,
        bizTagline: businessProfileTable.tagline,
        listing: {
          id: listingsTable.id,
          title: listingsTable.title,
          pricePerDay: listingsTable.pricePerDay,
          imageUrls: listingsTable.imageUrls,
          description: listingsTable.description,
        },
      })
      .from(activitiesTable)
      .innerJoin(tenantsTable, eq(activitiesTable.tenantId, tenantsTable.id))
      .leftJoin(businessProfileTable, eq(businessProfileTable.tenantId, tenantsTable.id))
      .leftJoin(listingsTable, eq(activitiesTable.listingId, listingsTable.id))
      .where(eq(activitiesTable.id, id))
      .limit(1);

    if (!row) { res.status(404).json({ error: "Not found" }); return; }

    res.json(fmtPublic(row.activity, row as any, row.listing as any));
  } catch (e: any) {
    console.error("[activities] public detail error:", e.message);
    res.status(500).json({ error: "Failed to load activity" });
  }
});

// ── Admin: list tenant activities ─────────────────────────────────────────────
router.get("/activities", async (req, res) => {
  if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const rows = await db
      .select({ activity: activitiesTable, listing: LISTING_COLS })
      .from(activitiesTable)
      .leftJoin(listingsTable, eq(activitiesTable.listingId, listingsTable.id))
      .where(eq(activitiesTable.tenantId, req.tenantId))
      .orderBy(desc(activitiesTable.createdAt));
    res.json(rows.map(r => ({ ...fmt(r.activity), linkedListing: fmtListing(r.listing as any) })));
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load activities" });
  }
});

// ── Admin: list activity bookings for tenant ──────────────────────────────────
// IMPORTANT: Must be registered BEFORE /activities/:id to avoid route conflict
router.get("/activities/bookings", async (req, res) => {
  if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const rows = await db
      .select()
      .from(activityBookingsTable)
      .where(eq(activityBookingsTable.tenantId, req.tenantId))
      .orderBy(desc(activityBookingsTable.createdAt));
    res.json(rows.map(fmtBooking));
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load bookings" });
  }
});

// ── Admin: get single activity booking ────────────────────────────────────────
// IMPORTANT: Must be registered BEFORE /activities/:id to avoid route conflict
router.get("/activities/bookings/:id", async (req, res) => {
  if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const id = parseInt(req.params.id);
    const [booking] = await db
      .select()
      .from(activityBookingsTable)
      .where(and(eq(activityBookingsTable.id, id), eq(activityBookingsTable.tenantId, req.tenantId)))
      .limit(1);
    if (!booking) { res.status(404).json({ error: "Not found" }); return; }
    await db.update(activityBookingsTable)
      .set({ seenByAdmin: true })
      .where(eq(activityBookingsTable.id, id));
    res.json(fmtBooking(booking));
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load booking" });
  }
});

// ── Admin: update activity booking ────────────────────────────────────────────
// IMPORTANT: Must be registered BEFORE /activities/:id to avoid route conflict
router.patch("/activities/bookings/:id", async (req, res) => {
  if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const id = parseInt(req.params.id);
    const { status, adminNotes } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    const [updated] = await db
      .update(activityBookingsTable)
      .set(updates)
      .where(and(eq(activityBookingsTable.id, id), eq(activityBookingsTable.tenantId, req.tenantId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(fmtBooking(updated));
  } catch (e: any) {
    res.status(500).json({ error: "Failed to update booking" });
  }
});

// ── Admin: get single activity ────────────────────────────────────────────────
router.get("/activities/:id", async (req, res) => {
  if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const id = parseInt(req.params.id);
    const [row] = await db
      .select({ activity: activitiesTable, listing: LISTING_COLS })
      .from(activitiesTable)
      .leftJoin(listingsTable, eq(activitiesTable.listingId, listingsTable.id))
      .where(and(eq(activitiesTable.id, id), eq(activitiesTable.tenantId, req.tenantId)));
    if (!row) { res.status(404).json({ error: "Activity not found" }); return; }
    res.json({ ...fmt(row.activity), linkedListing: fmtListing(row.listing as any) });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load activity" });
  }
});

// ── Admin: create activity ────────────────────────────────────────────────────
router.post("/activities", async (req, res) => {
  if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const {
      title, description, category, pricePerPerson, durationMinutes, maxCapacity,
      location, imageUrls, highlights, whatToBring, minAge, isActive,
      listingId, requiresRental, scheduleMode, recurringSlots, specificSlots,
    } = req.body;
    if (!title) { res.status(400).json({ error: "Title is required" }); return; }
    const [row] = await db.insert(activitiesTable).values({
      tenantId: req.tenantId,
      title,
      description: description ?? "",
      category: category ?? "adventure",
      pricePerPerson: pricePerPerson?.toString() ?? "0",
      durationMinutes: durationMinutes ?? 60,
      maxCapacity: maxCapacity ?? 10,
      location: location ?? "",
      imageUrls: imageUrls ?? [],
      highlights: highlights ?? [],
      whatToBring: whatToBring ?? "",
      minAge: minAge ?? null,
      isActive: isActive ?? true,
      listingId: listingId ? parseInt(listingId) : null,
      requiresRental: requiresRental ?? false,
      scheduleMode: scheduleMode ?? "open",
      recurringSlots: recurringSlots ?? [],
      specificSlots: specificSlots ?? [],
    }).returning();
    res.status(201).json(fmt(row));
  } catch (e: any) {
    res.status(500).json({ error: "Failed to create activity" });
  }
});

// ── Admin: update activity ────────────────────────────────────────────────────
router.put("/activities/:id", async (req, res) => {
  if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const id = parseInt(req.params.id);
    const {
      title, description, category, pricePerPerson, durationMinutes, maxCapacity,
      location, imageUrls, highlights, whatToBring, minAge, isActive,
      listingId, requiresRental, scheduleMode, recurringSlots, specificSlots,
    } = req.body;
    const [row] = await db
      .update(activitiesTable)
      .set({
        title, description, category,
        pricePerPerson: pricePerPerson?.toString(),
        durationMinutes, maxCapacity, location,
        imageUrls, highlights, whatToBring, minAge,
        isActive,
        listingId: listingId ? parseInt(listingId) : null,
        requiresRental: requiresRental ?? false,
        scheduleMode: scheduleMode ?? "open",
        recurringSlots: recurringSlots ?? [],
        specificSlots: specificSlots ?? [],
        updatedAt: new Date(),
      })
      .where(and(eq(activitiesTable.id, id), eq(activitiesTable.tenantId, req.tenantId)))
      .returning();
    if (!row) { res.status(404).json({ error: "Activity not found" }); return; }
    res.json(fmt(row));
  } catch (e: any) {
    res.status(500).json({ error: "Failed to update activity" });
  }
});

// ── Admin: delete activity ────────────────────────────────────────────────────
router.delete("/activities/:id", async (req, res) => {
  if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db
      .delete(activitiesTable)
      .where(and(eq(activitiesTable.id, id), eq(activitiesTable.tenantId, req.tenantId)))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Activity not found" }); return; }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to delete activity" });
  }
});

// ── Public: create activity booking ───────────────────────────────────────────
router.post("/activity-bookings", async (req, res) => {
  try {
    const {
      activityId, customerName, customerEmail, customerPhone,
      selectedDate, selectedTime, guestCount, notes,
    } = req.body;
    if (!activityId || !customerName || !customerEmail || !guestCount) {
      res.status(400).json({ error: "activityId, customerName, customerEmail, and guestCount are required" });
      return;
    }
    const [activity] = await db
      .select()
      .from(activitiesTable)
      .where(eq(activitiesTable.id, parseInt(activityId)))
      .limit(1);
    if (!activity) { res.status(404).json({ error: "Activity not found" }); return; }
    const pricePerPerson = parseFloat(activity.pricePerPerson) || 0;
    const totalAmount = (pricePerPerson * parseInt(guestCount)).toFixed(2);
    const [booking] = await db.insert(activityBookingsTable).values({
      tenantId: activity.tenantId,
      activityId: activity.id,
      activityTitle: activity.title,
      activityPricePerPerson: pricePerPerson.toString(),
      customerName,
      customerEmail,
      customerPhone: customerPhone ?? null,
      selectedDate: selectedDate ?? null,
      selectedTime: selectedTime ?? null,
      guestCount: parseInt(guestCount),
      totalAmount,
      notes: notes ?? null,
      status: "pending",
    }).returning();
    res.status(201).json({ id: booking.id, status: booking.status });
  } catch (e: any) {
    console.error("[activity-bookings] create error:", e.message);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// ── Public: get activity booking by ID (for confirmation page) ─────────────
router.get("/activity-bookings/:id/public", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [booking] = await db
      .select()
      .from(activityBookingsTable)
      .where(eq(activityBookingsTable.id, id))
      .limit(1);
    if (!booking) { res.status(404).json({ error: "Not found" }); return; }
    res.json({
      id: booking.id,
      activityTitle: booking.activityTitle,
      selectedDate: booking.selectedDate,
      selectedTime: booking.selectedTime,
      guestCount: booking.guestCount,
      totalAmount: parseFloat(booking.totalAmount),
      status: booking.status,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      createdAt: booking.createdAt.toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load booking" });
  }
});


function fmtBooking(b: typeof activityBookingsTable.$inferSelect) {
  return {
    ...b,
    totalAmount: parseFloat(b.totalAmount),
    activityPricePerPerson: parseFloat(b.activityPricePerPerson),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

function fmt(a: typeof activitiesTable.$inferSelect) {
  return {
    ...a,
    pricePerPerson: a.pricePerPerson ? parseFloat(a.pricePerPerson) : 0,
    scheduleMode: a.scheduleMode ?? "open",
    recurringSlots: a.recurringSlots ?? [],
    specificSlots: a.specificSlots ?? [],
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export default router;
