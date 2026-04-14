import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { adminUsersTable, tenantsTable, businessProfileTable } from "@workspace/db/schema";
import { eq, and, count } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { requireAdminToken } from "../middleware/admin-auth";
import { sendStaffInviteEmail } from "../services/gmail";

const STARTER_TEAM_LIMIT = 2;

const APP_URL =
  process.env.APP_URL ||
  (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://myoutdoorshare.com");

const scryptAsync = promisify(scrypt);
const SALT = "rental_admin_salt_2024";

async function hashPassword(password: string): Promise<string> {
  const hash = (await scryptAsync(password, SALT, 64)) as Buffer;
  return hash.toString("hex");
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    if (stored.includes(":")) {
      const [salt, storedHash] = stored.split(":");
      const hash = (await scryptAsync(password, salt, 64)) as Buffer;
      const storedBuf = Buffer.from(storedHash, "hex");
      if (hash.length !== storedBuf.length) return false;
      return timingSafeEqual(hash, storedBuf);
    } else {
      const supplied = (await scryptAsync(password, SALT, 64)) as Buffer;
      const storedBuf = Buffer.from(stored, "hex");
      if (supplied.length !== storedBuf.length) return false;
      return timingSafeEqual(supplied, storedBuf);
    }
  } catch {
    return false;
  }
}

function safeUser(u: typeof adminUsersTable.$inferSelect) {
  const { passwordHash: _, token: __, inviteToken: ___, ...safe } = u;
  const inviteStatus = !u.inviteAccepted && u.inviteToken
    ? (u.inviteExpiresAt && u.inviteExpiresAt < new Date() ? "expired" : "pending")
    : (u.inviteAccepted ? "accepted" : "none");
  return {
    ...safe,
    inviteStatus,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    inviteExpiresAt: u.inviteExpiresAt?.toISOString() ?? null,
  };
}

async function getCompanyInfo(tenantId: number) {
  const [tenant] = await db.select({ slug: tenantsTable.slug, email: tenantsTable.email, name: tenantsTable.name })
    .from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  const [biz] = await db.select({ name: businessProfileTable.name, email: businessProfileTable.outboundEmail })
    .from(businessProfileTable).where(eq(businessProfileTable.tenantId, tenantId));
  return {
    slug: tenant?.slug ?? "",
    companyName: biz?.name ?? tenant?.name ?? "Your Company",
    companyEmail: biz?.email ?? tenant?.email ?? null,
  };
}

const router: IRouter = Router();

// POST /admin/auth/owner-login — tenant owner login
router.post("/admin/auth/owner-login", async (req, res) => {
  try {
    const { email, password, slug } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }

    const [tenant] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (slug && tenant && tenant.slug !== slug) {
      res.status(401).json({
        error: "These credentials belong to a different company admin panel.",
        correctSlug: tenant.slug,
      });
      return;
    }

    if (!tenant || tenant.status !== "active") {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await verifyPassword(password, tenant.adminPasswordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = tenant.adminToken ?? randomBytes(32).toString("hex");
    if (!tenant.adminToken) {
      await db
        .update(tenantsTable)
        .set({ adminToken: token, updatedAt: new Date() })
        .where(eq(tenantsTable.id, tenant.id));
    }

    res.cookie("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      token,
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      email: tenant.email,
      emailVerified: tenant.emailVerified,
    });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /admin/auth/universal-login — email + password only, no slug required
router.post("/admin/auth/universal-login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }
    const normalizedEmail = email.toLowerCase().trim();

    // Collect all matches (owner accounts + staff accounts for this email)
    const matches: Array<{
      type: "owner" | "staff";
      tenantId: number;
      tenantSlug: string;
      tenantName: string;
      token: string;
      userId?: number;
      userName?: string;
      role?: string;
    }> = [];

    // 1. Check owner accounts
    const ownerTenants = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.email, normalizedEmail));

    for (const tenant of ownerTenants) {
      if (tenant.status !== "active") continue;
      const valid = await verifyPassword(password, tenant.adminPasswordHash);
      if (!valid) continue;
      const token = tenant.adminToken ?? randomBytes(32).toString("hex");
      if (!tenant.adminToken) {
        await db.update(tenantsTable).set({ adminToken: token, updatedAt: new Date() }).where(eq(tenantsTable.id, tenant.id));
      }
      const companyInfo = await getCompanyInfo(tenant.id);
      matches.push({ type: "owner", tenantId: tenant.id, tenantSlug: tenant.slug, tenantName: companyInfo.companyName, token });
    }

    // 2. Check staff accounts
    const staffUsers = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.email, normalizedEmail));

    for (const user of staffUsers) {
      if (user.status !== "active") continue;
      if (!user.passwordHash) continue;
      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) continue;
      if (!user.tenantId) continue;
      const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, user.tenantId)).limit(1);
      if (!tenant || tenant.status !== "active") continue;
      const newToken = randomBytes(32).toString("hex");
      await db.update(adminUsersTable).set({ token: newToken, updatedAt: new Date() }).where(eq(adminUsersTable.id, user.id));
      const companyInfo = await getCompanyInfo(tenant.id);
      matches.push({ type: "staff", tenantId: tenant.id, tenantSlug: tenant.slug, tenantName: companyInfo.companyName, token: newToken, userId: user.id, userName: user.name, role: user.role });
    }

    if (matches.length === 0) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // If exactly one match, log them in immediately
    if (matches.length === 1) {
      const m = matches[0];
      res.cookie("admin_session", m.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.json({ single: true, token: m.token, match: { type: m.type, tenantId: m.tenantId, tenantSlug: m.tenantSlug, tenantName: m.tenantName, userId: m.userId, userName: m.userName, role: m.role } });
      return;
    }

    // Multiple matches — return list for selector (no cookie set yet; client will call login with slug after selection)
    res.json({
      single: false,
      accounts: matches.map(m => ({ type: m.type, tenantId: m.tenantId, tenantSlug: m.tenantSlug, tenantName: m.tenantName, userId: m.userId, userName: m.userName, role: m.role })),
    });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /admin/auth/login — staff member login
router.post("/admin/auth/login", async (req, res) => {
  try {
    const { email, password, slug } = req.body;
    if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
    const [user] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.email, email.toLowerCase().trim())).limit(1);
    if (!user || user.status !== "active") { res.status(401).json({ error: "Invalid email or password" }); return; }

    // Block invite-pending users who haven't set a password yet
    if (!user.passwordHash) {
      res.status(401).json({ error: "Please check your email to set your password before logging in." });
      return;
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Invalid email or password" }); return; }

    let tenantSlug: string | null = null;
    let tenantId: number | null = user.tenantId ?? null;
    if (user.tenantId) {
      const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, user.tenantId)).limit(1);
      if (tenant) {
        tenantSlug = tenant.slug;
        if (slug && tenant.slug !== slug) {
          res.status(401).json({ error: "These credentials are not authorized for this admin panel." });
          return;
        }
      }
    }

    const token = randomBytes(32).toString("hex");
    await db.update(adminUsersTable).set({ token, updatedAt: new Date() }).where(eq(adminUsersTable.id, user.id));

    res.cookie("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ token, tenantId, tenantSlug, user: safeUser(user) });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

// GET /admin/auth/verify
router.get("/admin/auth/verify", async (req, res) => {
  if (!req.tenantId) {
    res.status(401).json({ error: "Session expired or invalid" });
    return;
  }
  res.json({ valid: true, tenantId: req.tenantId });
});

// POST /admin/auth/logout
router.post("/admin/auth/logout", async (req, res) => {
  try {
    const token = (req as any).cookies?.admin_session ?? req.headers["x-admin-token"] as string | undefined;
    if (token) {
      await db.update(adminUsersTable).set({ token: null, updatedAt: new Date() }).where(eq(adminUsersTable.token, token));
      await db.update(tenantsTable).set({ adminToken: null, updatedAt: new Date() }).where(eq(tenantsTable.adminToken, token));
    }
    res.clearCookie("admin_session", { path: "/" });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Logout failed" });
  }
});

// GET /admin/team
router.get("/admin/team", requireAdminToken as any, async (req, res) => {
  try {
    const users = await db.select().from(adminUsersTable)
      .where(eq(adminUsersTable.tenantId, req.tenantId!))
      .orderBy(adminUsersTable.createdAt);
    res.json(users.map(safeUser));
  } catch {
    res.status(500).json({ error: "Failed to fetch team members" });
  }
});

// GET /admin/team/accept-invite?token=... — verify invite token (public)
router.get("/admin/team/accept-invite", async (req, res) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) { res.status(400).json({ error: "Token required" }); return; }

    const [user] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.inviteToken, token)).limit(1);
    if (!user) { res.status(404).json({ error: "Invalid or expired invitation" }); return; }
    if (user.inviteAccepted) { res.status(409).json({ error: "Invitation already accepted" }); return; }
    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) { res.status(410).json({ error: "Invitation has expired" }); return; }

    // Return safe info for the accept form
    const [tenant] = user.tenantId
      ? await db.select({ slug: tenantsTable.slug }).from(tenantsTable).where(eq(tenantsTable.id, user.tenantId))
      : [];

    res.json({ name: user.name, email: user.email, role: user.role, tenantSlug: tenant?.slug ?? null });
  } catch {
    res.status(500).json({ error: "Failed to verify invitation" });
  }
});

// POST /admin/team/accept-invite — set password from invite token (public)
router.post("/admin/team/accept-invite", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) { res.status(400).json({ error: "Token and password required" }); return; }
    if (password.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters" }); return; }

    const [user] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.inviteToken, token)).limit(1);
    if (!user) { res.status(404).json({ error: "Invalid or expired invitation" }); return; }
    if (user.inviteAccepted) { res.status(409).json({ error: "Invitation already accepted" }); return; }
    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) { res.status(410).json({ error: "Invitation has expired. Ask your admin to resend the invite." }); return; }

    const passwordHash = await hashPassword(password);
    await db.update(adminUsersTable).set({
      passwordHash,
      inviteToken: null,
      inviteAccepted: true,
      status: "active",
      updatedAt: new Date(),
    }).where(eq(adminUsersTable.id, user.id));

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to accept invitation" });
  }
});

// POST /admin/team — create staff member and send invite email
router.post("/admin/team", requireAdminToken as any, async (req, res) => {
  try {
    const { name, email, role, notes } = req.body;
    if (!name || !email) { res.status(400).json({ error: "Name and email are required" }); return; }

    const tenantId = req.tenantId!;

    // Enforce team member limit for starter (Half Throttle) plan
    const [tenant] = await db.select({ plan: tenantsTable.plan }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
    if (tenant?.plan === "starter" || !tenant?.plan) {
      const [{ value: memberCount }] = await db.select({ value: count() }).from(adminUsersTable).where(eq(adminUsersTable.tenantId, tenantId));
      if (memberCount >= STARTER_TEAM_LIMIT) {
        res.status(403).json({
          error: `The Half Throttle plan includes up to ${STARTER_TEAM_LIMIT} team members. Upgrade to Full Throttle for unlimited team members.`,
          planLimit: true,
        });
        return;
      }
    }
    const inviteToken = randomBytes(32).toString("hex");
    const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const [user] = await db.insert(adminUsersTable).values({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: null,
      role: role ?? "staff",
      notes: notes ?? null,
      tenantId,
      inviteToken,
      inviteExpiresAt,
      inviteAccepted: false,
      status: "active",
    }).returning();

    // Send invite email — best-effort
    try {
      const { slug, companyName, companyEmail } = await getCompanyInfo(tenantId);
      const inviteUrl = `${APP_URL}/${slug}/admin/accept-invite?token=${inviteToken}`;
      await sendStaffInviteEmail({ toEmail: user.email, toName: user.name, role: user.role, inviteUrl, companyName, companyEmail });
    } catch (emailErr: any) {
      console.warn("[admin/team] Failed to send invite email:", emailErr.message);
    }

    res.status(201).json(safeUser(user));
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Email already in use" }); return; }
    res.status(500).json({ error: "Failed to create team member" });
  }
});

// POST /admin/team/:id/resend-invite — regenerate invite token and resend email
router.post("/admin/team/:id/resend-invite", requireAdminToken as any, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tenantId = req.tenantId!;

    const [user] = await db.select().from(adminUsersTable)
      .where(and(eq(adminUsersTable.id, id), eq(adminUsersTable.tenantId, tenantId)));
    if (!user) { res.status(404).json({ error: "Team member not found" }); return; }
    if (user.inviteAccepted) { res.status(400).json({ error: "This user has already accepted their invitation" }); return; }

    const inviteToken = randomBytes(32).toString("hex");
    const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await db.update(adminUsersTable).set({ inviteToken, inviteExpiresAt, updatedAt: new Date() })
      .where(eq(adminUsersTable.id, id));

    try {
      const { slug, companyName, companyEmail } = await getCompanyInfo(tenantId);
      const inviteUrl = `${APP_URL}/${slug}/admin/accept-invite?token=${inviteToken}`;
      await sendStaffInviteEmail({ toEmail: user.email, toName: user.name, role: user.role, inviteUrl, companyName, companyEmail });
    } catch (emailErr: any) {
      console.warn("[admin/team] Failed to resend invite email:", emailErr.message);
      res.status(500).json({ error: "Invite token regenerated but email failed to send" });
      return;
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to resend invite" });
  }
});

// PUT /admin/team/:id
router.put("/admin/team/:id", requireAdminToken as any, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, email, password, role, status, notes } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (name) updates.name = name.trim();
    if (email) updates.email = email.toLowerCase().trim();
    if (password) {
      if (password.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters" }); return; }
      updates.passwordHash = await hashPassword(password);
      updates.token = null;
    }
    if (role) updates.role = role;
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes || null;

    const [updated] = await db.update(adminUsersTable).set(updates)
      .where(and(eq(adminUsersTable.id, id), eq(adminUsersTable.tenantId, req.tenantId!)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Team member not found" }); return; }
    res.json(safeUser(updated));
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Email already in use" }); return; }
    res.status(500).json({ error: "Failed to update team member" });
  }
});

// DELETE /admin/team/:id
router.delete("/admin/team/:id", requireAdminToken as any, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(adminUsersTable)
      .where(and(eq(adminUsersTable.id, id), eq(adminUsersTable.tenantId, req.tenantId!)))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Team member not found" }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete team member" });
  }
});

export default router;
