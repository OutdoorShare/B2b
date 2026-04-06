import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  listingsTable,
  tenantsTable,
  businessProfileTable,
  categoriesTable,
  customersTable,
  bookingsTable,
  hostBundlesTable,
} from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import { getStripeForTenant } from "../services/stripe";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

const router: IRouter = Router();

// ── Auth middleware ────────────────────────────────────────────────────────────
// Reads X-Customer-Id header and looks up the associated host tenant.
// Attaches req.hostCustomerId and req.hostTenantId to the request.
declare global {
  namespace Express {
    interface Request {
      hostCustomerId?: number;
      hostTenantId?: number;
    }
  }
}

async function requireHostAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const rawId = req.headers["x-customer-id"];
  if (!rawId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const customerId = parseInt(String(rawId));
  if (isNaN(customerId)) {
    res.status(401).json({ error: "Invalid customer ID" });
    return;
  }
  const tenant = await db
    .select({ id: tenantsTable.id })
    .from(tenantsTable)
    .where(and(eq(tenantsTable.isHost, true), eq(tenantsTable.hostCustomerId, customerId)))
    .limit(1);

  if (!tenant[0]) {
    res.status(403).json({ error: "Host account not found" });
    return;
  }
  req.hostCustomerId = customerId;
  req.hostTenantId = tenant[0].id;
  next();
}

// ── POST /api/host/become ─────────────────────────────────────────────────────
// Create a host micro-tenant for a logged-in marketplace customer.
router.post("/host/become", async (req, res) => {
  try {
    const rawId = req.headers["x-customer-id"];
    if (!rawId) { res.status(401).json({ error: "Authentication required" }); return; }
    const customerId = parseInt(String(rawId));
    if (isNaN(customerId)) { res.status(401).json({ error: "Invalid customer ID" }); return; }

    const customer = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, customerId))
      .limit(1);
    if (!customer[0]) { res.status(404).json({ error: "Customer not found" }); return; }

    const existing = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(and(eq(tenantsTable.isHost, true), eq(tenantsTable.hostCustomerId, customerId)))
      .limit(1);
    if (existing[0]) {
      res.status(409).json({ error: "Host account already exists" });
      return;
    }

    const c = customer[0];
    const slug = `host-${customerId}`;
    const syntheticEmail = `host-${customerId}@outdoorshare.internal`;
    const randomPassword = await hashPassword(Math.random().toString(36) + Date.now());

    const { displayName, city, state } = req.body as {
      displayName?: string;
      city?: string;
      state?: string;
    };

    const [newTenant] = await db
      .insert(tenantsTable)
      .values({
        name: displayName || `${c.name}'s Rentals`,
        slug,
        email: syntheticEmail,
        adminPasswordHash: randomPassword,
        plan: "starter",
        status: "active",
        testMode: false,
        emailVerified: true,
        isHost: true,
        hostCustomerId: customerId,
        maxListings: 20,
        platformFeePercent: "20", // OutdoorShare keeps 20% of rental subtotal + full protection fee
      })
      .returning();

    await db.insert(businessProfileTable).values({
      tenantId: newTenant.id,
      name: displayName || `${c.name}'s Rentals`,
      email: c.email,
      city: city || c.billingCity,
      state: state || c.billingState,
      primaryColor: "#2d6a4f",
      accentColor: "#52b788",
    });

    res.status(201).json({
      hostTenantId: newTenant.id,
      slug: newTenant.slug,
      name: newTenant.name,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create host account" });
  }
});

// ── GET /api/host/me ──────────────────────────────────────────────────────────
router.get("/host/me", requireHostAuth, async (req, res) => {
  try {
    const tenant = await db
      .select({
        id: tenantsTable.id,
        slug: tenantsTable.slug,
        name: tenantsTable.name,
        business: {
          name: businessProfileTable.name,
          city: businessProfileTable.city,
          state: businessProfileTable.state,
          description: businessProfileTable.description,
          logoUrl: businessProfileTable.logoUrl,
          phone: businessProfileTable.phone,
          website: businessProfileTable.website,
        },
      })
      .from(tenantsTable)
      .leftJoin(businessProfileTable, eq(businessProfileTable.tenantId, tenantsTable.id))
      .where(eq(tenantsTable.id, req.hostTenantId!))
      .limit(1);

    if (!tenant[0]) { res.status(404).json({ error: "Host not found" }); return; }
    res.json(tenant[0]);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch host info" });
  }
});

// ── GET /api/host/stats ───────────────────────────────────────────────────────
router.get("/host/stats", requireHostAuth, async (req, res) => {
  try {
    const tenantId = req.hostTenantId!;

    const [listingStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${listingsTable.status} = 'active')::int`,
      })
      .from(listingsTable)
      .where(eq(listingsTable.tenantId, tenantId));

    const [bookingStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${bookingsTable.status} = 'pending')::int`,
        confirmed: sql<number>`count(*) filter (where ${bookingsTable.status} = 'confirmed')::int`,
        totalRevenue: sql<string>`coalesce(sum(${bookingsTable.totalPrice}), 0)::text`,
      })
      .from(bookingsTable)
      .where(eq(bookingsTable.tenantId, tenantId));

    res.json({
      listings: listingStats,
      bookings: bookingStats,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ── GET /api/host/listings ────────────────────────────────────────────────────
router.get("/host/listings", requireHostAuth, async (req, res) => {
  try {
    const rows = await db
      .select({
        id: listingsTable.id,
        title: listingsTable.title,
        description: listingsTable.description,
        status: listingsTable.status,
        pricePerDay: listingsTable.pricePerDay,
        imageUrls: listingsTable.imageUrls,
        location: listingsTable.location,
        quantity: listingsTable.quantity,
        condition: listingsTable.condition,
        brand: listingsTable.brand,
        model: listingsTable.model,
        categoryId: listingsTable.categoryId,
        categoryName: categoriesTable.name,
        createdAt: listingsTable.createdAt,
      })
      .from(listingsTable)
      .leftJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
      .where(eq(listingsTable.tenantId, req.hostTenantId!))
      .orderBy(desc(listingsTable.createdAt));

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch listings" });
  }
});

// ── POST /api/host/listings ───────────────────────────────────────────────────
router.post("/host/listings", requireHostAuth, async (req, res) => {
  try {
    const {
      title, description, categoryId, pricePerDay, weekendPrice, pricePerWeek,
      depositAmount, halfDayEnabled, halfDayRate, quantity, imageUrls,
      location, condition, brand, model, includedItems, requirements,
      status,
    } = req.body;

    if (!title || !description || !pricePerDay) {
      res.status(400).json({ error: "title, description, and pricePerDay are required" });
      return;
    }

    const [listing] = await db
      .insert(listingsTable)
      .values({
        tenantId: req.hostTenantId!,
        title,
        description,
        categoryId: categoryId ? Number(categoryId) : null,
        pricePerDay: String(pricePerDay),
        weekendPrice: weekendPrice ? String(weekendPrice) : null,
        pricePerWeek: pricePerWeek ? String(pricePerWeek) : null,
        depositAmount: depositAmount ? String(depositAmount) : null,
        halfDayEnabled: !!halfDayEnabled,
        halfDayRate: halfDayRate ? String(halfDayRate) : null,
        quantity: quantity ? Number(quantity) : 1,
        imageUrls: imageUrls ?? [],
        location: location ?? null,
        condition: condition ?? null,
        brand: brand ?? null,
        model: model ?? null,
        includedItems: includedItems ?? [],
        requirements: requirements ?? null,
        status: status ?? "active",
      })
      .returning();

    res.status(201).json(listing);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create listing" });
  }
});

// ── PUT /api/host/listings/:id ────────────────────────────────────────────────
router.put("/host/listings/:id", requireHostAuth, async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    const existing = await db
      .select({ id: listingsTable.id })
      .from(listingsTable)
      .where(and(eq(listingsTable.id, listingId), eq(listingsTable.tenantId, req.hostTenantId!)))
      .limit(1);

    if (!existing[0]) { res.status(404).json({ error: "Listing not found" }); return; }

    const {
      title, description, categoryId, pricePerDay, weekendPrice, pricePerWeek,
      depositAmount, halfDayEnabled, halfDayRate, quantity, imageUrls,
      location, condition, brand, model, includedItems, requirements, status,
    } = req.body;

    const [updated] = await db
      .update(listingsTable)
      .set({
        title, description,
        categoryId: categoryId ? Number(categoryId) : null,
        pricePerDay: pricePerDay ? String(pricePerDay) : undefined,
        weekendPrice: weekendPrice ? String(weekendPrice) : null,
        pricePerWeek: pricePerWeek ? String(pricePerWeek) : null,
        depositAmount: depositAmount ? String(depositAmount) : null,
        halfDayEnabled: halfDayEnabled !== undefined ? !!halfDayEnabled : undefined,
        halfDayRate: halfDayRate ? String(halfDayRate) : null,
        quantity: quantity ? Number(quantity) : undefined,
        imageUrls: imageUrls ?? undefined,
        location: location ?? null,
        condition: condition ?? null,
        brand: brand ?? null,
        model: model ?? null,
        includedItems: includedItems ?? undefined,
        requirements: requirements ?? null,
        status: status ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(listingsTable.id, listingId))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update listing" });
  }
});

// ── DELETE /api/host/listings/:id ─────────────────────────────────────────────
router.delete("/host/listings/:id", requireHostAuth, async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    const existing = await db
      .select({ id: listingsTable.id })
      .from(listingsTable)
      .where(and(eq(listingsTable.id, listingId), eq(listingsTable.tenantId, req.hostTenantId!)))
      .limit(1);

    if (!existing[0]) { res.status(404).json({ error: "Listing not found" }); return; }

    await db.delete(listingsTable).where(eq(listingsTable.id, listingId));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete listing" });
  }
});

// ── GET /api/host/bookings ────────────────────────────────────────────────────
router.get("/host/bookings", requireHostAuth, async (req, res) => {
  try {
    const bookings = await db
      .select({
        booking: bookingsTable,
        listing: {
          id: listingsTable.id,
          title: listingsTable.title,
          imageUrls: listingsTable.imageUrls,
        },
      })
      .from(bookingsTable)
      .leftJoin(listingsTable, eq(bookingsTable.listingId, listingsTable.id))
      .where(eq(bookingsTable.tenantId, req.hostTenantId!))
      .orderBy(desc(bookingsTable.createdAt))
      .limit(200);

    res.json(bookings.map(r => ({
      ...r.booking,
      listingTitle: r.listing?.title ?? "Unknown",
      listingImage: (r.listing?.imageUrls as string[] | null)?.[0] ?? null,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// ── PATCH /api/host/bookings/:id/status ──────────────────────────────────────
router.patch("/host/bookings/:id/status", requireHostAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body as { status?: string };
    const allowed = ["pending", "confirmed", "active", "completed", "cancelled"];
    if (!status || !allowed.includes(status)) {
      return void res.status(400).json({ error: "Invalid status" });
    }

    const [updated] = await db
      .update(bookingsTable)
      .set({ status })
      .where(and(eq(bookingsTable.id, id), eq(bookingsTable.tenantId, req.hostTenantId!)))
      .returning({ id: bookingsTable.id });

    if (!updated) return void res.status(404).json({ error: "Booking not found" });
    res.json({ id: updated.id, status });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update booking status" });
  }
});

// ── PUT /api/host/settings ────────────────────────────────────────────────────
router.put("/host/settings", requireHostAuth, async (req, res) => {
  try {
    const { displayName, description, city, state, phone, website, logoUrl, coverImageUrl } = req.body;

    await db
      .update(businessProfileTable)
      .set({
        name: displayName,
        description,
        city,
        state,
        phone,
        website,
        ...(logoUrl !== undefined ? { logoUrl } : {}),
        ...(coverImageUrl !== undefined ? { coverImageUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(businessProfileTable.tenantId, req.hostTenantId!));

    if (displayName) {
      await db
        .update(tenantsTable)
        .set({ name: displayName, updatedAt: new Date() })
        .where(eq(tenantsTable.id, req.hostTenantId!));
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// ── GET /api/host/bundles ─────────────────────────────────────────────────────
router.get("/host/bundles", requireHostAuth, async (req, res) => {
  try {
    const bundles = await db
      .select()
      .from(hostBundlesTable)
      .where(eq(hostBundlesTable.tenantId, req.hostTenantId!))
      .orderBy(desc(hostBundlesTable.createdAt));
    res.json(bundles);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch bundles" });
  }
});

// ── POST /api/host/bundles ────────────────────────────────────────────────────
router.post("/host/bundles", requireHostAuth, async (req, res) => {
  try {
    const { name, description, coverImageUrl, pricePerDay, listingIds, discountPercent } = req.body as {
      name: string;
      description?: string;
      coverImageUrl?: string;
      pricePerDay: string | number;
      listingIds: number[];
      discountPercent?: string | number;
    };
    if (!name || !pricePerDay) {
      res.status(400).json({ error: "name and pricePerDay are required" });
      return;
    }
    const [bundle] = await db
      .insert(hostBundlesTable)
      .values({
        tenantId: req.hostTenantId!,
        name,
        description: description ?? null,
        coverImageUrl: coverImageUrl ?? null,
        pricePerDay: String(pricePerDay),
        listingIds: listingIds ?? [],
        discountPercent: String(discountPercent ?? "0"),
        isActive: true,
      })
      .returning();
    res.status(201).json(bundle);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create bundle" });
  }
});

// ── PUT /api/host/bundles/:id ─────────────────────────────────────────────────
router.put("/host/bundles/:id", requireHostAuth, async (req, res) => {
  try {
    const bundleId = parseInt(req.params.id);
    const { name, description, coverImageUrl, pricePerDay, listingIds, discountPercent, isActive } = req.body;
    const [bundle] = await db
      .update(hostBundlesTable)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(coverImageUrl !== undefined ? { coverImageUrl } : {}),
        ...(pricePerDay !== undefined ? { pricePerDay: String(pricePerDay) } : {}),
        ...(listingIds !== undefined ? { listingIds } : {}),
        ...(discountPercent !== undefined ? { discountPercent: String(discountPercent) } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(hostBundlesTable.id, bundleId), eq(hostBundlesTable.tenantId, req.hostTenantId!)))
      .returning();
    if (!bundle) { res.status(404).json({ error: "Bundle not found" }); return; }
    res.json(bundle);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update bundle" });
  }
});

// ── DELETE /api/host/bundles/:id ──────────────────────────────────────────────
router.delete("/host/bundles/:id", requireHostAuth, async (req, res) => {
  try {
    const bundleId = parseInt(req.params.id);
    await db
      .delete(hostBundlesTable)
      .where(and(eq(hostBundlesTable.id, bundleId), eq(hostBundlesTable.tenantId, req.hostTenantId!)));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete bundle" });
  }
});

// ── HOST STRIPE CONNECT ───────────────────────────────────────────────────────

// POST /api/host/stripe/connect — start or resume Stripe Express onboarding
router.post("/host/stripe/connect", requireHostAuth, async (req, res) => {
  try {
    const tenant = await db.query.tenantsTable.findFirst({
      where: eq(tenantsTable.id, req.hostTenantId!),
    });
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

    const stripeClient = getStripeForTenant(!!tenant.testMode);
    const protocol = req.protocol;
    const host = req.get("host");
    const returnUrl = `${protocol}://${host}/marketplace/host/settings?stripe=connected`;
    const refreshUrl = `${protocol}://${host}/marketplace/host/settings?stripe=refresh`;

    let accountId = tenant.stripeAccountId;
    if (!accountId) {
      const account = await stripeClient.accounts.create({
        type: "express",
        email: tenant.email ?? undefined,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        business_type: "individual",
        metadata: { tenant_id: String(tenant.id), tenant_slug: tenant.slug, is_host: "true" },
      });
      accountId = account.id;
      await db.update(tenantsTable).set({
        stripeAccountId: accountId,
        stripeAccountStatus: "onboarding",
      }).where(eq(tenantsTable.id, tenant.id));
    }

    const accountLink = await stripeClient.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    res.json({ url: accountLink.url });
  } catch (e: any) {
    req.log.error(e, "[host/stripe/connect]");
    res.status(500).json({ error: e.message });
  }
});

// GET /api/host/stripe/status — check Stripe Connect status
router.get("/host/stripe/status", requireHostAuth, async (req, res) => {
  try {
    const tenant = await db.query.tenantsTable.findFirst({
      where: eq(tenantsTable.id, req.hostTenantId!),
    });
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

    if (!tenant.stripeAccountId) {
      res.json({ connected: false, status: "not_started" });
      return;
    }

    const stripeClient = getStripeForTenant(!!tenant.testMode);
    const account = await stripeClient.accounts.retrieve(tenant.stripeAccountId);
    const chargesEnabled = account.charges_enabled;
    const payoutsEnabled = account.payouts_enabled;

    if (chargesEnabled) {
      await db.update(tenantsTable).set({
        stripeAccountStatus: "active",
        stripeChargesEnabled: chargesEnabled,
        stripePayoutsEnabled: payoutsEnabled,
      }).where(eq(tenantsTable.id, tenant.id));
    }

    // Fetch payout balance if connected
    let balance = null;
    if (chargesEnabled) {
      try {
        const b = await stripeClient.balance.retrieve({ stripeAccount: tenant.stripeAccountId });
        balance = {
          available: (b.available[0]?.amount ?? 0) / 100,
          pending: (b.pending[0]?.amount ?? 0) / 100,
          currency: b.available[0]?.currency?.toUpperCase() ?? "USD",
        };
      } catch { /* balance not available yet */ }
    }

    res.json({
      connected: chargesEnabled,
      status: chargesEnabled ? "active" : "onboarding",
      chargesEnabled,
      payoutsEnabled,
      accountId: tenant.stripeAccountId,
      balance,
      feePercent: parseFloat(tenant.platformFeePercent ?? "20"),
    });
  } catch (e: any) {
    req.log.error(e, "[host/stripe/status]");
    res.status(500).json({ error: e.message });
  }
});

// GET /api/host/stripe/dashboard — Stripe Express dashboard login link
router.get("/host/stripe/dashboard", requireHostAuth, async (req, res) => {
  try {
    const tenant = await db.query.tenantsTable.findFirst({
      where: eq(tenantsTable.id, req.hostTenantId!),
    });
    if (!tenant?.stripeAccountId) {
      res.status(400).json({ error: "No Stripe account connected" }); return;
    }
    const stripeClient = getStripeForTenant(!!tenant.testMode);
    const link = await stripeClient.accounts.createLoginLink(tenant.stripeAccountId);
    res.json({ url: link.url });
  } catch (e: any) {
    req.log.error(e, "[host/stripe/dashboard]");
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/host/categories ──────────────────────────────────────────────────
router.get("/host/categories", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: sql<number>`min(${categoriesTable.id})::int`,
        name: categoriesTable.name,
        slug: categoriesTable.slug,
      })
      .from(categoriesTable)
      .groupBy(categoriesTable.name, categoriesTable.slug)
      .orderBy(categoriesTable.name);
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

export default router;
