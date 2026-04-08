import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  listingsTable,
  tenantsTable,
  businessProfileTable,
  categoriesTable,
  customersTable,
  bookingsTable,
  customerFavoritesTable,
} from "@workspace/db/schema";
import { eq, and, sql, ilike, gte, lte, or, desc, inArray } from "drizzle-orm";

const router: IRouter = Router();

// Helper: should this request bypass testMode filter?
function isPreview(req: import("express").Request): boolean {
  return req.query.preview === "true";
}

// GET /api/marketplace/listings — all active listings across all tenants
router.get("/marketplace/listings", async (req, res) => {
  try {
    const { search, categoryId, minPrice, maxPrice, location, tenantSlug, startDate, endDate, limit = "100", offset = "0" } = req.query as Record<string, string>;
    const preview = isPreview(req);

    const conditions = [eq(listingsTable.status, "active")];

    if (search) {
      conditions.push(
        or(
          ilike(listingsTable.title, `%${search}%`),
          ilike(listingsTable.description, `%${search}%`)
        ) as any
      );
    }
    if (categoryId) conditions.push(eq(listingsTable.categoryId, parseInt(categoryId)));
    if (minPrice) conditions.push(gte(listingsTable.pricePerDay, minPrice));
    if (maxPrice) conditions.push(lte(listingsTable.pricePerDay, maxPrice));
    if (location) conditions.push(ilike(listingsTable.location, `%${location}%`));

    // Availability filter: exclude listings where all units are booked during the requested range
    if (startDate && endDate) {
      conditions.push(
        sql`(
          SELECT COUNT(*)::int FROM bookings b
          WHERE b.listing_id = ${listingsTable.id}
            AND b.status IN ('pending', 'confirmed', 'active')
            AND b.start_date <= ${endDate}
            AND b.end_date >= ${startDate}
        ) < ${listingsTable.quantity}`
      );
    }

    // Resolve tenantSlug filter to a tenantId
    if (tenantSlug) {
      const [tenant] = await db
        .select({ id: tenantsTable.id })
        .from(tenantsTable)
        .where(and(eq(tenantsTable.slug, tenantSlug), eq(tenantsTable.status, "active")));
      if (tenant) conditions.push(eq(listingsTable.tenantId, tenant.id));
      else { res.json([]); return; }
    }

    const rows = await db
      .select({
        listing: listingsTable,
        tenant: {
          id: tenantsTable.id,
          slug: tenantsTable.slug,
          name: tenantsTable.name,
          status: tenantsTable.status,
        },
        business: {
          name: businessProfileTable.name,
          logoUrl: businessProfileTable.logoUrl,
          primaryColor: businessProfileTable.primaryColor,
          accentColor: businessProfileTable.accentColor,
          city: businessProfileTable.city,
          state: businessProfileTable.state,
          location: businessProfileTable.location,
          lat: businessProfileTable.lat,
          lng: businessProfileTable.lng,
        },
        category: {
          id: categoriesTable.id,
          name: categoriesTable.name,
          slug: categoriesTable.slug,
          icon: categoriesTable.icon,
        },
      })
      .from(listingsTable)
      .innerJoin(tenantsTable, eq(listingsTable.tenantId, tenantsTable.id))
      .leftJoin(businessProfileTable, eq(businessProfileTable.tenantId, tenantsTable.id))
      .leftJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
      .where(and(...conditions, eq(tenantsTable.status, "active"), ...(preview ? [] : [eq(tenantsTable.testMode, false)])))
      .orderBy(desc(listingsTable.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const listings = rows.map(r => ({
      ...r.listing,
      tenantSlug: r.tenant.slug,
      tenantName: r.tenant.name,
      businessName: r.business?.name ?? r.tenant.name,
      businessLogoUrl: r.business?.logoUrl ?? null,
      businessPrimaryColor: r.business?.primaryColor ?? "#2d6a4f",
      businessAccentColor: r.business?.accentColor ?? "#52b788",
      businessCity: r.business?.city ?? null,
      businessState: r.business?.state ?? null,
      businessLocation: r.business?.location ?? null,
      businessLat: r.business?.lat ? parseFloat(r.business.lat) : null,
      businessLng: r.business?.lng ? parseFloat(r.business.lng) : null,
      categoryName: r.category?.name ?? null,
      categorySlug: r.category?.slug ?? null,
      categoryIcon: r.category?.icon ?? null,
    }));

    res.json(listings);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch marketplace listings" });
  }
});

// GET /api/marketplace/listings/:id — single listing with full tenant details
router.get("/marketplace/listings/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const preview = isPreview(req);

    const [row] = await db
      .select({
        listing: listingsTable,
        tenant: {
          id: tenantsTable.id,
          slug: tenantsTable.slug,
          name: tenantsTable.name,
          status: tenantsTable.status,
          isHost: tenantsTable.isHost,
          hostCustomerId: tenantsTable.hostCustomerId,
        },
        business: {
          name: businessProfileTable.name,
          tagline: businessProfileTable.tagline,
          description: businessProfileTable.description,
          logoUrl: businessProfileTable.logoUrl,
          coverImageUrl: businessProfileTable.coverImageUrl,
          primaryColor: businessProfileTable.primaryColor,
          accentColor: businessProfileTable.accentColor,
          phone: businessProfileTable.phone,
          website: businessProfileTable.website,
          city: businessProfileTable.city,
          state: businessProfileTable.state,
          location: businessProfileTable.location,
        },
        category: {
          id: categoriesTable.id,
          name: categoriesTable.name,
          slug: categoriesTable.slug,
          icon: categoriesTable.icon,
        },
      })
      .from(listingsTable)
      .innerJoin(tenantsTable, eq(listingsTable.tenantId, tenantsTable.id))
      .leftJoin(businessProfileTable, eq(businessProfileTable.tenantId, tenantsTable.id))
      .leftJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
      .where(and(eq(listingsTable.id, id), eq(listingsTable.status, "active"), eq(tenantsTable.status, "active"), ...(preview ? [] : [eq(tenantsTable.testMode, false)])));

    if (!row) { res.status(404).json({ error: "Listing not found" }); return; }

    // For host listings, look up the host's first name from the customers table
    let contactName: string = row.business?.name ?? row.tenant.name;
    if (row.tenant.isHost && row.tenant.hostCustomerId) {
      const [hostCustomer] = await db
        .select({ name: customersTable.name })
        .from(customersTable)
        .where(eq(customersTable.id, row.tenant.hostCustomerId));
      if (hostCustomer?.name) {
        // Show first name only for host listings
        contactName = hostCustomer.name.split(" ")[0] ?? hostCustomer.name;
      }
    }

    res.json({
      ...row.listing,
      tenantSlug: row.tenant.slug,
      tenantName: row.tenant.name,
      isHost: row.tenant.isHost,
      contactName,
      business: {
        name: row.business?.name ?? row.tenant.name,
        tagline: row.business?.tagline ?? null,
        description: row.business?.description ?? null,
        logoUrl: row.business?.logoUrl ?? null,
        coverImageUrl: row.business?.coverImageUrl ?? null,
        primaryColor: row.business?.primaryColor ?? "#2d6a4f",
        accentColor: row.business?.accentColor ?? "#52b788",
        phone: row.business?.phone ?? null,
        website: row.business?.website ?? null,
        city: row.business?.city ?? null,
        state: row.business?.state ?? null,
        location: row.business?.location ?? null,
      },
      category: row.category ? {
        id: row.category.id,
        name: row.category.name,
        slug: row.category.slug,
        icon: row.category.icon,
      } : null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch listing" });
  }
});

// GET /api/marketplace/categories — all categories that have at least one active listing
router.get("/marketplace/categories", async (req, res) => {
  try {
    const preview = isPreview(req);
    const rows = await db
      .select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        slug: categoriesTable.slug,
        icon: categoriesTable.icon,
        listingCount: sql<number>`count(${listingsTable.id})::int`,
      })
      .from(categoriesTable)
      .innerJoin(listingsTable, and(
        eq(listingsTable.categoryId, categoriesTable.id),
        eq(listingsTable.status, "active")
      ))
      .innerJoin(tenantsTable, and(
        eq(listingsTable.tenantId, tenantsTable.id),
        eq(tenantsTable.status, "active"),
        ...(preview ? [] : [eq(tenantsTable.testMode, false)])
      ))
      .groupBy(categoriesTable.id, categoriesTable.name, categoriesTable.slug, categoriesTable.icon)
      .orderBy(desc(sql<number>`count(${listingsTable.id})`));

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// GET /api/marketplace/companies — all active tenants with a listing count
router.get("/marketplace/companies", async (req, res) => {
  try {
    const preview = isPreview(req);
    const rows = await db
      .select({
        tenantId: tenantsTable.id,
        slug: tenantsTable.slug,
        businessName: businessProfileTable.name,
        logoUrl: businessProfileTable.logoUrl,
        primaryColor: businessProfileTable.primaryColor,
        accentColor: businessProfileTable.accentColor,
        city: businessProfileTable.city,
        state: businessProfileTable.state,
        tagline: businessProfileTable.tagline,
        listingCount: sql<number>`count(${listingsTable.id})::int`,
      })
      .from(tenantsTable)
      .leftJoin(businessProfileTable, eq(businessProfileTable.tenantId, tenantsTable.id))
      .leftJoin(
        listingsTable,
        and(eq(listingsTable.tenantId, tenantsTable.id), eq(listingsTable.status, "active"))
      )
      .where(and(eq(tenantsTable.status, "active"), ...(preview ? [] : [eq(tenantsTable.testMode, false)])))
      .groupBy(
        tenantsTable.id,
        tenantsTable.slug,
        businessProfileTable.name,
        businessProfileTable.logoUrl,
        businessProfileTable.primaryColor,
        businessProfileTable.accentColor,
        businessProfileTable.city,
        businessProfileTable.state,
        businessProfileTable.tagline,
      )
      .orderBy(desc(sql<number>`count(${listingsTable.id})`));

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch companies" });
  }
});

// GET /api/marketplace/stats — platform-wide stats
router.get("/marketplace/stats", async (req, res) => {
  try {
    const preview = isPreview(req);

    const [{ listings }] = await db
      .select({ listings: sql<number>`count(*)::int` })
      .from(listingsTable)
      .innerJoin(tenantsTable, and(eq(listingsTable.tenantId, tenantsTable.id), eq(tenantsTable.status, "active"), ...(preview ? [] : [eq(tenantsTable.testMode, false)])))
      .where(eq(listingsTable.status, "active"));

    const [{ companies }] = await db
      .select({ companies: sql<number>`count(*)::int` })
      .from(tenantsTable)
      .where(and(eq(tenantsTable.status, "active"), ...(preview ? [] : [eq(tenantsTable.testMode, false)])));

    const [{ customers }] = await db
      .select({ customers: sql<number>`count(*)::int` })
      .from(customersTable);

    res.json({ listings, companies, customers });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// GET /api/marketplace/renter/bookings?customerId=... — all bookings for a renter across all tenants
router.get("/marketplace/renter/bookings", async (req, res) => {
  try {
    const { customerId } = req.query as { customerId?: string };
    if (!customerId) { res.status(400).json({ error: "customerId required" }); return; }

    const id = parseInt(customerId);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid customerId" }); return; }

    // Bookings are keyed by customerEmail — look up the customer's email first
    const customer = await db
      .select({ email: customersTable.email })
      .from(customersTable)
      .where(eq(customersTable.id, id))
      .limit(1);

    if (!customer.length) { res.json([]); return; }
    const email = customer[0].email;

    const bookings = await db
      .select({
        booking: bookingsTable,
        listing: {
          id: listingsTable.id,
          title: listingsTable.title,
          imageUrls: listingsTable.imageUrls,
        },
        tenant: {
          slug: tenantsTable.slug,
          name: tenantsTable.name,
        },
        business: {
          name: businessProfileTable.name,
          logoUrl: businessProfileTable.logoUrl,
          primaryColor: businessProfileTable.primaryColor,
        },
      })
      .from(bookingsTable)
      .leftJoin(listingsTable, eq(bookingsTable.listingId, listingsTable.id))
      .leftJoin(tenantsTable, eq(bookingsTable.tenantId, tenantsTable.id))
      .leftJoin(businessProfileTable, eq(businessProfileTable.tenantId, tenantsTable.id))
      .where(eq(bookingsTable.customerEmail, email))
      .orderBy(desc(bookingsTable.createdAt))
      .limit(50);

    res.json(bookings.map(r => {
      let pickupPhotos: string[] = [];
      let returnPhotos: string[] = [];
      try { pickupPhotos = r.booking.pickupPhotos ? JSON.parse(r.booking.pickupPhotos) : []; } catch {}
      try { returnPhotos = r.booking.returnPhotos ? JSON.parse(r.booking.returnPhotos) : []; } catch {}
      return {
        ...r.booking,
        pickupPhotos,
        returnPhotos,
        listingTitle: r.listing?.title ?? "Unknown listing",
        listingImage: r.listing?.imageUrls?.[0] ?? null,
        tenantSlug: r.tenant?.slug ?? null,
        tenantName: r.tenant?.name ?? null,
        businessName: r.business?.name ?? r.tenant?.name ?? null,
        businessLogoUrl: r.business?.logoUrl ?? null,
        businessPrimaryColor: r.business?.primaryColor ?? null,
      };
    }));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// ── Favorites ─────────────────────────────────────────────────────────────────

// GET /api/marketplace/favorites?customerId=X — returns array of favorited listing IDs
router.get("/marketplace/favorites", async (req, res) => {
  const customerId = parseInt(req.query.customerId as string);
  if (isNaN(customerId)) { res.status(400).json({ error: "customerId required" }); return; }
  try {
    const rows = await db
      .select({ listingId: customerFavoritesTable.listingId })
      .from(customerFavoritesTable)
      .where(eq(customerFavoritesTable.customerId, customerId));
    res.json(rows.map(r => r.listingId));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

// POST /api/marketplace/favorites/:listingId — add to favorites
router.post("/marketplace/favorites/:listingId", async (req, res) => {
  const listingId = parseInt(req.params.listingId);
  const { customerId } = req.body as { customerId?: number };
  if (isNaN(listingId) || !customerId) { res.status(400).json({ error: "listingId and customerId required" }); return; }
  try {
    await db.insert(customerFavoritesTable)
      .values({ customerId, listingId })
      .onConflictDoNothing();
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customerFavoritesTable)
      .where(eq(customerFavoritesTable.customerId, customerId));
    res.json({ success: true, count });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to add favorite" });
  }
});

// DELETE /api/marketplace/favorites/:listingId?customerId=X — remove from favorites
router.delete("/marketplace/favorites/:listingId", async (req, res) => {
  const listingId = parseInt(req.params.listingId);
  const customerId = parseInt(req.query.customerId as string);
  if (isNaN(listingId) || isNaN(customerId)) { res.status(400).json({ error: "listingId and customerId required" }); return; }
  try {
    await db.delete(customerFavoritesTable)
      .where(and(
        eq(customerFavoritesTable.customerId, customerId),
        eq(customerFavoritesTable.listingId, listingId),
      ));
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customerFavoritesTable)
      .where(eq(customerFavoritesTable.customerId, customerId));
    res.json({ success: true, count });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to remove favorite" });
  }
});

// GET /api/marketplace/favorites/listings?customerId=X — return full listing objects for all favorites
router.get("/marketplace/favorites/listings", async (req, res) => {
  const customerId = parseInt(req.query.customerId as string);
  const preview = isPreview(req);
  if (isNaN(customerId)) { res.status(400).json({ error: "customerId required" }); return; }
  try {
    const favRows = await db
      .select({ listingId: customerFavoritesTable.listingId })
      .from(customerFavoritesTable)
      .where(eq(customerFavoritesTable.customerId, customerId));

    if (!favRows.length) { res.json([]); return; }
    const listingIds = favRows.map(r => r.listingId);

    const rows = await db
      .select({
        listing: listingsTable,
        tenant: { id: tenantsTable.id, slug: tenantsTable.slug, name: tenantsTable.name, status: tenantsTable.status },
        business: {
          name: businessProfileTable.name,
          logoUrl: businessProfileTable.logoUrl,
          primaryColor: businessProfileTable.primaryColor,
          accentColor: businessProfileTable.accentColor,
          city: businessProfileTable.city,
          state: businessProfileTable.state,
          location: businessProfileTable.location,
        },
        category: { id: categoriesTable.id, name: categoriesTable.name, slug: categoriesTable.slug, icon: categoriesTable.icon },
      })
      .from(listingsTable)
      .innerJoin(tenantsTable, eq(listingsTable.tenantId, tenantsTable.id))
      .leftJoin(businessProfileTable, eq(businessProfileTable.tenantId, tenantsTable.id))
      .leftJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
      .where(and(
        inArray(listingsTable.id, listingIds),
        eq(tenantsTable.status, "active"),
        ...(preview ? [] : [eq(tenantsTable.testMode, false)]),
      ));

    res.json(rows.map(r => ({
      ...r.listing,
      tenantSlug: r.tenant.slug,
      tenantName: r.tenant.name,
      businessName: r.business?.name ?? r.tenant.name,
      businessLogoUrl: r.business?.logoUrl ?? null,
      businessPrimaryColor: r.business?.primaryColor ?? "#2d6a4f",
      businessAccentColor: r.business?.accentColor ?? "#52b788",
      businessCity: r.business?.city ?? null,
      businessState: r.business?.state ?? null,
      businessLocation: r.business?.location ?? null,
      categoryName: r.category?.name ?? null,
      categorySlug: r.category?.slug ?? null,
      categoryIcon: r.category?.icon ?? null,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch favorite listings" });
  }
});

export default router;
