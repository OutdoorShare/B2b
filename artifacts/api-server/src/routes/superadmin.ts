import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { tenantsTable, listingsTable, bookingsTable } from "@workspace/db/schema";
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

function safeTenant(t: typeof tenantsTable.$inferSelect) {
  const { adminPasswordHash: _, ...safe } = t;
  return { ...safe, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() };
}

// ── Super admin key middleware ─────────────────────────────────────────────────
function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers["x-superadmin-key"] as string | undefined;
  if (!auth || auth !== SUPER_ADMIN_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
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
