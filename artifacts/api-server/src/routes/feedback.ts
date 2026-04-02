import { Router, type Request, type Response } from "express";
import { db, feedbackTable, superadminUsersTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router = Router();

async function requireSuperAdmin(req: Request, res: Response, next: () => void) {
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

// POST /api/feedback — renter or admin submits feedback
router.post("/feedback", async (req: Request, res: Response) => {
  try {
    const { submitterType, submitterName, submitterEmail, subject, message, rating, tenantSlug, tenantName, tenantId } = req.body;

    if (!submitterType || !submitterName || !submitterEmail || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!["renter", "admin"].includes(submitterType)) {
      return res.status(400).json({ error: "Invalid submitter type" });
    }
    if (rating !== undefined && rating !== null && (rating < 1 || rating > 5)) {
      return res.status(400).json({ error: "Rating must be 1–5" });
    }

    const [row] = await db.insert(feedbackTable).values({
      submitterType,
      submitterName: submitterName.trim(),
      submitterEmail: submitterEmail.trim().toLowerCase(),
      subject: subject?.trim() || null,
      message: message.trim(),
      rating: rating ? Number(rating) : null,
      tenantSlug: tenantSlug || null,
      tenantName: tenantName || null,
      tenantId: tenantId ? Number(tenantId) : null,
    }).returning();

    res.json({ success: true, id: row.id });
  } catch (err) {
    console.error("[feedback] POST error:", err);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

// GET /api/superadmin/feedback — list all feedback (superadmin only)
router.get("/superadmin/feedback", requireSuperAdmin as any, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(feedbackTable).orderBy(desc(feedbackTable.createdAt));
    res.json(rows);
  } catch (err) {
    console.error("[feedback] GET superadmin error:", err);
    res.status(500).json({ error: "Failed to load feedback" });
  }
});

export default router;
