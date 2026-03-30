import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { adminUsersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const SALT = "rental_admin_salt_2024";

async function hashPassword(password: string): Promise<string> {
  const hash = (await scryptAsync(password, SALT, 64)) as Buffer;
  return hash.toString("hex");
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const supplied = (await scryptAsync(password, SALT, 64)) as Buffer;
  const storedBuf = Buffer.from(stored, "hex");
  if (supplied.length !== storedBuf.length) return false;
  return timingSafeEqual(supplied, storedBuf);
}

function safeUser(u: typeof adminUsersTable.$inferSelect) {
  const { passwordHash: _, token: __, ...safe } = u;
  return { ...safe, createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString() };
}

const router: IRouter = Router();

// POST /admin/auth/login
router.post("/admin/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
    const [user] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.email, email.toLowerCase().trim())).limit(1);
    if (!user || user.status !== "active") { res.status(401).json({ error: "Invalid email or password" }); return; }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Invalid email or password" }); return; }
    const token = randomBytes(32).toString("hex");
    await db.update(adminUsersTable).set({ token, updatedAt: new Date() }).where(eq(adminUsersTable.id, user.id));
    res.json({ token, user: safeUser({ ...user, token }) });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /admin/auth/logout
router.post("/admin/auth/logout", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"] as string;
    if (token) {
      await db.update(adminUsersTable).set({ token: null, updatedAt: new Date() }).where(eq(adminUsersTable.token, token));
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Logout failed" });
  }
});

// GET /admin/team
router.get("/admin/team", async (_req, res) => {
  try {
    const users = await db.select().from(adminUsersTable).orderBy(adminUsersTable.createdAt);
    res.json(users.map(safeUser));
  } catch {
    res.status(500).json({ error: "Failed to fetch team members" });
  }
});

// POST /admin/team
router.post("/admin/team", async (req, res) => {
  try {
    const { name, email, password, role, notes } = req.body;
    if (!name || !email || !password) { res.status(400).json({ error: "name, email and password are required" }); return; }
    if (password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
    const passwordHash = await hashPassword(password);
    const [user] = await db.insert(adminUsersTable).values({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role ?? "staff",
      notes: notes ?? null,
    }).returning();
    res.status(201).json(safeUser(user));
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Email already in use" }); return; }
    res.status(500).json({ error: "Failed to create team member" });
  }
});

// PUT /admin/team/:id
router.put("/admin/team/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, email, password, role, status, notes } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (name) updates.name = name.trim();
    if (email) updates.email = email.toLowerCase().trim();
    if (password) {
      if (password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
      updates.passwordHash = await hashPassword(password);
      updates.token = null;
    }
    if (role) updates.role = role;
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes || null;
    const [updated] = await db.update(adminUsersTable).set(updates).where(eq(adminUsersTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Team member not found" }); return; }
    res.json(safeUser(updated));
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Email already in use" }); return; }
    res.status(500).json({ error: "Failed to update team member" });
  }
});

// DELETE /admin/team/:id
router.delete("/admin/team/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(adminUsersTable).where(eq(adminUsersTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Team member not found" }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete team member" });
  }
});

export default router;
