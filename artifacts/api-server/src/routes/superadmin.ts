import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { tenantsTable, listingsTable, bookingsTable, superadminUsersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const router: IRouter = Router();

const SUPER_ADMIN_KEY = process.env.SUPER_ADMIN_KEY ?? "superadmin";

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

// ── Super admin auth middleware (key OR sub-admin token) ───────────────────────
async function requireSuperAdminFn(req: Request, res: Response, next: NextFunction) {
  const key = req.headers["x-superadmin-key"] as string | undefined;
  const token = req.headers["x-superadmin-token"] as string | undefined;

  if (key && key === SUPER_ADMIN_KEY) { (req as any).isMasterKey = true; next(); return; }

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

// ── POST /superadmin/login ─────────────────────────────────────────────────────
router.post("/superadmin/login", (req, res) => {
  const { key } = req.body;
  if (!key || key !== SUPER_ADMIN_KEY) {
    res.status(401).json({ error: "Invalid super admin key" });
    return;
  }
  res.json({ ok: true, key: SUPER_ADMIN_KEY });
});

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

export default router;
