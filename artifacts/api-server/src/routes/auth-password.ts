import { Router } from "express";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  tenantsTable,
  adminUsersTable,
  superadminUsersTable,
  customersTable,
  passwordResetTokensTable,
} from "@workspace/db/schema";
import { sendPasswordResetEmail } from "../services/gmail";
import { logInfo, logWarn } from "../lib/log";

const router = Router();
const scryptAsync = promisify(scrypt);

// ── Base URL helper ─────────────────────────────────────────────────────────────
function getBaseUrl(): string {
  if (process.env.APP_URL?.trim()) return process.env.APP_URL.trim().replace(/\/$/, "");
  if (process.env.REPLIT_DOMAINS) {
    const primary = process.env.REPLIT_DOMAINS.split(",")[0].trim();
    if (primary) return `https://${primary}`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "https://outdoorshare.rent";
}

// ── Password hashing helpers ────────────────────────────────────────────────────
const OWNER_SALT = "rental_admin_salt_2024";
const SA_SALT = "superadmin_salt_2024";

async function hashForOwner(password: string): Promise<string> {
  const hash = (await scryptAsync(password, OWNER_SALT, 64)) as Buffer;
  return hash.toString("hex");
}

async function hashWithPerUserSalt(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function hashForSuperAdmin(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

// ── POST /auth/forgot-password ──────────────────────────────────────────────────
// Always responds with 200 to prevent email enumeration.
router.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email: rawEmail, userType, tenantSlug } = req.body;
    if (!rawEmail || !userType) {
      res.json({ ok: true });
      return;
    }

    const email = String(rawEmail).toLowerCase().trim();

    // Verify the email exists in the appropriate table
    let accountExists = false;
    let accountLabel = "Admin";
    let companyName: string | undefined;

    if (userType === "owner") {
      const [tenant] = await db.select({ id: tenantsTable.id, name: tenantsTable.name })
        .from(tenantsTable)
        .where(eq(tenantsTable.email, email))
        .limit(1);
      accountExists = !!tenant;
      accountLabel = "Owner";
      companyName = tenant?.name ?? undefined;
    } else if (userType === "staff") {
      const [user] = await db.select({ id: adminUsersTable.id, tenantId: adminUsersTable.tenantId })
        .from(adminUsersTable)
        .where(eq(adminUsersTable.email, email))
        .limit(1);
      accountExists = !!user;
      accountLabel = "Staff";
      if (user?.tenantId) {
        const [tenant] = await db.select({ name: tenantsTable.name })
          .from(tenantsTable)
          .where(eq(tenantsTable.id, user.tenantId))
          .limit(1);
        companyName = tenant?.name ?? undefined;
      }
    } else if (userType === "superadmin") {
      const [user] = await db.select({ id: superadminUsersTable.id })
        .from(superadminUsersTable)
        .where(eq(superadminUsersTable.email, email))
        .limit(1);
      accountExists = !!user;
      accountLabel = "Super Admin";
    } else if (userType === "customer") {
      const [customer] = await db.select({ id: customersTable.id })
        .from(customersTable)
        .where(eq(customersTable.email, email))
        .limit(1);
      accountExists = !!customer;
      accountLabel = "Account";
    }

    if (!accountExists) {
      // Return ok to prevent enumeration — don't reveal whether email is registered
      logWarn("auth.forgot_password.email_not_found", { email, userType });
      res.json({ ok: true });
      return;
    }

    // Generate token (32 random bytes = 64 hex chars)
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokensTable).values({
      token,
      email,
      userType,
      tenantSlug: tenantSlug ?? null,
      expiresAt,
    });

    // Build reset URL
    const BASE = getBaseUrl();
    const resetUrl = `${BASE}/reset-password?token=${token}`;

    // Send email (fire-and-forget so we always return 200 quickly)
    sendPasswordResetEmail({
      toEmail: email,
      resetUrl,
      accountLabel,
      companyName,
    }).catch(err => {
      logWarn("auth.forgot_password.email_error", { email, error: err?.message });
    });

    logInfo("auth.forgot_password.sent", { email, userType });
    res.json({ ok: true });
  } catch (err: any) {
    req.log?.error(err);
    // Always return 200 to prevent enumeration
    res.json({ ok: true });
  }
});

// ── GET /auth/reset-password/validate/:token ────────────────────────────────────
// Validates a reset token and returns userType/tenantSlug so the frontend
// can show the right UI. Does NOT mark token as used.
router.get("/auth/reset-password/validate/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const [record] = await db.select()
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.token, token),
          isNull(passwordResetTokensTable.usedAt),
        )
      )
      .limit(1);

    if (!record) {
      res.status(404).json({ error: "Invalid or already used reset link." });
      return;
    }

    if (record.expiresAt < new Date()) {
      res.status(410).json({ error: "This reset link has expired. Please request a new one." });
      return;
    }

    res.json({
      valid: true,
      userType: record.userType,
      tenantSlug: record.tenantSlug ?? null,
      email: record.email,
    });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Could not validate reset link." });
  }
});

// ── POST /auth/reset-password ──────────────────────────────────────────────────
router.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword || String(newPassword).length < 8) {
      res.status(400).json({ error: "Token and a password of at least 8 characters are required." });
      return;
    }

    const [record] = await db.select()
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.token, token),
          isNull(passwordResetTokensTable.usedAt),
        )
      )
      .limit(1);

    if (!record) {
      res.status(404).json({ error: "Invalid or already used reset link." });
      return;
    }

    if (record.expiresAt < new Date()) {
      res.status(410).json({ error: "This reset link has expired. Please request a new one." });
      return;
    }

    const { email, userType } = record;

    // Hash the new password with the correct scheme for each account type
    if (userType === "owner") {
      const hash = await hashForOwner(newPassword);
      await db.update(tenantsTable)
        .set({ adminPasswordHash: hash, updatedAt: new Date() })
        .where(eq(tenantsTable.email, email));
    } else if (userType === "staff") {
      const hash = await hashWithPerUserSalt(newPassword);
      await db.update(adminUsersTable)
        .set({ passwordHash: hash, updatedAt: new Date() })
        .where(eq(adminUsersTable.email, email));
    } else if (userType === "superadmin") {
      const hash = await hashForSuperAdmin(newPassword);
      await db.update(superadminUsersTable)
        .set({ passwordHash: hash, updatedAt: new Date() })
        .where(eq(superadminUsersTable.email, email));
    } else if (userType === "customer") {
      const hash = await hashWithPerUserSalt(newPassword);
      await db.update(customersTable)
        .set({ passwordHash: hash, updatedAt: new Date() })
        .where(eq(customersTable.email, email));
    }

    // Mark token used
    await db.update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokensTable.token, token));

    logInfo("auth.reset_password.success", { email, userType });
    res.json({ ok: true, userType, tenantSlug: record.tenantSlug ?? null });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Failed to reset password. Please try again." });
  }
});

export default router;
