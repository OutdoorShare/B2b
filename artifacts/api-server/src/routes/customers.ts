import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customersTable, bookingsTable, tenantsTable, businessProfileTable, listingsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { sendCredentialsEmail } from "../services/gmail";
import { getStripeForTenant } from "../services/stripe";

const scryptAsync = promisify(scrypt);
const router: IRouter = Router();

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  const hashBuffer = Buffer.from(hash, "hex");
  const supplied = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(hashBuffer, supplied);
}

function safeCustomer(c: typeof customersTable.$inferSelect) {
  const { passwordHash: _, ...safe } = c;
  return {
    ...safe,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.post("/customers/register", async (req, res) => {
  try {
    const { email, password, name, phone, slug } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: "email, password and name are required" });
      return;
    }

    const tenantSlug = (slug ?? "").trim().toLowerCase();
    const normalEmail = email.toLowerCase().trim();

    // Check uniqueness across all tenants (accounts work cross-tenant)
    const [existing] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.email, normalEmail));

    if (existing) {
      res.status(409).json({ error: "An account with this email already exists. Please sign in instead." });
      return;
    }

    const passwordHash = await hashPassword(password);
    const [customer] = await db
      .insert(customersTable)
      .values({ email: normalEmail, passwordHash, name, phone, tenantSlug })
      .returning();

    res.status(201).json(safeCustomer(customer));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to register" });
  }
});

// ── Set password for an existing (passwordless) customer or create from booking ─
router.post("/customers/set-password", async (req, res) => {
  try {
    const { email, password, tenantSlug: rawSlug } = req.body;
    if (!email || !password || !rawSlug) {
      res.status(400).json({ error: "email, password and tenantSlug are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const tenantSlug = rawSlug.trim().toLowerCase();
    const normalEmail = email.toLowerCase().trim();

    // Check for existing customer record
    const [existing] = await db
      .select()
      .from(customersTable)
      .where(and(eq(customersTable.email, normalEmail), eq(customersTable.tenantSlug, tenantSlug)));

    if (existing) {
      res.status(409).json({ error: "An account already exists for this email. Please sign in." });
      return;
    }

    // Resolve tenant so we can scope the booking lookup
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    // Look up name/phone from the most recent booking for this customer
    const [booking] = await db
      .select({ customerName: bookingsTable.customerName, customerPhone: bookingsTable.customerPhone })
      .from(bookingsTable)
      .where(and(eq(bookingsTable.customerEmail, normalEmail), eq(bookingsTable.tenantId, tenant.id)))
      .orderBy(desc(bookingsTable.id))
      .limit(1);

    const name = booking?.customerName ?? normalEmail.split("@")[0];
    const phone = booking?.customerPhone ?? null;

    const passwordHash = await hashPassword(password);
    const [customer] = await db
      .insert(customersTable)
      .values({ email: normalEmail, passwordHash, name, phone: phone ?? undefined, tenantSlug })
      .returning();

    // Send credentials email in background (fetch company name for branded From)
    (async () => {
      try {
        const [biz] = await db
          .select({ businessName: businessProfileTable.businessName })
          .from(businessProfileTable)
          .where(eq(businessProfileTable.tenantId, tenant.id));
        await sendCredentialsEmail({
          customerName: name,
          customerEmail: normalEmail,
          tenantSlug,
          password,
          companyName: biz?.businessName ?? undefined,
          adminEmail: tenant.email,
        });
      } catch (emailErr) {
        console.warn("Failed to send credentials email", emailErr);
      }
    })();

    res.status(201).json(safeCustomer(customer));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to set password" });
  }
});

router.post("/customers/login", async (req, res) => {
  try {
    const { email, password, slug } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const tenantSlug = (slug ?? "").trim().toLowerCase();
    const normalEmail = email.toLowerCase().trim();

    // Try exact slug match first, then fall back to empty-slug (legacy accounts)
    let customer = (await db
      .select()
      .from(customersTable)
      .where(and(
        eq(customersTable.email, normalEmail),
        eq(customersTable.tenantSlug, tenantSlug),
      )))[0];

    if (!customer) {
      // Legacy accounts created before tenant_slug tracking
      customer = (await db
        .select()
        .from(customersTable)
        .where(and(
          eq(customersTable.email, normalEmail),
          eq(customersTable.tenantSlug, ""),
        )))[0];
    }

    if (!customer) {
      // Cross-tenant: renter accounts work across all companies
      customer = (await db
        .select()
        .from(customersTable)
        .where(eq(customersTable.email, normalEmail))
        .limit(1))[0];
    }

    if (!customer) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await verifyPassword(password, customer.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Backfill tenant_slug if it was empty
    if (!customer.tenantSlug && tenantSlug) {
      await db.update(customersTable)
        .set({ tenantSlug, updatedAt: new Date() })
        .where(eq(customersTable.id, customer.id));
      customer = { ...customer, tenantSlug };
    }

    res.json(safeCustomer(customer));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to login" });
  }
});

router.get("/customers/:id", async (req, res) => {
  try {
    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, Number(req.params.id)));

    if (!customer) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json(safeCustomer(customer));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

// ── Admin: lookup customer identity verification by email ──────────────────────
router.get("/customers/lookup-by-email", async (req, res) => {
  try {
    const email = (req.query.email as string ?? "").toLowerCase().trim();
    if (!email) { res.status(400).json({ error: "email required" }); return; }

    const conditions = [eq(customersTable.email, email)];
    if (req.tenantId) conditions.push(eq(customersTable.tenantId, req.tenantId));

    const [customer] = await db
      .select({
        id: customersTable.id,
        name: customersTable.name,
        email: customersTable.email,
        identityVerificationStatus: customersTable.identityVerificationStatus,
        identityVerificationSessionId: customersTable.identityVerificationSessionId,
        identityVerifiedAt: customersTable.identityVerifiedAt,
      })
      .from(customersTable)
      .where(and(...conditions))
      .limit(1);

    if (!customer) { res.json({ found: false }); return; }
    res.json({
      found: true,
      ...customer,
      identityVerifiedAt: customer.identityVerifiedAt?.toISOString() ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to lookup customer" });
  }
});

router.post("/customers/:id/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "currentPassword and newPassword are required" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" });
      return;
    }
    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, Number(req.params.id)));
    if (!customer) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const valid = await verifyPassword(currentPassword, customer.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    const newHash = await hashPassword(newPassword);
    await db
      .update(customersTable)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(customersTable.id, customer.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// ── Save payment method details after a successful booking ────────────────────
router.post("/customers/:id/save-payment-method", async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    const { paymentIntentId, tenantSlug } = req.body ?? {};
    if (!paymentIntentId || !tenantSlug) {
      res.status(400).json({ error: "paymentIntentId and tenantSlug required" });
      return;
    }

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug)).limit(1);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

    const stripeClient = getStripeForTenant(!!tenant.testMode);

    const pi = await stripeClient.paymentIntents.retrieve(paymentIntentId, {
      expand: ["payment_method"],
    });

    const pm = pi.payment_method as import("stripe").Stripe.PaymentMethod | null;
    const card = pm?.type === "card" ? pm.card : null;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (pi.customer && typeof pi.customer === "string") {
      updateData.stripeCustomerId = pi.customer;
    }
    if (card?.last4) updateData.cardLastFour = card.last4;
    if (card?.brand) updateData.cardBrand = card.brand;

    const [updated] = await db
      .update(customersTable)
      .set(updateData)
      .where(eq(customersTable.id, customerId))
      .returning();

    if (!updated) { res.status(404).json({ error: "Customer not found" }); return; }
    res.json(safeCustomer(updated));
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: err.message ?? "Failed to save payment method" });
  }
});

// ── Admin: list all unique renters for this tenant (aggregated from bookings) ──
router.get("/admin/renters", async (req, res) => {
  if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const rows = await db
      .select({
        email: bookingsTable.customerEmail,
        name: bookingsTable.customerName,
        phone: bookingsTable.customerPhone,
        totalPrice: bookingsTable.totalPrice,
        status: bookingsTable.status,
        createdAt: bookingsTable.createdAt,
      })
      .from(bookingsTable)
      .where(eq(bookingsTable.tenantId, req.tenantId))
      .orderBy(desc(bookingsTable.createdAt));

    // Aggregate by email
    const map = new Map<string, {
      name: string;
      email: string;
      phone: string | null;
      bookingCount: number;
      lifetimeValue: number;
      firstBooking: string;
      lastBooking: string;
    }>();

    for (const row of rows) {
      const key = row.email.toLowerCase().trim();
      const price = row.status === "cancelled" ? 0 : parseFloat(String(row.totalPrice) || "0");
      const ts = row.createdAt.toISOString();
      const existing = map.get(key);
      if (existing) {
        existing.bookingCount++;
        existing.lifetimeValue += price;
        if (ts < existing.firstBooking) existing.firstBooking = ts;
        if (ts > existing.lastBooking) existing.lastBooking = ts;
      } else {
        map.set(key, {
          name: row.name,
          email: key,
          phone: row.phone ?? null,
          bookingCount: 1,
          lifetimeValue: price,
          firstBooking: ts,
          lastBooking: ts,
        });
      }
    }

    res.json([...map.values()]);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch renters" });
  }
});

// ── Admin: full booking history for a specific renter email ───────────────────
router.get("/admin/renters/:email/bookings", async (req, res) => {
  if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase().trim();
    const rows = await db
      .select({
        id: bookingsTable.id,
        listingId: bookingsTable.listingId,
        startDate: bookingsTable.startDate,
        endDate: bookingsTable.endDate,
        totalPrice: bookingsTable.totalPrice,
        status: bookingsTable.status,
        createdAt: bookingsTable.createdAt,
        customerName: bookingsTable.customerName,
        customerEmail: bookingsTable.customerEmail,
        customerPhone: bookingsTable.customerPhone,
        source: bookingsTable.source,
      })
      .from(bookingsTable)
      .where(and(
        eq(bookingsTable.tenantId, req.tenantId),
        eq(bookingsTable.customerEmail, email),
      ))
      .orderBy(desc(bookingsTable.createdAt));

    // Fetch listing titles
    const listingIds = [...new Set(rows.map(r => r.listingId))];
    const listings = listingIds.length
      ? await db.select({ id: listingsTable.id, title: listingsTable.title })
          .from(listingsTable)
          .where(eq(listingsTable.tenantId, req.tenantId))
      : [];
    const listingMap = Object.fromEntries(listings.map(l => [l.id, l.title]));

    res.json(rows.map(r => ({
      ...r,
      totalPrice: String(r.totalPrice),
      createdAt: r.createdAt.toISOString(),
      listingTitle: listingMap[r.listingId] ?? `Listing #${r.listingId}`,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch renter bookings" });
  }
});

router.put("/customers/:id", async (req, res) => {
  try {
    const { name, phone, billingAddress, billingCity, billingState, billingZip, cardLastFour, cardBrand, avatarUrl } = req.body;
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (billingAddress !== undefined) updateData.billingAddress = billingAddress;
    if (billingCity !== undefined) updateData.billingCity = billingCity;
    if (billingState !== undefined) updateData.billingState = billingState;
    if (billingZip !== undefined) updateData.billingZip = billingZip;
    if (cardLastFour !== undefined) updateData.cardLastFour = cardLastFour;
    if (cardBrand !== undefined) updateData.cardBrand = cardBrand;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    const [updated] = await db
      .update(customersTable)
      .set(updateData)
      .where(eq(customersTable.id, Number(req.params.id)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }

    res.json(safeCustomer(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update customer" });
  }
});

// ── Admin: look up a customer's saved card by email (for admin booking form) ───
router.get("/admin/customer-saved-card", async (req, res) => {
  try {
    const email = (req.query.email as string | undefined)?.toLowerCase().trim();
    if (!email) { res.status(400).json({ error: "email required" }); return; }

    const [customer] = await db.select().from(customersTable).where(
      eq(customersTable.email, email)
    );

    if (!customer?.stripeCustomerId) {
      res.json({ hasCard: false, brand: null, last4: null, stripeCustomerId: null });
      return;
    }

    // If we have card details stored locally, return them directly
    if (customer.cardLastFour && customer.cardBrand) {
      res.json({
        hasCard: true,
        brand: customer.cardBrand,
        last4: customer.cardLastFour,
        stripeCustomerId: customer.stripeCustomerId,
      });
      return;
    }

    // Otherwise query Stripe for saved payment methods
    const tenantSlug = (req.headers["x-tenant-slug"] as string | undefined) ?? "";
    const [tenant] = tenantSlug
      ? await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug))
      : [];
    const isTestMode = !!(tenant?.testMode);
    const stripeClient = getStripeForTenant(isTestMode);

    let pms;
    try {
      pms = await stripeClient.paymentMethods.list({
        customer: customer.stripeCustomerId,
        type: "card",
      });
    } catch (stripeErr: any) {
      // Stale customer ID (wrong mode or account was reset) — clear it and report no card
      if (stripeErr?.code === "resource_missing" && stripeErr?.message?.toLowerCase().includes("customer")) {
        console.warn("[customer-saved-card] Stale stripeCustomerId — clearing for customer", customer.id);
        await db
          .update(customersTable)
          .set({ stripeCustomerId: null, cardBrand: null, cardLastFour: null, updatedAt: new Date() })
          .where(eq(customersTable.id, customer.id));
        res.json({ hasCard: false, brand: null, last4: null, stripeCustomerId: null });
        return;
      }
      throw stripeErr;
    }

    if (!pms.data.length) {
      res.json({ hasCard: false, brand: null, last4: null, stripeCustomerId: customer.stripeCustomerId });
      return;
    }

    const pm = pms.data[0];
    res.json({
      hasCard: true,
      brand: pm.card?.brand ?? null,
      last4: pm.card?.last4 ?? null,
      stripeCustomerId: customer.stripeCustomerId,
    });
  } catch (e: any) {
    console.error("[customer-saved-card]", e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
