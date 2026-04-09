import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tenantsTable, businessProfileTable, categoriesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { sendVerificationEmail } from "../services/gmail";

const APP_URL =
  process.env.APP_URL ||
  (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://outdoorshare.app");

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

const RESERVED_SLUGS = new Set([
  "admin", "api", "superadmin", "platform", "docs", "public", "signup",
  "get-started", "demo", "audit", "health", "static", "assets", "uploads",
  "login", "logout", "register", "account", "dashboard", "settings", "billing",
  "support", "help", "about", "contact", "privacy", "terms", "pricing",
  "www", "mail", "email", "ftp", "cdn", "media", "images",
]);

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
  const { adminPasswordHash: _, adminToken: __, ...safe } = t;
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

    // Find a unique slug (skip reserved words and existing slugs)
    let slug = baseSlug;
    let attempt = 0;
    while (true) {
      if (!RESERVED_SLUGS.has(slug)) {
        const [existing] = await db.select({ id: tenantsTable.id })
          .from(tenantsTable)
          .where(eq(tenantsTable.slug, slug))
          .limit(1);
        if (!existing) break;
      }
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

    const planMap: Record<string, "starter" | "professional" | "enterprise"> = {
      half_throttle: "starter",
      full_throttle: "professional",
      growth_scale: "enterprise",
      starter: "starter",
      professional: "professional",
      enterprise: "enterprise",
    };
    const normalizedPlan = planMap[plan] ?? "starter";

    const adminPasswordHash = await hashPassword(password);
    const [tenant] = await db.insert(tenantsTable).values({
      name: companyName.trim(),
      slug,
      email: email.toLowerCase().trim(),
      adminPasswordHash,
      plan: normalizedPlan,
      status: "active",
      contactName: contactName.trim(),
      phone: phone ?? null,
    }).returning();

    // Seed business profile with ONLY what the user actually provided — no placeholder text
    await db.insert(businessProfileTable).values({
      tenantId: tenant.id,
      name: companyName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || null,
      logoUrl: logoUrl?.trim() || null,
      tagline: null,
      description: null,
      location: null,
      updatedAt: new Date(),
    });

    // Seed default categories so the listing form dropdown is pre-populated
    await db.insert(categoriesTable).values(
      DEFAULT_CATEGORIES.map(c => ({ ...c, tenantId: tenant.id }))
    );

    // Generate an auth token so the user is auto-logged in immediately after signup —
    // no separate login step required, and the session is correctly scoped to this tenant.
    const adminToken = randomBytes(32).toString("hex");

    // Generate email verification token (expires in 24 hours)
    const emailVerificationToken = randomBytes(32).toString("hex");
    const emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.update(tenantsTable)
      .set({ adminToken, emailVerificationToken, emailVerificationExpiresAt, updatedAt: new Date() })
      .where(eq(tenantsTable.id, tenant.id));

    // Send verification email (non-blocking — don't fail the request if email fails)
    const verifyUrl = `${APP_URL}/verify-email?token=${emailVerificationToken}`;
    sendVerificationEmail({
      toEmail: email.toLowerCase().trim(),
      companyName: companyName.trim(),
      verifyUrl,
    }).catch(err => console.error("[signup] Failed to send verification email:", err?.message));

    res.status(201).json({
      tenant: safeTenant(tenant),
      adminEmail: email.toLowerCase().trim(),
      siteSlug: slug,
      adminToken,
      emailVerified: false,
      message: "Account created successfully. Please check your email to verify your address.",
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

// ── GET /public/verify-email ───────────────────────────────────────────────────
router.get("/public/verify-email", async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Invalid or missing token" });
    return;
  }

  const [tenant] = await db.select()
    .from(tenantsTable)
    .where(eq(tenantsTable.emailVerificationToken, token))
    .limit(1);

  if (!tenant) {
    res.status(404).json({ error: "Verification link is invalid or has already been used" });
    return;
  }

  if (tenant.emailVerified) {
    res.json({ alreadyVerified: true, message: "Email is already verified" });
    return;
  }

  if (tenant.emailVerificationExpiresAt && tenant.emailVerificationExpiresAt < new Date()) {
    res.status(410).json({ error: "Verification link has expired. Please request a new one." });
    return;
  }

  await db.update(tenantsTable)
    .set({
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(tenantsTable.id, tenant.id));

  res.json({ success: true, message: "Email verified successfully", tenantName: tenant.name, slug: tenant.slug });
});

// ── POST /public/resend-verification ──────────────────────────────────────────
router.post("/public/resend-verification", async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const [tenant] = await db.select()
    .from(tenantsTable)
    .where(eq(tenantsTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (!tenant) {
    // Don't reveal whether the email exists
    res.json({ message: "If that email is registered, a verification link has been sent." });
    return;
  }

  if (tenant.emailVerified) {
    res.json({ alreadyVerified: true, message: "Email is already verified" });
    return;
  }

  const emailVerificationToken = randomBytes(32).toString("hex");
  const emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.update(tenantsTable)
    .set({ emailVerificationToken, emailVerificationExpiresAt, updatedAt: new Date() })
    .where(eq(tenantsTable.id, tenant.id));

  const verifyUrl = `${APP_URL}/verify-email?token=${emailVerificationToken}`;
  sendVerificationEmail({
    toEmail: tenant.email,
    companyName: tenant.name,
    verifyUrl,
  }).catch(err => console.error("[resend-verification] Failed to send email:", err?.message));

  res.json({ message: "If that email is registered, a verification link has been sent." });
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
