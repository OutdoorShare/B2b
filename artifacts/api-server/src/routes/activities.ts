import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { activitiesTable, tenantsTable, businessProfileTable, listingsTable } from "@workspace/db/schema";
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

    res.json(rows.map(r => ({
      ...r.activity,
      pricePerPerson: r.activity.pricePerPerson ? parseFloat(r.activity.pricePerPerson) : 0,
      tenantName: r.bizName || r.tenantName,
      tenantSlug: r.tenantSlug,
      location: r.activity.location || `${r.bizCity || ""}${r.bizCity && r.bizState ? ", " : ""}${r.bizState || ""}` || r.tenantName,
      businessCity: r.bizCity ?? null,
      businessState: r.bizState ?? null,
      businessLat: r.bizLat ? parseFloat(r.bizLat) : null,
      businessLng: r.bizLng ? parseFloat(r.bizLng) : null,
      linkedListing: r.listing?.id ? {
        ...r.listing,
        pricePerDay: r.listing.pricePerDay ? parseFloat(r.listing.pricePerDay) : 0,
      } : null,
    })));
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

    res.json({
      ...row.activity,
      pricePerPerson: row.activity.pricePerPerson ? parseFloat(row.activity.pricePerPerson) : 0,
      tenantName: row.bizName || row.tenantName,
      tenantSlug: row.tenantSlug,
      location: row.activity.location || `${row.bizCity || ""}${row.bizCity && row.bizState ? ", " : ""}${row.bizState || ""}` || row.tenantName,
      businessCity: row.bizCity ?? null,
      businessState: row.bizState ?? null,
      businessLat: row.bizLat ? parseFloat(row.bizLat) : null,
      businessLng: row.bizLng ? parseFloat(row.bizLng) : null,
      businessLogoUrl: row.bizLogoUrl ?? null,
      businessTagline: row.bizTagline ?? null,
      linkedListing: row.listing?.id ? {
        ...row.listing,
        pricePerDay: row.listing.pricePerDay ? parseFloat(row.listing.pricePerDay) : 0,
      } : null,
    });
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
    const { title, description, category, pricePerPerson, durationMinutes, maxCapacity, location, imageUrls, highlights, whatToBring, minAge, isActive, listingId, requiresRental } = req.body;
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
    const { title, description, category, pricePerPerson, durationMinutes, maxCapacity, location, imageUrls, highlights, whatToBring, minAge, isActive, listingId, requiresRental } = req.body;
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

function fmt(a: typeof activitiesTable.$inferSelect) {
  return {
    ...a,
    pricePerPerson: a.pricePerPerson ? parseFloat(a.pricePerPerson) : 0,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export default router;
