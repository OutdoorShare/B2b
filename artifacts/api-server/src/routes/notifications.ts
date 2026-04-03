import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireTenant } from "../middleware/admin-auth";

const router = Router();

router.get("/notifications", requireTenant, async (req, res) => {
  try {
    const items = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.tenantId, req.tenantId!),
          eq(notificationsTable.targetType, "admin"),
        ),
      )
      .orderBy(desc(notificationsTable.createdAt))
      .limit(60);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.get("/notifications/renter", requireTenant, async (req, res) => {
  try {
    const email = req.query.email as string | undefined;
    if (!email) { res.json([]); return; }

    const items = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.tenantId, req.tenantId!),
          eq(notificationsTable.targetType, "renter"),
          eq(notificationsTable.targetEmail, email),
        ),
      )
      .orderBy(desc(notificationsTable.createdAt))
      .limit(40);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch renter notifications" });
  }
});

router.patch("/notifications/read-all", requireTenant, async (req, res) => {
  try {
    const { targetType, email } = req.body as { targetType: string; email?: string };
    const conditions: ReturnType<typeof eq>[] = [
      eq(notificationsTable.tenantId, req.tenantId!),
      eq(notificationsTable.targetType, targetType as "admin" | "renter"),
    ];
    if (email) conditions.push(eq(notificationsTable.targetEmail, email));

    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(and(...conditions));

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

router.patch("/notifications/:id/read", requireTenant, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.tenantId, req.tenantId!)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

export default router;
