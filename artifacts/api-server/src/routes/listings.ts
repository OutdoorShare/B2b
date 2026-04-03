import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { listingsTable, categoriesTable, bookingsTable, blockedDatesTable, listingAddonsTable, productsTable, businessProfileTable, contactCardsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, ilike, or, count, sum, inArray, isNotNull } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// ── Auto-create a linked product for a new listing ───────────────────────────
async function autoCreateProduct(listing: typeof listingsTable.$inferSelect) {
  if (!listing.tenantId) return;
  try {
    const [product] = await db.insert(productsTable).values({
      tenantId: listing.tenantId,
      name: listing.title,
      description: listing.description || null,
      categoryId: listing.categoryId || null,
      quantity: listing.quantity ?? 1,
      imageUrls: Array.isArray(listing.imageUrls) ? listing.imageUrls : [],
      status: "available",
      updatedAt: new Date(),
    }).returning();
    // Link the listing back to the new product
    await db.update(listingsTable)
      .set({ productId: product.id, updatedAt: new Date() })
      .where(eq(listingsTable.id, listing.id));
  } catch {
    // Non-fatal — product auto-creation failure should not break listing creation
  }
}

function formatListing(l: typeof listingsTable.$inferSelect, categoryName?: string | null, categorySlug?: string | null) {
  return {
    ...l,
    categoryName: categoryName ?? null,
    categorySlug: categorySlug ?? null,
    pricePerDay: parseFloat(l.pricePerDay ?? "0"),
    weekendPrice: l.weekendPrice ? parseFloat(l.weekendPrice) : null,
    holidayPrice: l.holidayPrice ? parseFloat(l.holidayPrice) : null,
    pricePerWeek: l.pricePerWeek ? parseFloat(l.pricePerWeek) : null,
    pricePerHour: l.pricePerHour ? parseFloat(l.pricePerHour) : null,
    depositAmount: l.depositAmount ? parseFloat(l.depositAmount) : null,
    halfDayEnabled: l.halfDayEnabled ?? false,
    halfDayDurationHours: l.halfDayDurationHours ?? null,
    halfDayRate: l.halfDayRate ? parseFloat(l.halfDayRate) : null,
    hourlyEnabled: l.hourlyEnabled ?? false,
    hourlySlots: Array.isArray(l.hourlySlots) ? l.hourlySlots : [],
    hourlyPerHourEnabled: l.hourlyPerHourEnabled ?? false,
    hourlyMinimumHours: l.hourlyMinimumHours ?? null,
    timeSlots: Array.isArray(l.timeSlots) ? l.timeSlots : [],
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
    // Require a resolved tenant context. Without it we would leak every tenant's
    // listings to an unauthenticated (or token-expired) caller.
    if (!req.tenantId) {
      res.json([]);
      return;
    }

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

    // Scope categories to this tenant
    const catConditions = req.tenantId ? [eq(categoriesTable.tenantId, req.tenantId)] : [];
    const cats = await db
      .select()
      .from(categoriesTable)
      .where(catConditions.length > 0 ? and(...catConditions) : undefined);
    const catMap = Object.fromEntries(cats.map(c => [c.id, { name: c.name, slug: c.slug }]));

    // Scope booking stats to this tenant
    const statsConditions: any[] = [sql`${bookingsTable.status} != 'cancelled'`];
    if (req.tenantId) statsConditions.push(eq(bookingsTable.tenantId, req.tenantId));
    const bookingStats = await db
      .select({
        listingId: bookingsTable.listingId,
        totalBookings: count(),
        totalRevenue: sum(bookingsTable.totalPrice),
      })
      .from(bookingsTable)
      .where(and(...statsConditions))
      .groupBy(bookingsTable.listingId);

    const statsMap = Object.fromEntries(
      bookingStats.map(s => [s.listingId, { totalBookings: Number(s.totalBookings), totalRevenue: parseFloat(s.totalRevenue ?? "0") }])
    );

    // Find which listings have a protection plan addon
    const listingIds = listings.map(l => l.id);
    const protectionAddonRows = listingIds.length > 0
      ? await db
          .select({ listingId: listingAddonsTable.listingId })
          .from(listingAddonsTable)
          .where(and(
            inArray(listingAddonsTable.listingId, listingIds),
            sql`lower(${listingAddonsTable.name}) like '%protection%'`,
            eq(listingAddonsTable.isActive, true)
          ))
      : [];
    const protectionListingIds = new Set(protectionAddonRows.map(r => r.listingId));

    const result = listings.map(l => ({
      ...formatListing(l, catMap[l.categoryId ?? -1]?.name, catMap[l.categoryId ?? -1]?.slug),
      totalBookings: statsMap[l.id]?.totalBookings ?? 0,
      totalRevenue: statsMap[l.id]?.totalRevenue ?? 0,
      hasProtectionPlan: protectionListingIds.has(l.id),
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
    const depositNum = body.depositAmount != null ? parseFloat(body.depositAmount) : null;
    if (!depositNum || depositNum <= 0) {
      res.status(400).json({ error: "A security deposit greater than $0 is required for all listings." });
      return;
    }
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

    // Auto-create an inventory product for this listing (fire-and-forget, non-fatal)
    autoCreateProduct(created);

    res.status(201).json(formatListing(created));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create listing" });
  }
});

// Bulk import: POST /api/listings/bulk
// Accepts an array of listing objects; returns created count + any per-row errors.
router.post("/listings/bulk", async (req, res) => {
  try {
    const rows: any[] = Array.isArray(req.body) ? req.body : [];
    if (rows.length === 0) {
      res.status(400).json({ error: "No rows provided" });
      return;
    }
    if (rows.length > 500) {
      res.status(400).json({ error: "Maximum 500 rows per import" });
      return;
    }

    // Build category name → id map scoped to this tenant
    const catConditions = req.tenantId ? [eq(categoriesTable.tenantId, req.tenantId)] : [];
    const cats = await db
      .select()
      .from(categoriesTable)
      .where(catConditions.length > 0 ? and(...catConditions) : undefined);
    const catByName: Record<string, number> = {};
    const catBySlug: Record<string, number> = {};
    for (const c of cats) {
      catByName[c.name.toLowerCase()] = c.id;
      catBySlug[c.slug.toLowerCase()] = c.id;
    }

    const created: any[] = [];
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      if (!row.title?.trim()) {
        errors.push({ row: rowNum, error: "Title is required" });
        continue;
      }
      if (!row.description?.trim()) {
        errors.push({ row: rowNum, error: "Description is required" });
        continue;
      }
      const price = parseFloat(row.pricePerDay);
      if (isNaN(price) || price < 0) {
        errors.push({ row: rowNum, error: "price_per_day must be a valid number" });
        continue;
      }

      // Resolve category: accept name or slug
      let categoryId: number | null = null;
      if (row.category) {
        const key = String(row.category).toLowerCase().trim();
        categoryId = catByName[key] ?? catBySlug[key] ?? null;
      }

      // Validate enum fields
      const validStatus = ["active", "inactive", "draft"];
      const status = validStatus.includes(row.status) ? row.status : "active";

      const validCondition = ["excellent", "good", "fair"];
      const condition = validCondition.includes(row.condition) ? row.condition : "good";

      try {
        const [newListing] = await db.insert(listingsTable).values({
          tenantId: req.tenantId ?? null,
          title: row.title.trim(),
          description: row.description.trim(),
          categoryId,
          status,
          pricePerDay: String(price),
          pricePerWeek: row.pricePerWeek != null && row.pricePerWeek !== "" ? String(parseFloat(row.pricePerWeek)) : null,
          pricePerHour: row.pricePerHour != null && row.pricePerHour !== "" ? String(parseFloat(row.pricePerHour)) : null,
          depositAmount: row.depositAmount != null && row.depositAmount !== "" ? String(parseFloat(row.depositAmount)) : null,
          quantity: row.quantity != null ? parseInt(row.quantity) || 1 : 1,
          location: row.location?.trim() || null,
          weight: row.weight?.trim() || null,
          dimensions: row.dimensions?.trim() || null,
          brand: row.brand?.trim() || null,
          model: row.model?.trim() || null,
          condition,
          requirements: row.requirements?.trim() || null,
          ageRestriction: row.ageRestriction != null && row.ageRestriction !== "" ? parseInt(row.ageRestriction) || null : null,
          imageUrls: [],
          includedItems: row.includedItems
            ? String(row.includedItems).split(",").map((s: string) => s.trim()).filter(Boolean)
            : [],
        }).returning();
        // Auto-create inventory product for bulk-imported listings too
        autoCreateProduct(newListing);
        created.push(formatListing(newListing));
      } catch (rowErr: any) {
        errors.push({ row: rowNum, error: rowErr?.message ?? "Insert failed" });
      }
    }

    res.status(207).json({
      created: created.length,
      errors,
      total: rows.length,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Bulk import failed" });
  }
});

// GET /api/listings/addresses — distinct pickup addresses + business address for this tenant
router.get("/listings/addresses", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

    const rows = await db
      .selectDistinct({ location: listingsTable.location })
      .from(listingsTable)
      .where(and(eq(listingsTable.tenantId, tenantId), isNotNull(listingsTable.location)))
      .limit(100);

    const usedAddresses = rows
      .map(r => r.location?.trim())
      .filter((v): v is string => !!v);

    const [biz] = await db
      .select()
      .from(businessProfileTable)
      .where(eq(businessProfileTable.tenantId, tenantId))
      .limit(1);

    const businessAddress = biz
      ? [biz.address, biz.city, biz.state, biz.zipCode].filter(Boolean).join(", ") || null
      : null;

    return res.json({ usedAddresses, businessAddress });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to fetch addresses" });
  }
});

router.get("/listings/:id", async (req, res) => {
  try {
    const conditions = [eq(listingsTable.id, Number(req.params.id))];
    if (req.tenantId) conditions.push(eq(listingsTable.tenantId, req.tenantId));
    const [listing] = await db.select().from(listingsTable).where(and(...conditions));
    if (!listing) { res.status(404).json({ error: "Not found" }); return; }

    let categoryName: string | null = null;
    let categorySlug: string | null = null;
    if (listing.categoryId) {
      const catConditions = [eq(categoriesTable.id, listing.categoryId)];
      if (req.tenantId) catConditions.push(eq(categoriesTable.tenantId, req.tenantId));
      const [cat] = await db.select().from(categoriesTable).where(and(...catConditions));
      categoryName = cat?.name ?? null;
      categorySlug = cat?.slug ?? null;
    }

    const statsConditions = [
      eq(bookingsTable.listingId, listing.id),
      sql`${bookingsTable.status} != 'cancelled'`,
    ];
    if (req.tenantId) statsConditions.push(eq(bookingsTable.tenantId, req.tenantId) as any);
    const [stats] = await db
      .select({ totalBookings: count(), totalRevenue: sum(bookingsTable.totalPrice) })
      .from(bookingsTable)
      .where(and(...statsConditions));

    // Include contact card if assigned
    let contactCard: { id: number; name: string; address: string | null; phone: string | null; email: string | null; specialInstructions: string | null } | null = null;
    if (listing.contactCardId) {
      const [cc] = await db.select({
        id: contactCardsTable.id,
        name: contactCardsTable.name,
        address: contactCardsTable.address,
        phone: contactCardsTable.phone,
        email: contactCardsTable.email,
        specialInstructions: contactCardsTable.specialInstructions,
      }).from(contactCardsTable).where(eq(contactCardsTable.id, listing.contactCardId));
      contactCard = cc ?? null;
    }

    res.json({
      ...formatListing(listing, categoryName, categorySlug),
      totalBookings: Number(stats?.totalBookings ?? 0),
      totalRevenue: parseFloat(stats?.totalRevenue ?? "0"),
      contactCard,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch listing" });
  }
});

// Returns booked + admin-blocked date ranges for a listing (storefront use)
router.get("/listings/:id/booked-dates", async (req, res) => {
  try {
    const listingId = Number(req.params.id);

    // Confirmed/pending bookings
    const bookingConditions = [
      eq(bookingsTable.listingId, listingId),
      sql`${bookingsTable.status} NOT IN ('cancelled', 'rejected')`,
    ];
    if (req.tenantId) bookingConditions.push(eq(bookingsTable.tenantId, req.tenantId) as any);
    const bookings = await db
      .select({ startDate: bookingsTable.startDate, endDate: bookingsTable.endDate, quantity: bookingsTable.quantity })
      .from(bookingsTable)
      .where(and(...bookingConditions));

    // Admin-blocked dates (for this listing OR global blocks with no listing)
    const blockConditions: any[] = [];
    if (req.tenantId) {
      blockConditions.push(
        eq(blockedDatesTable.tenantId, req.tenantId),
        sql`(${blockedDatesTable.listingId} IS NULL OR ${blockedDatesTable.listingId} = ${listingId})`
      );
    } else {
      blockConditions.push(eq(blockedDatesTable.listingId, listingId));
    }
    const blocked = await db
      .select({ startDate: blockedDatesTable.startDate, endDate: blockedDatesTable.endDate })
      .from(blockedDatesTable)
      .where(and(...blockConditions));

    // Fetch listing quantity (total units available)
    const productBlocks: { start: string; end: string; type: string }[] = [];
    const [listing] = await db
      .select({ productId: listingsTable.productId, quantity: listingsTable.quantity })
      .from(listingsTable)
      .where(eq(listingsTable.id, listingId))
      .limit(1);
    const listingQuantity = listing?.quantity ?? 1;

    if (listing?.productId) {
      const [product] = await db
        .select({ serviceUntil: productsTable.serviceUntil, status: productsTable.status })
        .from(productsTable)
        .where(eq(productsTable.id, listing.productId))
        .limit(1);
      if (product?.serviceUntil && product.status !== "available") {
        const today = new Date().toISOString().split("T")[0];
        if (product.serviceUntil >= today) {
          productBlocks.push({ start: today, end: product.serviceUntil, type: "service" });
        }
      }
    }

    res.json({
      listingQuantity,
      ranges: [
        ...bookings.map(b => ({ start: b.startDate, end: b.endDate, type: "booking", quantity: b.quantity ?? 1 })),
        ...blocked.map(b => ({ start: b.startDate, end: b.endDate, type: "blocked", quantity: listingQuantity })),
        ...productBlocks.map(b => ({ ...b, quantity: listingQuantity })),
      ],
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch availability" });
  }
});

// ── Admin: manage blocked dates ───────────────────────────────────────────────

// GET all blocked date ranges for a listing (admin)
router.get("/listings/:id/blocked-dates", async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    const conditions: any[] = [eq(blockedDatesTable.listingId, listingId)];
    if (req.tenantId) conditions.push(eq(blockedDatesTable.tenantId, req.tenantId));
    const blocks = await db.select().from(blockedDatesTable).where(and(...conditions))
      .orderBy(blockedDatesTable.startDate);
    res.json(blocks);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch blocked dates" });
  }
});

// POST create a blocked date range (admin)
router.post("/listings/:id/blocked-dates", async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const listingId = Number(req.params.id);
    const { startDate, endDate, reason } = req.body;
    if (!startDate || !endDate) { res.status(400).json({ error: "startDate and endDate required" }); return; }
    const [created] = await db.insert(blockedDatesTable).values({
      tenantId: req.tenantId,
      listingId,
      startDate,
      endDate,
      reason: reason || null,
    }).returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create blocked date" });
  }
});

// DELETE a blocked date range (admin)
router.delete("/listings/blocked-dates/:blockId", async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const blockId = Number(req.params.blockId);
    const conditions: any[] = [eq(blockedDatesTable.id, blockId)];
    if (req.tenantId) conditions.push(eq(blockedDatesTable.tenantId, req.tenantId));
    await db.delete(blockedDatesTable).where(and(...conditions));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete blocked date" });
  }
});

router.put("/listings/:id", async (req, res) => {
  try {
    const body = req.body;
    const updateData: Record<string, any> = { ...body, updatedAt: new Date() };
    if (body.pricePerDay !== undefined) updateData.pricePerDay = String(body.pricePerDay);
    if (body.weekendPrice !== undefined) updateData.weekendPrice = body.weekendPrice != null ? String(body.weekendPrice) : null;
    if (body.holidayPrice !== undefined) updateData.holidayPrice = body.holidayPrice != null ? String(body.holidayPrice) : null;
    if (body.pricePerWeek !== undefined) updateData.pricePerWeek = body.pricePerWeek != null ? String(body.pricePerWeek) : null;
    if (body.pricePerHour !== undefined) updateData.pricePerHour = body.pricePerHour != null ? String(body.pricePerHour) : null;
    if (body.depositAmount !== undefined) updateData.depositAmount = body.depositAmount != null ? String(body.depositAmount) : null;
    if (body.halfDayRate !== undefined) updateData.halfDayRate = body.halfDayRate != null ? String(body.halfDayRate) : null;

    const whereConditions = [eq(listingsTable.id, Number(req.params.id))];
    if (req.tenantId) whereConditions.push(eq(listingsTable.tenantId, req.tenantId));
    const [updated] = await db
      .update(listingsTable)
      .set(updateData)
      .where(and(...whereConditions))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }

    // Sync linked product fields — if no product linked yet, auto-create one
    if (updated.productId) {
      db.update(productsTable).set({
        ...(body.title !== undefined && { name: body.title }),
        ...(body.quantity !== undefined && { quantity: body.quantity }),
        ...(body.imageUrls !== undefined && { imageUrls: body.imageUrls }),
        ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
        ...(body.description !== undefined && { description: body.description }),
        updatedAt: new Date(),
      }).where(eq(productsTable.id, updated.productId)).execute().catch(() => {});
    } else if (updated.tenantId) {
      autoCreateProduct(updated);
    }

    res.json(formatListing(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update listing" });
  }
});

router.delete("/listings/:id", async (req, res) => {
  try {
    const whereConditions = [eq(listingsTable.id, Number(req.params.id))];
    if (req.tenantId) whereConditions.push(eq(listingsTable.tenantId, req.tenantId));
    await db.delete(listingsTable).where(and(...whereConditions));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete listing" });
  }
});

export default router;
