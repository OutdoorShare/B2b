import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { tenantsTable, listingsTable, bookingsTable, superadminUsersTable, businessProfileTable, platformSettingsTable, categoriesTable, claimsTable, customersTable } from "@workspace/db/schema";
import { eq, sql, desc, and, ne } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { sendWelcomeEmail, sendAccountUpdatedEmail, sendClaimChargeEmail, sendClaimSettlementEmail } from "../services/gmail";
import { stripe } from "../services/stripe";

const scryptAsync = promisify(scrypt);

// ── Slug helpers ───────────────────────────────────────────────────────────────
const RESERVED_SLUGS = new Set([
  "admin", "api", "superadmin", "platform", "docs", "public", "signup",
  "get-started", "demo", "audit", "health", "static", "assets", "uploads",
  "login", "logout", "register", "account", "dashboard", "settings", "billing",
  "support", "help", "about", "contact", "privacy", "terms", "pricing",
  "www", "mail", "email", "ftp", "cdn", "media", "images",
]);

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function generateUniqueSlug(name: string, excludeId?: number): Promise<string> {
  const base = nameToSlug(name);
  let candidate = base;
  let attempt = 2;
  while (true) {
    if (RESERVED_SLUGS.has(candidate)) {
      candidate = `${base}-${attempt++}`;
      continue;
    }
    const conditions: any[] = [eq(tenantsTable.slug, candidate)];
    if (excludeId) conditions.push(ne(tenantsTable.id, excludeId));
    const existing = await db.select({ id: tenantsTable.id }).from(tenantsTable)
      .where(conditions.length === 2 ? and(...conditions as [any, any]) : conditions[0]);
    if (existing.length === 0) return candidate;
    candidate = `${base}-${attempt++}`;
  }
}

// ── Default categories seeded for every new tenant ────────────────────────────
const DEFAULT_CATEGORIES = [
  { name: "ATV",             slug: "atv",            description: "All-terrain vehicles" },
  { name: "UTV",             slug: "utv",            description: "Utility task vehicles / side-by-sides" },
  { name: "Boat",            slug: "boat",           description: "Boats and watercraft" },
  { name: "Jet Ski",         slug: "jet-ski",        description: "Personal watercraft" },
  { name: "RV",              slug: "rv",             description: "Recreational vehicles and campers" },
  { name: "Camper",          slug: "camper",         description: "Camper trailers and popup campers" },
  { name: "Dirt Bike",       slug: "dirt-bike",      description: "Off-road motorcycles" },
  { name: "Ebike",           slug: "ebike",          description: "Electric bicycles" },
  { name: "Snowmobile",      slug: "snowmobile",     description: "Snowmobiles" },
  { name: "Towing Vehicle",  slug: "towing-vehicle", description: "Trucks and towing vehicles" },
  { name: "Utility Trailer", slug: "utility-trailer",description: "Trailers and cargo haulers" },
];

async function seedDefaultCategories(tenantId: number) {
  try {
    await db.insert(categoriesTable).values(
      DEFAULT_CATEGORIES.map(c => ({ ...c, tenantId }))
    ).onConflictDoNothing();
  } catch (e) {
    console.error("[seedDefaultCategories] Failed:", e);
  }
}
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
  const { adminPasswordHash: _, adminToken: __, ...safe } = t;
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

// ── Ensure demo tenant always has stable, professional branding ────────────────
// Runs on every startup so the demo site's appearance never drifts due to code
// changes or accidental admin edits (design fields are also API-locked in business.ts).
export async function seedDemoTenant() {
  try {
    const DEMO_SLUG = "demo-outdoorshare";
    const [tenant] = await db.select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, DEMO_SLUG))
      .limit(1);
    if (!tenant) return; // demo tenant doesn't exist yet — nothing to seed

    // Identity fields pinned on every restart — preserves company name/logo for the demo.
    // Colors are intentionally excluded so admins can demo the branding customization feature.
    const pinnedIdentity = {
      name:          "OutdoorShare Demo",
      tagline:       "Rent Smarter. Explore More.",
      description:   "Experience the full OutdoorShare rental platform live. This is an interactive demo site.",
      logoUrl:       "/outdoorshare-logo.png",
      coverImageUrl: (null as string | null),
      updatedAt:     new Date(),
    };

    // Color defaults only applied when creating the profile for the first time.
    const defaultColors = {
      primaryColor: "#3ab549",
      accentColor:  "#1a2332",
    };

    const [existing] = await db.select({ id: businessProfileTable.id })
      .from(businessProfileTable)
      .where(eq(businessProfileTable.tenantId, tenant.id))
      .limit(1);

    if (existing) {
      await db.update(businessProfileTable)
        .set(pinnedIdentity)
        .where(eq(businessProfileTable.id, existing.id));
    } else {
      await db.insert(businessProfileTable).values({ ...pinnedIdentity, ...defaultColors, tenantId: tenant.id });
    }

    console.log("[demo] Business profile pinned to OutdoorShare Demo branding");
  } catch (err) {
    console.error("[demo] seedDemoTenant failed:", err);
  }
}

// ── GET /superadmin/tenants ────────────────────────────────────────────────────
router.get("/superadmin/tenants", requireSuperAdmin, async (_req, res) => {
  try {
    const tenants = await db.select().from(tenantsTable).orderBy(tenantsTable.createdAt);
    const result = await Promise.all(tenants.map(async t => {
      const [listingCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(listingsTable)
        .where(eq(listingsTable.tenantId, t.id));
      const [bookingCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bookingsTable)
        .where(eq(bookingsTable.tenantId, t.id));
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
    const { name, slug: rawSlug, email, password, plan, status, maxListings, contactName, phone, notes } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "name, email and password are required" });
      return;
    }
    // Check email uniqueness
    const existing = await db.select().from(tenantsTable).where(eq(tenantsTable.email, email));
    if (existing.length > 0) {
      res.status(409).json({ error: "A tenant with this email already exists" });
      return;
    }
    const nameExists = await db.select().from(tenantsTable)
      .where(sql`lower(${tenantsTable.name}) = lower(${name})`);
    if (nameExists.length > 0) {
      res.status(409).json({ error: "A company with this name already exists" });
      return;
    }
    // Auto-generate slug from name if not provided, then ensure uniqueness
    const slugBase = rawSlug ? nameToSlug(rawSlug) : nameToSlug(name);
    const slug = await generateUniqueSlug(slugBase);
    const adminPasswordHash = await hashPassword(password);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const [tenant] = await db.insert(tenantsTable).values({
      name, slug, email, adminPasswordHash,
      plan: plan ?? "starter",
      status: status ?? "active",
      maxListings: maxListings ?? 10,
      contactName: contactName ?? null,
      phone: phone ?? null,
      notes: notes ?? null,
      trialEndsAt,
    }).returning();

    // Seed default categories (await so they exist before the response)
    await seedDefaultCategories(tenant.id);

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
    // Note: slug is intentionally excluded — it is permanent once set at creation.
    const { name, email, password, plan, status, maxListings, contactName, phone, notes, platformFeePercent, testMode, trialEndsAt } = req.body;
    const updates: Partial<typeof tenantsTable.$inferInsert> & { updatedAt?: Date } = {
      updatedAt: new Date(),
    };
    if (name !== undefined) {
      const nameConflict = await db.select().from(tenantsTable)
        .where(and(sql`lower(${tenantsTable.name}) = lower(${name})`, ne(tenantsTable.id, id)));
      if (nameConflict.length > 0) {
        res.status(409).json({ error: "A company with this name already exists" });
        return;
      }
      updates.name = name;
    }
    // Slug is never updated — it is a permanent identifier for this account.
    if (email !== undefined) updates.email = email;
    if (plan !== undefined) updates.plan = plan;
    if (status !== undefined) updates.status = status;
    if (maxListings !== undefined) updates.maxListings = parseInt(maxListings);
    if (contactName !== undefined) updates.contactName = contactName;
    if (phone !== undefined) updates.phone = phone;
    if (notes !== undefined) updates.notes = notes;
    if (password) updates.adminPasswordHash = await hashPassword(password);
    if (platformFeePercent !== undefined) {
      const pct = parseFloat(platformFeePercent);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        res.status(400).json({ error: "Platform fee must be between 0 and 100" });
        return;
      }
      updates.platformFeePercent = pct.toFixed(2);
    }
    if (testMode !== undefined) updates.testMode = !!testMode;
    if ("trialEndsAt" in req.body) updates.trialEndsAt = trialEndsAt ? new Date(trialEndsAt) : null;
    const [updated] = await db.update(tenantsTable).set(updates).where(eq(tenantsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Tenant not found" }); return; }

    // Send account-updated email (non-blocking)
    const recipientEmail = email ?? updated.email;
    const recipientName = name ?? updated.name;
    sendAccountUpdatedEmail({
      toEmail: recipientEmail,
      companyName: recipientName,
      slug: updated.slug,
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
    const [{ listingCount }] = await db.select({ listingCount: sql<number>`count(*)::int` }).from(listingsTable).where(eq(listingsTable.tenantId, id));
    const [{ bookingCount }] = await db.select({ bookingCount: sql<number>`count(*)::int` }).from(bookingsTable).where(eq(bookingsTable.tenantId, id));
    res.json({ ...safeTenant(t), listingCount, bookingCount });
  } catch { res.status(500).json({ error: "Failed to fetch tenant" }); }
});

// ── GET/PUT /superadmin/tenants/:id/business ───────────────────────────────────
router.get("/superadmin/tenants/:id/business", requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = parseInt(req.params.id);
    let [p] = await db.select().from(businessProfileTable).where(eq(businessProfileTable.tenantId, tenantId)).limit(1);
    if (!p) {
      const [created] = await db.insert(businessProfileTable).values({ tenantId }).returning();
      p = created;
    }
    res.json({ ...p, depositPercent: parseFloat(p.depositPercent ?? "25"), createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() });
  } catch (err) {
    console.error("Failed to fetch business profile:", err);
    res.status(500).json({ error: "Failed to fetch business profile" });
  }
});

router.put("/superadmin/tenants/:id/business", requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = parseInt(req.params.id);
    // Strip non-updatable fields that the frontend echoes back
    const { id: _id, createdAt: _ca, updatedAt: _ua, tenantId: _tid, ...body } = req.body;
    let [p] = await db.select().from(businessProfileTable).where(eq(businessProfileTable.tenantId, tenantId)).limit(1);
    if (!p) {
      const [created] = await db.insert(businessProfileTable).values({
        ...body,
        tenantId,
        depositPercent: String(body.depositPercent ?? "25"),
      }).returning();
      p = created;
    } else {
      const [updated] = await db.update(businessProfileTable).set({
        ...body,
        depositPercent: body.depositPercent !== undefined ? String(body.depositPercent) : undefined,
        updatedAt: new Date(),
      }).where(eq(businessProfileTable.id, p.id)).returning();
      p = updated;
    }
    res.json({ ...p, depositPercent: parseFloat(p.depositPercent ?? "25"), createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() });
  } catch (err) {
    console.error("Failed to update business profile:", err);
    res.status(500).json({ error: "Failed to update business profile" });
  }
});

// ── GET/POST/PUT/DELETE /superadmin/tenants/:id/listings ──────────────────────
router.get("/superadmin/tenants/:id/listings", requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = parseInt(req.params.id);
    const rows = await db.select().from(listingsTable).where(eq(listingsTable.tenantId, tenantId)).orderBy(desc(listingsTable.createdAt));
    res.json(rows.map(l => ({ ...l, pricePerDay: parseFloat(l.pricePerDay ?? "0"), pricePerWeek: l.pricePerWeek ? parseFloat(l.pricePerWeek) : null, createdAt: l.createdAt.toISOString(), updatedAt: l.updatedAt.toISOString() })));
  } catch { res.status(500).json({ error: "Failed to fetch listings" }); }
});

router.post("/superadmin/tenants/:id/listings", requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = parseInt(req.params.id);
    const { title, description, pricePerDay, pricePerWeek, quantity, status, categoryId, condition, brand, model, location, requirements, depositAmount } = req.body;
    if (!title || !pricePerDay) { res.status(400).json({ error: "title and pricePerDay required" }); return; }
    const [created] = await db.insert(listingsTable).values({
      tenantId,
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
    // Explicit allow-list — no dynamic bracket notation on user input
    if (body.title       !== undefined) updates.title       = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status      !== undefined) updates.status      = body.status;
    if (body.quantity    !== undefined) updates.quantity    = body.quantity;
    if (body.categoryId  !== undefined) updates.categoryId  = body.categoryId;
    if (body.condition   !== undefined) updates.condition   = body.condition;
    if (body.brand       !== undefined) updates.brand       = body.brand;
    if (body.model       !== undefined) updates.model       = body.model;
    if (body.location    !== undefined) updates.location    = body.location;
    if (body.requirements !== undefined) updates.requirements = body.requirements;
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

// ── GET /superadmin/tenants/:id/analytics ─────────────────────────────────────
router.get("/superadmin/tenants/:id/analytics", requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = parseInt(req.params.id);
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const feePercent = tenant.platformFeePercent ? parseFloat(tenant.platformFeePercent) : 5;

    // All non-cancelled bookings for this tenant
    const bookings = await db
      .select({
        id: bookingsTable.id,
        status: bookingsTable.status,
        totalPrice: bookingsTable.totalPrice,
        createdAt: bookingsTable.createdAt,
        listingId: bookingsTable.listingId,
      })
      .from(bookingsTable)
      .where(eq(bookingsTable.tenantId, tenantId))
      .orderBy(desc(bookingsTable.createdAt));

    const nonCancelled = bookings.filter(b => b.status !== "cancelled");
    const totalRevenue = nonCancelled.reduce((s, b) => s + parseFloat(b.totalPrice ?? "0"), 0);
    const feesRetained = totalRevenue * feePercent / 100;

    // Status breakdown
    const statusMap: Record<string, number> = {};
    for (const b of bookings) statusMap[b.status] = (statusMap[b.status] ?? 0) + 1;

    // Revenue by month (last 12 months)
    const now = new Date();
    const months: { month: string; revenue: number; bookings: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const mBooks = nonCancelled.filter(b => b.createdAt >= mStart && b.createdAt < mEnd);
      months.push({ month: label, revenue: mBooks.reduce((s, b) => s + parseFloat(b.totalPrice ?? "0"), 0), bookings: mBooks.length });
    }

    // Category breakdown (join listings → categories)
    const { categoriesTable } = await import("@workspace/db/schema");
    const catRows = await db
      .select({
        catName: categoriesTable.name,
        listingId: listingsTable.id,
      })
      .from(listingsTable)
      .leftJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
      .where(eq(listingsTable.tenantId, tenantId));

    const listingCatMap: Record<number, string> = {};
    for (const r of catRows) listingCatMap[r.listingId] = r.catName ?? "Uncategorized";

    const catMap: Record<string, { bookings: number; revenue: number }> = {};
    for (const b of nonCancelled) {
      const cat = listingCatMap[b.listingId ?? -1] ?? "Uncategorized";
      if (!catMap[cat]) catMap[cat] = { bookings: 0, revenue: 0 };
      catMap[cat].bookings++;
      catMap[cat].revenue += parseFloat(b.totalPrice ?? "0");
    }
    const categoryBreakdown = Object.entries(catMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue);

    // Claims count
    const claimRows = await db.select({ id: claimsTable.id, status: claimsTable.status }).from(claimsTable).where(eq(claimsTable.tenantId, tenantId));

    res.json({
      totalRevenue,
      feesRetained,
      feePercent,
      totalBookings: bookings.length,
      statusBreakdown: statusMap,
      revenueByMonth: months,
      categoryBreakdown,
      claimsCount: claimRows.length,
      openClaims: claimRows.filter(c => c.status === "open").length,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ── GET /superadmin/bookings — all bookings across all tenants ─────────────────
router.get("/superadmin/bookings", requireSuperAdmin, async (req, res) => {
  try {
    const { search, status, limit = "300" } = req.query as Record<string, string>;
    const rows = await db
      .select({
        id: bookingsTable.id,
        tenantId: bookingsTable.tenantId,
        listingId: bookingsTable.listingId,
        customerName: bookingsTable.customerName,
        customerEmail: bookingsTable.customerEmail,
        customerPhone: bookingsTable.customerPhone,
        startDate: bookingsTable.startDate,
        endDate: bookingsTable.endDate,
        totalPrice: bookingsTable.totalPrice,
        status: bookingsTable.status,
        source: bookingsTable.source,
        notes: bookingsTable.notes,
        adminNotes: bookingsTable.adminNotes,
        pickupCompletedAt: bookingsTable.pickupCompletedAt,
        createdAt: bookingsTable.createdAt,
        updatedAt: bookingsTable.updatedAt,
        companyName: tenantsTable.name,
        companySlug: tenantsTable.slug,
        listingTitle: listingsTable.title,
      })
      .from(bookingsTable)
      .leftJoin(tenantsTable, eq(bookingsTable.tenantId, tenantsTable.id))
      .leftJoin(listingsTable, eq(bookingsTable.listingId, listingsTable.id))
      .where(
        and(
          status ? eq(bookingsTable.status, status as any) : undefined,
          search ? sql`(
            lower(${bookingsTable.customerName}) like ${"%" + search.toLowerCase() + "%"} or
            lower(${bookingsTable.customerEmail}) like ${"%" + search.toLowerCase() + "%"} or
            lower(${listingsTable.title}) like ${"%" + search.toLowerCase() + "%"} or
            lower(${tenantsTable.name}) like ${"%" + search.toLowerCase() + "%"}
          )` : undefined,
        )
      )
      .orderBy(desc(bookingsTable.createdAt))
      .limit(parseInt(limit));

    res.json(rows.map(b => ({
      ...b,
      totalPrice: parseFloat(b.totalPrice ?? "0"),
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      pickupCompletedAt: b.pickupCompletedAt?.toISOString() ?? null,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
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

// ── GET /superadmin/analytics ─────────────────────────────────────────────────
router.get("/superadmin/analytics", requireSuperAdmin, async (_req, res) => {
  try {
    const [
      kpiRows,
      sourceRows,
      leaderboardRows,
      categoryRows,
      topListingRows,
      signupTrendRows,
    ] = await Promise.all([
      // KPI: total revenue, platform commission, protection fees, booking count, new signups
      db.execute(sql`
        SELECT
          COALESCE(SUM(b.total_price) FILTER (WHERE b.status NOT IN ('cancelled')), 0)::numeric AS total_revenue,
          COALESCE(SUM(b.stripe_platform_fee), 0)::numeric AS platform_commission,
          COALESCE((
            SELECT SUM((addon->>'subtotal')::numeric)
            FROM bookings bx
            CROSS JOIN LATERAL jsonb_array_elements(
              CASE WHEN bx.addons_data IS NOT NULL AND bx.addons_data NOT IN ('[]','null','')
                   THEN bx.addons_data::jsonb ELSE '[]'::jsonb END
            ) AS addon
            WHERE lower(addon->>'name') LIKE '%protection%'
          ), 0)::numeric AS protection_fees,
          COUNT(b.id)::int AS total_bookings,
          (SELECT COUNT(*)::int FROM tenants WHERE created_at > NOW() - INTERVAL '30 days') AS new_signups,
          (SELECT COUNT(*)::int FROM tenants) AS total_companies
        FROM bookings b
      `),
      // Booking source breakdown
      db.execute(sql`
        SELECT COALESCE(source, 'online') AS source, COUNT(*)::int AS count
        FROM bookings
        GROUP BY COALESCE(source, 'online')
        ORDER BY count DESC
      `),
      // Company leaderboard
      db.execute(sql`
        SELECT
          t.id, t.name, t.slug,
          COUNT(b.id)::int AS booking_count,
          COALESCE(SUM(b.total_price) FILTER (WHERE b.status NOT IN ('cancelled')), 0)::numeric AS total_revenue,
          COALESCE(SUM(b.stripe_platform_fee), 0)::numeric AS commission_paid,
          t.created_at
        FROM tenants t
        LEFT JOIN bookings b ON b.tenant_id = t.id
        GROUP BY t.id, t.name, t.slug, t.created_at
        ORDER BY booking_count DESC, total_revenue DESC
        LIMIT 25
      `),
      // Totals per category
      db.execute(sql`
        SELECT
          c.name AS category_name,
          COUNT(b.id)::int AS booking_count,
          COALESCE(SUM(b.total_price) FILTER (WHERE b.status NOT IN ('cancelled')), 0)::numeric AS total_revenue
        FROM bookings b
        JOIN listings l ON l.id = b.listing_id
        JOIN categories c ON c.id = l.category_id
        GROUP BY c.name
        ORDER BY total_revenue DESC
      `),
      // Top listings by booking count
      db.execute(sql`
        SELECT
          l.id, l.title,
          t.name AS company_name,
          COUNT(b.id)::int AS booking_count,
          COALESCE(SUM(b.total_price) FILTER (WHERE b.status NOT IN ('cancelled')), 0)::numeric AS total_revenue
        FROM bookings b
        JOIN listings l ON l.id = b.listing_id
        JOIN tenants t ON t.id = b.tenant_id
        GROUP BY l.id, l.title, t.name
        ORDER BY booking_count DESC
        LIMIT 10
      `),
      // Monthly tenant signup trend (last 6 months)
      db.execute(sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') AS month_label,
          DATE_TRUNC('month', created_at) AS month_start,
          COUNT(*)::int AS count
        FROM tenants
        WHERE created_at > NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
      `),
    ]);

    const kpi = (kpiRows as any).rows?.[0] ?? (kpiRows as any)[0] ?? {};

    res.json({
      kpi: {
        totalRevenue: parseFloat(kpi.total_revenue ?? "0"),
        platformCommission: parseFloat(kpi.platform_commission ?? "0"),
        protectionFees: parseFloat(kpi.protection_fees ?? "0"),
        totalBookings: parseInt(kpi.total_bookings ?? "0"),
        newSignups: parseInt(kpi.new_signups ?? "0"),
        totalCompanies: parseInt(kpi.total_companies ?? "0"),
      },
      sources: ((sourceRows as any).rows ?? sourceRows as any[]).map((r: any) => ({
        source: r.source,
        count: parseInt(r.count ?? "0"),
      })),
      leaderboard: ((leaderboardRows as any).rows ?? leaderboardRows as any[]).map((r: any) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        bookingCount: parseInt(r.booking_count ?? "0"),
        totalRevenue: parseFloat(r.total_revenue ?? "0"),
        commissionPaid: parseFloat(r.commission_paid ?? "0"),
        createdAt: r.created_at,
      })),
      categories: ((categoryRows as any).rows ?? categoryRows as any[]).map((r: any) => ({
        name: r.category_name,
        bookingCount: parseInt(r.booking_count ?? "0"),
        totalRevenue: parseFloat(r.total_revenue ?? "0"),
      })),
      topListings: ((topListingRows as any).rows ?? topListingRows as any[]).map((r: any) => ({
        id: r.id,
        title: r.title,
        companyName: r.company_name,
        bookingCount: parseInt(r.booking_count ?? "0"),
        totalRevenue: parseFloat(r.total_revenue ?? "0"),
      })),
      signupTrend: ((signupTrendRows as any).rows ?? signupTrendRows as any[]).map((r: any) => ({
        month: r.month_label,
        count: parseInt(r.count ?? "0"),
      })),
    });
  } catch (e) {
    console.error("[analytics]", e);
    res.status(500).json({ error: "Failed to fetch analytics" });
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

// ── GET /superadmin/agreement/categories — list all category-specific overrides
router.get("/superadmin/agreement/categories", requireSuperAdmin, async (_req, res) => {
  try {
    // Get all category-specific agreement settings
    const rows = await db.select().from(platformSettingsTable)
      .where(sql`${platformSettingsTable.key} LIKE 'rental_agreement_category_%'`);
    const overrides = rows.map(r => ({
      categorySlug: r.key.replace("rental_agreement_category_", ""),
      value: r.value ?? "",
      updatedAt: r.updatedAt?.toISOString() ?? null,
    }));
    // Get distinct categories from all tenants for the picker
    const cats = await db
      .selectDistinct({ slug: categoriesTable.slug, name: categoriesTable.name })
      .from(categoriesTable)
      .orderBy(categoriesTable.name);
    res.json({ overrides, categories: cats });
  } catch {
    res.status(500).json({ error: "Failed to fetch category agreements" });
  }
});

// ── PUT /superadmin/agreement/category/:slug — save a category-specific override
router.put("/superadmin/agreement/category/:slug", requireSuperAdmin, async (req, res) => {
  try {
    const { slug } = req.params;
    const { value } = req.body;
    if (typeof value !== "string") { res.status(400).json({ error: "value is required" }); return; }
    const key = `rental_agreement_category_${slug}`;
    const now = new Date();
    const existing = await db.select({ id: platformSettingsTable.id })
      .from(platformSettingsTable).where(eq(platformSettingsTable.key, key)).limit(1);
    if (existing.length > 0) {
      await db.update(platformSettingsTable).set({ value, updatedAt: now }).where(eq(platformSettingsTable.key, key));
    } else {
      await db.insert(platformSettingsTable).values({ key, value, updatedAt: now });
    }
    res.json({ ok: true, updatedAt: now.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to save category agreement" });
  }
});

// ── DELETE /superadmin/agreement/category/:slug — remove category-specific override
router.delete("/superadmin/agreement/category/:slug", requireSuperAdmin, async (req, res) => {
  try {
    const { slug } = req.params;
    const key = `rental_agreement_category_${slug}`;
    await db.delete(platformSettingsTable).where(eq(platformSettingsTable.key, key));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete category agreement" });
  }
});

// ── GET /superadmin/agreement/fields ─────────────────────────────────────────
router.get("/superadmin/agreement/fields", requireSuperAdmin, async (_req, res) => {
  try {
    const [row] = await db.select().from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "rental_agreement_fields")).limit(1);
    res.json({ fields: row?.value ? JSON.parse(row.value) : [], updatedAt: row?.updatedAt?.toISOString() ?? null });
  } catch {
    res.status(500).json({ error: "Failed to fetch fields" });
  }
});

// ── PUT /superadmin/agreement/fields ─────────────────────────────────────────
router.put("/superadmin/agreement/fields", requireSuperAdmin, async (req, res) => {
  try {
    const { fields } = req.body;
    if (!Array.isArray(fields)) { res.status(400).json({ error: "fields must be an array" }); return; }
    const value = JSON.stringify(fields);
    const now = new Date();
    const existing = await db.select({ id: platformSettingsTable.id })
      .from(platformSettingsTable).where(eq(platformSettingsTable.key, "rental_agreement_fields")).limit(1);
    if (existing.length > 0) {
      await db.update(platformSettingsTable).set({ value, updatedAt: now })
        .where(eq(platformSettingsTable.key, "rental_agreement_fields"));
    } else {
      await db.insert(platformSettingsTable).values({ key: "rental_agreement_fields", value, updatedAt: now });
    }
    res.json({ ok: true, updatedAt: now.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to save fields" });
  }
});

// ── GET /superadmin/claims ─────────────────────────────────────────────────────
router.get("/superadmin/claims", requireSuperAdmin, async (req, res) => {
  try {
    const { status, type, tenantId } = req.query;
    const rows = await db
      .select({
        id: claimsTable.id,
        tenantId: claimsTable.tenantId,
        bookingId: claimsTable.bookingId,
        listingId: claimsTable.listingId,
        customerName: claimsTable.customerName,
        customerEmail: claimsTable.customerEmail,
        type: claimsTable.type,
        description: claimsTable.description,
        claimedAmount: claimsTable.claimedAmount,
        settledAmount: claimsTable.settledAmount,
        status: claimsTable.status,
        adminNotes: claimsTable.adminNotes,
        evidenceUrls: claimsTable.evidenceUrls,
        chargeMode: claimsTable.chargeMode,
        chargeStatus: claimsTable.chargeStatus,
        chargedAmount: claimsTable.chargedAmount,
        stripeChargeRefs: claimsTable.stripeChargeRefs,
        createdAt: claimsTable.createdAt,
        updatedAt: claimsTable.updatedAt,
        companyName: tenantsTable.name,
        companySlug: tenantsTable.slug,
      })
      .from(claimsTable)
      .leftJoin(tenantsTable, eq(claimsTable.tenantId, tenantsTable.id))
      .where(
        and(
          status ? eq(claimsTable.status, status as any) : undefined,
          type ? eq(claimsTable.type, type as any) : undefined,
          tenantId ? eq(claimsTable.tenantId, Number(tenantId)) : undefined,
        )
      )
      .orderBy(desc(claimsTable.createdAt));

    res.json(rows.map(r => ({
      ...r,
      claimedAmount: r.claimedAmount ? parseFloat(r.claimedAmount) : null,
      settledAmount: r.settledAmount ? parseFloat(r.settledAmount) : null,
      chargedAmount: r.chargedAmount ? parseFloat(r.chargedAmount) : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch claims" });
  }
});

// ── PUT /superadmin/claims/:id ─────────────────────────────────────────────────
router.put("/superadmin/claims/:id", requireSuperAdmin, async (req, res) => {
  try {
    const { status, adminNotes, settledAmount } = req.body;
    const [updated] = await db
      .update(claimsTable)
      .set({
        ...(status !== undefined && { status }),
        ...(adminNotes !== undefined && { adminNotes }),
        ...(settledAmount !== undefined && { settledAmount: settledAmount != null ? String(settledAmount) : null }),
        updatedAt: new Date(),
      })
      .where(eq(claimsTable.id, Number(req.params.id)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json({
      ...updated,
      claimedAmount: updated.claimedAmount ? parseFloat(updated.claimedAmount) : null,
      settledAmount: updated.settledAmount ? parseFloat(updated.settledAmount) : null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update claim" });
  }
});

// ── POST /superadmin/claims/:id/settle ────────────────────────────────────────
// Fully resolve a claim: optionally refund part/all of the captured deposit to
// the renter and send them a settlement email.
router.post("/superadmin/claims/:id/settle", requireSuperAdmin, async (req, res) => {
  try {
    const claimId = Number(req.params.id);
    const { settledAmount, refundAmount, noRefund, adminNotes } = req.body;

    const [claim] = await db.select().from(claimsTable).where(eq(claimsTable.id, claimId)).limit(1);
    if (!claim) return res.status(404).json({ error: "Claim not found" });

    const capturedAmount = claim.chargedAmount ? parseFloat(claim.chargedAmount) : 0;
    const refundAmountFloat = noRefund ? 0 : Math.max(0, parseFloat(refundAmount ?? "0") || 0);
    const settledAmountFloat = settledAmount != null ? parseFloat(settledAmount) : null;

    let stripeRefundId: string | null = null;
    let finalRefundStatus: "none" | "partial" | "full" = "none";

    // Process Stripe refund if applicable
    if (!noRefund && refundAmountFloat > 0 && claim.stripeChargeRefs) {
      try {
        const refs: string[] = JSON.parse(claim.stripeChargeRefs);
        const paymentIntentId = refs[0];
        if (paymentIntentId) {
          // Determine test mode from tenant
          let testMode = true;
          if (claim.tenantId) {
            const [t] = await db.select({ testMode: tenantsTable.testMode }).from(tenantsTable)
              .where(eq(tenantsTable.id, claim.tenantId)).limit(1);
            testMode = !!t?.testMode;
          }
          const stripeClient = testMode
            ? (await import("../services/stripe")).getStripeForTenant(true)
            : (await import("../services/stripe")).getStripeForTenant(false);

          const refundAmountCents = Math.round(refundAmountFloat * 100);
          const capturedCents = Math.round(capturedAmount * 100);

          const refund = await stripeClient.refunds.create({
            payment_intent: paymentIntentId,
            amount: refundAmountCents,
          });

          stripeRefundId = refund.id;
          finalRefundStatus = refundAmountCents >= capturedCents ? "full" : "partial";
        }
      } catch (e: any) {
        req.log.error({ err: e.message }, "Stripe refund failed");
        return res.status(502).json({ error: `Stripe refund failed: ${e.message}` });
      }
    }

    // Update the claim
    const [updated] = await db
      .update(claimsTable)
      .set({
        status: "resolved",
        settledAmount: settledAmountFloat != null ? String(settledAmountFloat) : null,
        refundAmount: String(refundAmountFloat),
        refundStatus: finalRefundStatus,
        ...(stripeRefundId && { stripeRefundId }),
        ...(adminNotes !== undefined && { adminNotes: adminNotes || null }),
        updatedAt: new Date(),
      })
      .where(eq(claimsTable.id, claimId))
      .returning();

    res.json({
      ...updated,
      claimedAmount: updated.claimedAmount ? parseFloat(updated.claimedAmount) : null,
      settledAmount: updated.settledAmount ? parseFloat(updated.settledAmount) : null,
      chargedAmount: updated.chargedAmount ? parseFloat(updated.chargedAmount) : null,
      refundAmount: updated.refundAmount ? parseFloat(updated.refundAmount) : null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });

    // Fire-and-forget: send settlement email to renter
    (async () => {
      try {
        let companyName = "OutdoorShare";
        let tenantSlug = "unknown";
        let adminEmail: string | undefined;
        if (claim.tenantId) {
          const [t] = await db
            .select({ name: tenantsTable.name, slug: tenantsTable.slug, email: tenantsTable.email })
            .from(tenantsTable)
            .where(eq(tenantsTable.id, claim.tenantId))
            .limit(1);
          if (t) { companyName = t.name; tenantSlug = t.slug; adminEmail = t.email ?? undefined; }
        }

        await sendClaimSettlementEmail({
          claimId,
          customerName: claim.customerName,
          customerEmail: claim.customerEmail,
          type: claim.type,
          companyName,
          tenantSlug,
          chargedAmount: capturedAmount,
          settledAmount: settledAmountFloat,
          refundAmount: refundAmountFloat,
          noRefund: !!noRefund,
          adminNotes: adminNotes || claim.adminNotes,
          adminEmail,
        });
      } catch (e) {
        req.log.warn({ err: e }, "Failed to send settlement email (non-fatal)");
      }
    })();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to settle claim" });
  }
});

// ── POST /superadmin/claims/:id/charge ────────────────────────────────────────
router.post("/superadmin/claims/:id/charge", requireSuperAdmin, async (req, res) => {
  try {
    const claimId = Number(req.params.id);
    const { mode, amount, dueInDays = 7, installmentCount = 3, intervalDays = 30 } = req.body;

    if (!["link", "invoice", "installments"].includes(mode)) {
      return res.status(400).json({ error: "mode must be link, invoice, or installments" });
    }
    const amountFloat = parseFloat(amount);
    if (!amountFloat || amountFloat <= 0) return res.status(400).json({ error: "amount must be > 0" });

    const [claim] = await db.select().from(claimsTable).where(eq(claimsTable.id, claimId)).limit(1);
    if (!claim) return res.status(404).json({ error: "Claim not found" });

    const amountCents = Math.round(amountFloat * 100);
    const customerEmail = claim.customerEmail;
    const customerName  = claim.customerName;

    // Resolve tenant Stripe account if available
    let stripeAccountId: string | undefined;
    let tenantName = "OutdoorShare";
    let tenantEmail: string | undefined;
    if (claim.tenantId) {
      const [t] = await db
        .select({ sid: tenantsTable.stripeAccountId, enabled: tenantsTable.stripeChargesEnabled, name: tenantsTable.name, email: tenantsTable.email })
        .from(tenantsTable).where(eq(tenantsTable.id, claim.tenantId)).limit(1);
      if (t?.enabled && t.sid) stripeAccountId = t.sid;
      if (t?.name) tenantName = t.name;
      if (t?.email) tenantEmail = t.email;
    }
    const stripeOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined;

    const refs: string[] = [];
    let paymentUrl: string | null = null;

    if (mode === "link") {
      const product = await stripe.products.create(
        { name: `Damage Claim #${claimId} — ${tenantName}` },
        stripeOpts,
      );
      const price = await stripe.prices.create(
        { product: product.id, unit_amount: amountCents, currency: "usd" },
        stripeOpts,
      );
      const link = await stripe.paymentLinks.create(
        { line_items: [{ price: price.id, quantity: 1 }] },
        stripeOpts,
      );
      refs.push(link.id);
      paymentUrl = link.url;

    } else if (mode === "invoice") {
      const customer = await stripe.customers.create({ email: customerEmail, name: customerName }, stripeOpts);
      await stripe.invoiceItems.create(
        { customer: customer.id, amount: amountCents, currency: "usd", description: `Damage Claim #${claimId} — ${tenantName}` },
        stripeOpts,
      );
      const invoice = await stripe.invoices.create(
        { customer: customer.id, collection_method: "send_invoice", days_until_due: Number(dueInDays), auto_advance: false },
        stripeOpts,
      );
      const finalized = await stripe.invoices.finalizeInvoice(invoice.id, {}, stripeOpts);
      await stripe.invoices.sendInvoice(finalized.id, {}, stripeOpts);
      refs.push(finalized.id);
      paymentUrl = finalized.hosted_invoice_url ?? null;

    } else {
      // installments
      const n = Math.max(2, Math.min(12, Number(installmentCount)));
      const interval = Math.max(7, Number(intervalDays));
      const baseAmt = Math.floor(amountCents / n);
      const remainder = amountCents - baseAmt * n;

      const customer = await stripe.customers.create({ email: customerEmail, name: customerName }, stripeOpts);
      for (let i = 0; i < n; i++) {
        const instAmt = i === n - 1 ? baseAmt + remainder : baseAmt;
        await stripe.invoiceItems.create(
          { customer: customer.id, amount: instAmt, currency: "usd", description: `Damage Claim #${claimId} — Installment ${i + 1} of ${n}` },
          stripeOpts,
        );
        const inv = await stripe.invoices.create(
          { customer: customer.id, collection_method: "send_invoice", days_until_due: (i + 1) * interval, auto_advance: false },
          stripeOpts,
        );
        const fin = await stripe.invoices.finalizeInvoice(inv.id, {}, stripeOpts);
        await stripe.invoices.sendInvoice(fin.id, {}, stripeOpts);
        refs.push(fin.id);
        if (i === 0 && fin.hosted_invoice_url) paymentUrl = fin.hosted_invoice_url;
      }
    }

    // Persist charge info on claim
    await db.update(claimsTable).set({
      chargeMode: mode,
      chargeStatus: "pending",
      chargedAmount: amountFloat.toFixed(2),
      stripeChargeRefs: JSON.stringify(refs),
      updatedAt: new Date(),
    }).where(eq(claimsTable.id, claimId));

    // Notify renter by email (fire-and-forget)
    sendClaimChargeEmail({
      claimId, customerEmail, customerName, amount: amountFloat,
      mode, paymentUrl, tenantName, tenantEmail,
      installmentCount: Number(installmentCount),
      dueInDays: Number(dueInDays),
    }).catch(err => console.error("[claim charge email]", err));

    res.json({ ok: true, mode, refs, paymentUrl });
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: err.message ?? "Failed to process charge" });
  }
});

// ── GET /superadmin/customers/lookup — identity verification by email ──────────
router.get("/superadmin/customers/lookup", requireSuperAdmin, async (req, res) => {
  try {
    const email = (req.query.email as string ?? "").toLowerCase().trim();
    if (!email) { res.status(400).json({ error: "email required" }); return; }

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
      .where(eq(customersTable.email, email))
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

// ── GET /platform/agreement/fields (public — used by booking flow) ────────────
router.get("/platform/agreement/fields", async (_req, res) => {
  try {
    const [row] = await db.select().from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "rental_agreement_fields")).limit(1);
    res.json({ fields: row?.value ? JSON.parse(row.value) : [] });
  } catch {
    res.status(500).json({ error: "Failed to fetch fields" });
  }
});

// ── GET /platform/agreement (public — used by booking flow) ───────────────────
router.get("/platform/agreement", async (req, res) => {
  try {
    const { categorySlug } = req.query;
    // Try category-specific agreement first
    if (categorySlug && typeof categorySlug === "string") {
      const key = `rental_agreement_category_${categorySlug}`;
      const [catRow] = await db.select().from(platformSettingsTable)
        .where(eq(platformSettingsTable.key, key)).limit(1);
      if (catRow?.value) {
        return res.json({ value: catRow.value, updatedAt: catRow.updatedAt?.toISOString() ?? null, isCustom: true });
      }
    }
    // Fall back to global agreement
    const [row] = await db.select().from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "rental_agreement")).limit(1);
    res.json({ value: row?.value ?? "", updatedAt: row?.updatedAt?.toISOString() ?? null, isCustom: false });
  } catch {
    res.status(500).json({ error: "Failed to fetch agreement" });
  }
});

export default router;
