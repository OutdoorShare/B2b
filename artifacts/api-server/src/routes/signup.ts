import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tenantsTable, businessProfileTable, categoriesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const DEFAULT_CATEGORIES = [
  { name: "Jet Ski",         slug: "jet-ski",         icon: "🚤" },
  { name: "RV",              slug: "rv",               icon: "🚌" },
  { name: "ATV",             slug: "atv",              icon: "🏍️" },
  { name: "UTV",             slug: "utv",              icon: "🚗" },
  { name: "Boat",            slug: "boat",             icon: "⛵" },
  { name: "Dirt Bike",       slug: "dirt-bike",        icon: "🏍️" },
  { name: "Ebike",           slug: "ebike",            icon: "🚲" },
  { name: "Utility Trailer", slug: "utility-trailer",  icon: "🚛" },
  { name: "Snowmobile",      slug: "snowmobile",       icon: "❄️" },
  { name: "Towing Vehicle",  slug: "towing-vehicle",   icon: "🚙" },
];

const scryptAsync = promisify(scrypt);
const router: IRouter = Router();

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

function safeTenant(t: typeof tenantsTable.$inferSelect) {
  const { adminPasswordHash: _, ...safe } = t;
  return { ...safe, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() };
}

// ── POST /public/signup ───────────────────────────────────────────────────────
// Public endpoint — creates a new tenant account
router.post("/public/signup", async (req, res) => {
  try {
    const { companyName, contactName, email, password, plan, phone, logoUrl } = req.body;

    if (!companyName || !contactName || !email || !password) {
      res.status(400).json({ error: "companyName, contactName, email and password are required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const baseSlug = slugify(companyName);
    if (!baseSlug) {
      res.status(400).json({ error: "Invalid company name" });
      return;
    }

    // Find a unique slug
    let slug = baseSlug;
    let attempt = 0;
    while (true) {
      const [existing] = await db.select({ id: tenantsTable.id })
        .from(tenantsTable)
        .where(eq(tenantsTable.slug, slug))
        .limit(1);
      if (!existing) break;
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    // Check email uniqueness
    const [emailExists] = await db.select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.email, email.toLowerCase().trim()))
      .limit(1);
    if (emailExists) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const adminPasswordHash = await hashPassword(password);
    const trialEndsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const [tenant] = await db.insert(tenantsTable).values({
      name: companyName.trim(),
      slug,
      email: email.toLowerCase().trim(),
      adminPasswordHash,
      plan: plan ?? "starter",
      status: "active",
      contactName: contactName.trim(),
      phone: phone ?? null,
      trialEndsAt,
    }).returning();

    // Seed business profile with signup info so new owners see their real data immediately
    await db.insert(businessProfileTable).values({
      tenantId: tenant.id,
      name: companyName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || "(555) 000-0000",
      logoUrl: logoUrl?.trim() || null,
      tagline: "Quality gear for your next adventure",
      description: `Welcome to ${companyName.trim()}! We provide top-quality rental gear for your next adventure.`,
      location: "Your City, State",
      updatedAt: new Date(),
    });

    // Seed default categories so the listing form dropdown is pre-populated
    await db.insert(categoriesTable).values(
      DEFAULT_CATEGORIES.map(c => ({ ...c, tenantId: tenant.id }))
    );

    res.status(201).json({
      tenant: safeTenant(tenant),
      adminEmail: email.toLowerCase().trim(),
      siteSlug: slug,
      message: "Account created successfully",
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Company name or email already taken" });
      return;
    }
    console.error("[signup]", err);
    res.status(500).json({ error: "Failed to create account" });
  }
});

// ── GET /public/check-slug ─────────────────────────────────────────────────────
router.get("/public/check-slug", async (req, res) => {
  const { slug } = req.query;
  if (!slug || typeof slug !== "string") { res.json({ available: false }); return; }
  const clean = slugify(slug);
  const [existing] = await db.select({ id: tenantsTable.id })
    .from(tenantsTable).where(eq(tenantsTable.slug, clean)).limit(1);
  res.json({ available: !existing, slug: clean });
});

export default router;
