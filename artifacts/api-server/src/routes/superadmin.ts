import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { tenantsTable, listingsTable, bookingsTable, superadminUsersTable, businessProfileTable, platformSettingsTable } from "@workspace/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { sendWelcomeEmail, sendAccountUpdatedEmail } from "../services/gmail";

const scryptAsync = promisify(scrypt);
const router: IRouter = Router();

// ── Auth helpers ──────────────────────────────────────────────────────────────
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const supplied = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(hashBuffer, supplied);
}

const SA_SALT = "superadmin_salt_2024";

async function hashSAPassword(password: string): Promise<string> {
  const hash = (await scryptAsync(password, SA_SALT, 64)) as Buffer;
  return hash.toString("hex");
}

async function verifySAPassword(password: string, stored: string): Promise<boolean> {
  try {
    const supplied = (await scryptAsync(password, SA_SALT, 64)) as Buffer;
    const storedBuf = Buffer.from(stored, "hex");
    if (supplied.length !== storedBuf.length) return false;
    return timingSafeEqual(supplied, storedBuf);
  } catch { return false; }
}

function safeTenant(t: typeof tenantsTable.$inferSelect) {
  const { adminPasswordHash: _, ...safe } = t;
  return { ...safe, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() };
}

function safeSAUser(u: typeof superadminUsersTable.$inferSelect) {
  const { passwordHash: _, token: __, ...safe } = u;
  return { ...safe, createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString() };
}

// ── Super admin auth middleware (token only) ───────────────────────────────────
async function requireSuperAdminFn(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-superadmin-token"] as string | undefined;

  if (token) {
    const [user] = await db.select().from(superadminUsersTable)
      .where(eq(superadminUsersTable.token, token)).limit(1);
    if (user && user.status === "active") {
      (req as any).saUser = user;
      next(); return;
    }
  }

  res.status(401).json({ error: "Unauthorized" });
}

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  requireSuperAdminFn(req, res, next).catch(() => res.status(500).json({ error: "Auth error" }));
}

// ── Seed owner account on startup ─────────────────────────────────────────────
export async function seedOwnerAccount() {
  try {
    const [existing] = await db.select()
      .from(superadminUsersTable)
      .where(eq(superadminUsersTable.role, "super_admin"))
      .limit(1);

    if (!existing) {
      const ownerEmail = process.env.SA_OWNER_EMAIL ?? "owner@platform.com";
      const ownerPassword = process.env.SA_OWNER_PASSWORD ?? "superadmin123";
      const ownerName = process.env.SA_OWNER_NAME ?? "Platform Owner";
      const passwordHash = await hashSAPassword(ownerPassword);
      await db.insert(superadminUsersTable).values({
        name: ownerName,
        email: ownerEmail,
        passwordHash,
        role: "super_admin",
        status: "active",
      });
      console.log(`[superadmin] Owner account seeded: ${ownerEmail} (change password after first login)`);
    }
  } catch (err) {
    console.error("[superadmin] Failed to seed owner account:", err);
  }
}

// ── GET /superadmin/tenants ────────────────────────────────────────────────────
router.get("/superadmin/tenants", requireSuperAdmin, async (_req, res) => {
  try {
    const tenants = await db.select().from(tenantsTable).orderBy(tenantsTable.createdAt);
    const result = await Promise.all(tenants.map(async t => {
      const [listingCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(listingsTable);
      const [bookingCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bookingsTable);
      return { ...safeTenant(t), listingCount: listingCount?.count ?? 0, bookingCount: bookingCount?.count ?? 0 };
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
});

// ── POST /superadmin/tenants ───────────────────────────────────────────────────
router.post("/superadmin/tenants", requireSuperAdmin, async (req, res) => {
  try {
    const { name, slug, email, password, plan, status, maxListings, contactName, phone, notes } = req.body;
    if (!name || !slug || !email || !password) {
      res.status(400).json({ error: "name, slug, email and password are required" });
      return;
    }
    // Check uniqueness
    const existing = await db.select().from(tenantsTable).where(eq(tenantsTable.email, email));
    if (existing.length > 0) {
      res.status(409).json({ error: "A tenant with this email already exists" });
      return;
    }
    const slugExists = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug));
    if (slugExists.length > 0) {
      res.status(409).json({ error: "A tenant with this slug already exists" });
      return;
    }
    const adminPasswordHash = await hashPassword(password);
    const [tenant] = await db.insert(tenantsTable).values({
      name, slug, email, adminPasswordHash,
      plan: plan ?? "starter",
      status: status ?? "active",
      maxListings: maxListings ?? 10,
      contactName: contactName ?? null,
      phone: phone ?? null,
      notes: notes ?? null,
    }).returning();

    // Send welcome email (non-blocking — don't fail the request if email fails)
    sendWelcomeEmail({ toEmail: email, companyName: name, slug, password }).catch((err) =>
      console.error("[email] Failed to send welcome email:", err?.message)
    );

    res.status(201).json(safeTenant(tenant));
  } catch (e) {
    res.status(500).json({ error: "Failed to create tenant" });
  }
});

// ── PUT /superadmin/tenants/:id ────────────────────────────────────────────────
router.put("/superadmin/tenants/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, slug, email, password, plan, status, maxListings, contactName, phone, notes } = req.body;
    const updates: Partial<typeof tenantsTable.$inferInsert> & { updatedAt?: Date } = {
      updatedAt: new Date(),
    };
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;
    if (email !== undefined) updates.email = email;
    if (plan !== undefined) updates.plan = plan;
    if (status !== undefined) updates.status = status;
    if (maxListings !== undefined) updates.maxListings = parseInt(maxListings);
    if (contactName !== undefined) updates.contactName = contactName;
    if (phone !== undefined) updates.phone = phone;
    if (notes !== undefined) updates.notes = notes;
    if (password) updates.adminPasswordHash = await hashPassword(password);
    const [updated] = await db.update(tenantsTable).set(updates).where(eq(tenantsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Tenant not found" }); return; }

    // Send account-updated email (non-blocking)
    const recipientEmail = email ?? updated.email;
    const recipientSlug = slug ?? updated.slug;
    const recipientName = name ?? updated.name;
    sendAccountUpdatedEmail({
      toEmail: recipientEmail,
      companyName: recipientName,
      slug: recipientSlug,
      passwordChanged: !!password,
      newPassword: password || undefined,
    }).catch((err) => console.error("[email] Failed to send update email:", err?.message));

    res.json(safeTenant(updated));
  } catch (e) {
    res.status(500).json({ error: "Failed to update tenant" });
  }
});

// ── DELETE /superadmin/tenants/:id ────────────────────────────────────────────
router.delete("/superadmin/tenants/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(tenantsTable).where(eq(tenantsTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Tenant not found" }); return; }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete tenant" });
  }
});

// ── POST /superadmin/auth/login (sub-admin email+password) ────────────────────
router.post("/superadmin/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
    const [user] = await db.select().from(superadminUsersTable)
      .where(eq(superadminUsersTable.email, email.toLowerCase().trim())).limit(1);
    if (!user || user.status !== "active") { res.status(401).json({ error: "Invalid email or password" }); return; }
    const valid = await verifySAPassword(password, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Invalid email or password" }); return; }
    const token = randomBytes(32).toString("hex");
    await db.update(superadminUsersTable).set({ token, updatedAt: new Date() }).where(eq(superadminUsersTable.id, user.id));
    res.json({ token, user: safeSAUser({ ...user, token }) });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

// ── GET /superadmin/team ───────────────────────────────────────────────────────
router.get("/superadmin/team", requireSuperAdmin, async (_req, res) => {
  try {
    const users = await db.select().from(superadminUsersTable).orderBy(superadminUsersTable.createdAt);
    res.json(users.map(safeSAUser));
  } catch {
    res.status(500).json({ error: "Failed to fetch team members" });
  }
});

// ── POST /superadmin/team ──────────────────────────────────────────────────────
router.post("/superadmin/team", requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, password, role, notes } = req.body;
    if (!name || !email || !password) { res.status(400).json({ error: "name, email and password are required" }); return; }
    if (password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
    const passwordHash = await hashSAPassword(password);
    const [user] = await db.insert(superadminUsersTable).values({
      name: name.trim(), email: email.toLowerCase().trim(), passwordHash,
      role: role ?? "admin", notes: notes ?? null,
    }).returning();
    res.status(201).json(safeSAUser(user));
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Email already in use" }); return; }
    res.status(500).json({ error: "Failed to create team member" });
  }
});

// ── PUT /superadmin/team/:id ───────────────────────────────────────────────────
router.put("/superadmin/team/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, email, password, role, status, notes } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (name) updates.name = name.trim();
    if (email) updates.email = email.toLowerCase().trim();
    if (password) {
      if (password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
      updates.passwordHash = await hashSAPassword(password);
      updates.token = null;
    }
    if (role) updates.role = role;
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes || null;
    const [updated] = await db.update(superadminUsersTable).set(updates).where(eq(superadminUsersTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Team member not found" }); return; }
    res.json(safeSAUser(updated));
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Email already in use" }); return; }
    res.status(500).json({ error: "Failed to update team member" });
  }
});

// ── DELETE /superadmin/team/:id ────────────────────────────────────────────────
router.delete("/superadmin/team/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(superadminUsersTable).where(eq(superadminUsersTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Team member not found" }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete team member" });
  }
});

// ── GET /superadmin/tenants/:id (single tenant) ───────────────────────────────
router.get("/superadmin/tenants/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [t] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, id)).limit(1);
    if (!t) { res.status(404).json({ error: "Not found" }); return; }
    const [{ listingCount }] = await db.select({ listingCount: sql<number>`count(*)::int` }).from(listingsTable);
    const [{ bookingCount }] = await db.select({ bookingCount: sql<number>`count(*)::int` }).from(bookingsTable);
    res.json({ ...safeTenant(t), listingCount, bookingCount });
  } catch { res.status(500).json({ error: "Failed to fetch tenant" }); }
});

// ── GET/PUT /superadmin/tenants/:id/business ───────────────────────────────────
router.get("/superadmin/tenants/:id/business", requireSuperAdmin, async (_req, res) => {
  try {
    let [p] = await db.select().from(businessProfileTable).limit(1);
    if (!p) {
      const [created] = await db.insert(businessProfileTable).values({}).returning();
      p = created;
    }
    res.json({ ...p, depositPercent: parseFloat(p.depositPercent ?? "25"), createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() });
  } catch { res.status(500).json({ error: "Failed to fetch business profile" }); }
});

router.put("/superadmin/tenants/:id/business", requireSuperAdmin, async (req, res) => {
  try {
    let [p] = await db.select().from(businessProfileTable).limit(1);
    const body = req.body;
    if (!p) {
      const [created] = await db.insert(businessProfileTable).values({ ...body, depositPercent: String(body.depositPercent ?? "25") }).returning();
      p = created;
    } else {
      const [updated] = await db.update(businessProfileTable).set({ ...body, depositPercent: body.depositPercent !== undefined ? String(body.depositPercent) : undefined, updatedAt: new Date() }).where(eq(businessProfileTable.id, p.id)).returning();
      p = updated;
    }
    res.json({ ...p, depositPercent: parseFloat(p.depositPercent ?? "25"), createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() });
  } catch { res.status(500).json({ error: "Failed to update business profile" }); }
});

// ── GET/POST/PUT/DELETE /superadmin/tenants/:id/listings ──────────────────────
router.get("/superadmin/tenants/:id/listings", requireSuperAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(listingsTable).orderBy(desc(listingsTable.createdAt));
    res.json(rows.map(l => ({ ...l, pricePerDay: parseFloat(l.pricePerDay ?? "0"), pricePerWeek: l.pricePerWeek ? parseFloat(l.pricePerWeek) : null, createdAt: l.createdAt.toISOString(), updatedAt: l.updatedAt.toISOString() })));
  } catch { res.status(500).json({ error: "Failed to fetch listings" }); }
});

router.post("/superadmin/tenants/:id/listings", requireSuperAdmin, async (req, res) => {
  try {
    const { title, description, pricePerDay, pricePerWeek, quantity, status, categoryId, condition, brand, model, location, requirements, depositAmount } = req.body;
    if (!title || !pricePerDay) { res.status(400).json({ error: "title and pricePerDay required" }); return; }
    const [created] = await db.insert(listingsTable).values({
      title, description: description || "", pricePerDay: String(pricePerDay),
      pricePerWeek: pricePerWeek ? String(pricePerWeek) : null,
      quantity: quantity ?? 1, status: status ?? "active",
      categoryId: categoryId ?? null, condition: condition ?? null,
      brand: brand ?? null, model: model ?? null, location: location ?? null,
      requirements: requirements ?? null, depositAmount: depositAmount ? String(depositAmount) : null,
    }).returning();
    res.status(201).json({ ...created, pricePerDay: parseFloat(created.pricePerDay), createdAt: created.createdAt.toISOString(), updatedAt: created.updatedAt.toISOString() });
  } catch { res.status(500).json({ error: "Failed to create listing" }); }
});

router.put("/superadmin/tenants/:id/listings/:lid", requireSuperAdmin, async (req, res) => {
  try {
    const lid = parseInt(req.params.lid);
    const body = req.body;
    const updates: any = { updatedAt: new Date() };
    const fields = ["title","description","status","quantity","categoryId","condition","brand","model","location","requirements"];
    fields.forEach(f => { if (body[f] !== undefined) updates[f] = body[f]; });
    if (body.pricePerDay !== undefined) updates.pricePerDay = String(body.pricePerDay);
    if (body.pricePerWeek !== undefined) updates.pricePerWeek = body.pricePerWeek ? String(body.pricePerWeek) : null;
    if (body.depositAmount !== undefined) updates.depositAmount = body.depositAmount ? String(body.depositAmount) : null;
    const [updated] = await db.update(listingsTable).set(updates).where(eq(listingsTable.id, lid)).returning();
    if (!updated) { res.status(404).json({ error: "Listing not found" }); return; }
    res.json({ ...updated, pricePerDay: parseFloat(updated.pricePerDay), createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch { res.status(500).json({ error: "Failed to update listing" }); }
});

router.delete("/superadmin/tenants/:id/listings/:lid", requireSuperAdmin, async (req, res) => {
  try {
    const lid = parseInt(req.params.lid);
    const [deleted] = await db.delete(listingsTable).where(eq(listingsTable.id, lid)).returning();
    if (!deleted) { res.status(404).json({ error: "Listing not found" }); return; }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete listing" }); }
});

// ── GET /superadmin/tenants/:id/bookings ──────────────────────────────────────
router.get("/superadmin/tenants/:id/bookings", requireSuperAdmin, async (req, res) => {
  try {
    const { limit = "50", status } = req.query as Record<string, string>;
    let query = db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt)).limit(parseInt(limit));
    const rows = await (status ? db.select().from(bookingsTable).where(eq(bookingsTable.status, status as any)).orderBy(desc(bookingsTable.createdAt)).limit(parseInt(limit)) : query);
    res.json(rows.map(b => ({ ...b, totalPrice: parseFloat(b.totalPrice ?? "0"), createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString() })));
  } catch { res.status(500).json({ error: "Failed to fetch bookings" }); }
});

router.put("/superadmin/tenants/:id/bookings/:bid", requireSuperAdmin, async (req, res) => {
  try {
    const bid = parseInt(req.params.bid);
    const { status, adminNotes } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    const [updated] = await db.update(bookingsTable).set(updates).where(eq(bookingsTable.id, bid)).returning();
    if (!updated) { res.status(404).json({ error: "Booking not found" }); return; }
    res.json({ ...updated, totalPrice: parseFloat(updated.totalPrice ?? "0"), createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch { res.status(500).json({ error: "Failed to update booking" }); }
});

// ── GET /superadmin/listings ───────────────────────────────────────────────────
router.get("/superadmin/listings", requireSuperAdmin, async (_req, res) => {
  try {
    const listings = await db.select().from(listingsTable).orderBy(listingsTable.createdAt);
    res.json(listings.map(l => ({
      ...l,
      pricePerDay: parseFloat(l.pricePerDay),
      pricePerWeek: l.pricePerWeek ? parseFloat(l.pricePerWeek) : null,
      depositAmount: l.depositAmount ? parseFloat(l.depositAmount) : null,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    })));
  } catch { res.status(500).json({ error: "Failed to fetch listings" }); }
});

// ── PUT /superadmin/listings/:id ───────────────────────────────────────────────
router.put("/superadmin/listings/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      title, description, status, pricePerDay, pricePerWeek, depositAmount,
      quantity, brand, model, condition, location, requirements, ageRestriction,
    } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim();
    if (status !== undefined) updates.status = status;
    if (pricePerDay !== undefined) updates.pricePerDay = String(pricePerDay);
    if (pricePerWeek !== undefined) updates.pricePerWeek = pricePerWeek ? String(pricePerWeek) : null;
    if (depositAmount !== undefined) updates.depositAmount = depositAmount ? String(depositAmount) : null;
    if (quantity !== undefined) updates.quantity = Number(quantity);
    if (brand !== undefined) updates.brand = brand || null;
    if (model !== undefined) updates.model = model || null;
    if (condition !== undefined) updates.condition = condition || null;
    if (location !== undefined) updates.location = location || null;
    if (requirements !== undefined) updates.requirements = requirements || null;
    if (ageRestriction !== undefined) updates.ageRestriction = ageRestriction ? Number(ageRestriction) : null;
    const [updated] = await db.update(listingsTable).set(updates).where(eq(listingsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Listing not found" }); return; }
    res.json({ ...updated, pricePerDay: parseFloat(updated.pricePerDay), depositAmount: updated.depositAmount ? parseFloat(updated.depositAmount) : null, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch { res.status(500).json({ error: "Failed to update listing" }); }
});

// ── DELETE /superadmin/listings/:id ───────────────────────────────────────────
router.delete("/superadmin/listings/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(listingsTable).where(eq(listingsTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Listing not found" }); return; }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete listing" }); }
});

// ── GET /superadmin/stats ──────────────────────────────────────────────────────
router.get("/superadmin/stats", requireSuperAdmin, async (_req, res) => {
  try {
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(tenantsTable);
    const [{ active }] = await db.select({ active: sql<number>`count(*)::int` }).from(tenantsTable).where(eq(tenantsTable.status, "active"));
    const [{ inactive }] = await db.select({ inactive: sql<number>`count(*)::int` }).from(tenantsTable).where(eq(tenantsTable.status, "inactive"));
    const [{ suspended }] = await db.select({ suspended: sql<number>`count(*)::int` }).from(tenantsTable).where(eq(tenantsTable.status, "suspended"));
    const [{ listings }] = await db.select({ listings: sql<number>`count(*)::int` }).from(listingsTable);
    const [{ bookings }] = await db.select({ bookings: sql<number>`count(*)::int` }).from(bookingsTable);
    res.json({ total, active, inactive, suspended, totalListings: listings, totalBookings: bookings });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ── GET /superadmin/agreement ──────────────────────────────────────────────────
router.get("/superadmin/agreement", requireSuperAdmin, async (_req, res) => {
  try {
    const [row] = await db.select().from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "rental_agreement")).limit(1);
    res.json({ value: row?.value ?? "", updatedAt: row?.updatedAt?.toISOString() ?? null });
  } catch {
    res.status(500).json({ error: "Failed to fetch agreement" });
  }
});

// ── PUT /superadmin/agreement ──────────────────────────────────────────────────
router.put("/superadmin/agreement", requireSuperAdmin, async (req, res) => {
  try {
    const { value } = req.body;
    if (typeof value !== "string") { res.status(400).json({ error: "value is required" }); return; }
    const now = new Date();
    const existing = await db.select({ id: platformSettingsTable.id })
      .from(platformSettingsTable).where(eq(platformSettingsTable.key, "rental_agreement")).limit(1);
    if (existing.length > 0) {
      await db.update(platformSettingsTable)
        .set({ value, updatedAt: now })
        .where(eq(platformSettingsTable.key, "rental_agreement"));
    } else {
      await db.insert(platformSettingsTable).values({ key: "rental_agreement", value, updatedAt: now });
    }
    res.json({ ok: true, updatedAt: now.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to save agreement" });
  }
});

// ── GET /platform/agreement (public — used by booking flow) ───────────────────
router.get("/platform/agreement", async (_req, res) => {
  try {
    const [row] = await db.select().from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "rental_agreement")).limit(1);
    res.json({ value: row?.value ?? "", updatedAt: row?.updatedAt?.toISOString() ?? null });
  } catch {
    res.status(500).json({ error: "Failed to fetch agreement" });
  }
});

export default router;
