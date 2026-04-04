import { Router } from "express";
import { db } from "@workspace/db";
import {
  supportThreadsTable,
  supportMessagesTable,
  tenantsTable,
  businessProfileTable,
} from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireTenant } from "../middleware/admin-auth";
import { createNotification } from "../services/notifications";
import { sendChatMessageToAdminEmail, sendChatReplyToRenterEmail, withSmtpCreds, withBrand } from "../services/gmail";
import { getTenantSmtpCreds, getTenantBrand } from "../services/smtp-helper";

const router = Router();

// ── List threads ──────────────────────────────────────────────────────────────
// Admin: all threads for tenant; Renter: by email query param
router.get("/chat/threads", requireTenant, async (req, res) => {
  try {
    const { email } = req.query as { email?: string };

    const conditions = [eq(supportThreadsTable.tenantId, req.tenantId!)];
    if (email) conditions.push(eq(supportThreadsTable.customerEmail, email));

    const threads = await db
      .select()
      .from(supportThreadsTable)
      .where(and(...conditions))
      .orderBy(desc(supportThreadsTable.lastMessageAt))
      .limit(100);

    res.json(threads);
  } catch {
    res.status(500).json({ error: "Failed to fetch threads" });
  }
});

// ── Get unread count (admin) ───────────────────────────────────────────────────
router.get("/chat/unread-count", requireTenant, async (req, res) => {
  try {
    const [row] = await db
      .select({ total: sql<number>`coalesce(sum(unread_by_admin),0)::int` })
      .from(supportThreadsTable)
      .where(eq(supportThreadsTable.tenantId, req.tenantId!));
    res.json({ count: row?.total ?? 0 });
  } catch {
    res.json({ count: 0 });
  }
});

// ── Get thread + messages ─────────────────────────────────────────────────────
router.get("/chat/threads/:id", requireTenant, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [thread] = await db
      .select()
      .from(supportThreadsTable)
      .where(and(eq(supportThreadsTable.id, id), eq(supportThreadsTable.tenantId, req.tenantId!)));

    if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }

    const messages = await db
      .select()
      .from(supportMessagesTable)
      .where(eq(supportMessagesTable.threadId, id))
      .orderBy(supportMessagesTable.createdAt);

    res.json({ thread, messages });
  } catch {
    res.status(500).json({ error: "Failed to fetch thread" });
  }
});

// ── Create thread (renter) ────────────────────────────────────────────────────
router.post("/chat/threads", requireTenant, async (req, res) => {
  try {
    const { customerEmail, customerName, subject, body } = req.body as {
      customerEmail: string;
      customerName: string;
      subject?: string;
      body: string;
    };

    if (!customerEmail || !customerName || !body) {
      res.status(400).json({ error: "customerEmail, customerName, and body are required" });
      return;
    }

    // Check for existing open thread for this customer
    const [existing] = await db
      .select()
      .from(supportThreadsTable)
      .where(
        and(
          eq(supportThreadsTable.tenantId, req.tenantId!),
          eq(supportThreadsTable.customerEmail, customerEmail),
          eq(supportThreadsTable.status, "open"),
        ),
      )
      .limit(1);

    let threadId: number;
    if (existing) {
      threadId = existing.id;
    } else {
      const [created] = await db
        .insert(supportThreadsTable)
        .values({
          tenantId: req.tenantId!,
          customerEmail,
          customerName,
          subject: subject ?? "Chat",
          unreadByAdmin: 0,
          unreadByRenter: 0,
          lastMessageAt: new Date(),
        })
        .returning();
      threadId = created.id;
    }

    // Insert message
    const [msg] = await db
      .insert(supportMessagesTable)
      .values({
        threadId,
        senderType: "renter",
        senderName: customerName,
        body,
        isReadByAdmin: false,
        isReadByRenter: true,
      })
      .returning();

    // Update thread unread + lastMessageAt
    await db
      .update(supportThreadsTable)
      .set({
        unreadByAdmin: sql`unread_by_admin + 1`,
        lastMessageAt: new Date(),
        status: "open",
      })
      .where(eq(supportThreadsTable.id, threadId));

    // In-app notification for admin
    createNotification({
      tenantId: req.tenantId!,
      targetType: "admin",
      type: "new_chat_message",
      title: `New message from ${customerName}`,
      body: body.length > 80 ? body.substring(0, 80) + "…" : body,
      actionUrl: "/messages",
      isActionRequired: false,
      relatedId: threadId,
    }).catch(() => {});

    // Email admin
    try {
      const [tenant] = await db
        .select({ email: tenantsTable.email, slug: tenantsTable.slug })
        .from(tenantsTable)
        .where(eq(tenantsTable.id, req.tenantId!))
        .limit(1);
      const [profile] = await db
        .select({ name: businessProfileTable.name })
        .from(businessProfileTable)
        .where(eq(businessProfileTable.tenantId, req.tenantId!))
        .limit(1);
      if (tenant?.email) {
        sendChatMessageToAdminEmail({
          adminEmail: tenant.email,
          companyName: profile?.name ?? tenant.slug ?? "Your Company",
          customerName,
          customerEmail,
          messageBody: body,
          threadId,
          slug: tenant.slug,
        }).catch(() => {});
      }
    } catch {}

    res.status(201).json({ threadId, message: msg });
  } catch (err) {
    console.error("[chat] create thread:", err);
    res.status(500).json({ error: "Failed to create thread" });
  }
});

// ── Send message to existing thread ──────────────────────────────────────────
router.post("/chat/threads/:id/messages", requireTenant, async (req, res) => {
  try {
    const threadId = Number(req.params.id);
    const { senderType, senderName, body } = req.body as {
      senderType: "admin" | "renter";
      senderName: string;
      body: string;
    };

    if (!body || !senderType || !senderName) {
      res.status(400).json({ error: "senderType, senderName, and body are required" });
      return;
    }

    const [thread] = await db
      .select()
      .from(supportThreadsTable)
      .where(and(eq(supportThreadsTable.id, threadId), eq(supportThreadsTable.tenantId, req.tenantId!)));

    if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }

    const [msg] = await db
      .insert(supportMessagesTable)
      .values({
        threadId,
        senderType,
        senderName,
        body,
        isReadByAdmin: senderType === "admin",
        isReadByRenter: senderType === "renter",
      })
      .returning();

    // Update thread counters + lastMessageAt
    const isAdmin = senderType === "admin";
    await db
      .update(supportThreadsTable)
      .set({
        unreadByAdmin: isAdmin ? sql`unread_by_admin` : sql`unread_by_admin + 1`,
        unreadByRenter: isAdmin ? sql`unread_by_renter + 1` : sql`unread_by_renter`,
        lastMessageAt: new Date(),
      })
      .where(eq(supportThreadsTable.id, threadId));

    // Notifications + emails
    if (isAdmin) {
      // Notify renter
      createNotification({
        tenantId: req.tenantId!,
        targetType: "renter",
        targetEmail: thread.customerEmail,
        type: "chat_reply",
        title: "New message from the team",
        body: body.length > 80 ? body.substring(0, 80) + "…" : body,
        actionUrl: "/chat",
        isActionRequired: false,
        relatedId: threadId,
      }).catch(() => {});

      // Email renter
      try {
        const [tenant] = await db
          .select({ slug: tenantsTable.slug })
          .from(tenantsTable)
          .where(eq(tenantsTable.id, req.tenantId!))
          .limit(1);
        const [profile] = await db
          .select({ name: businessProfileTable.name, email: businessProfileTable.email, outboundEmail: businessProfileTable.outboundEmail })
          .from(businessProfileTable)
          .where(eq(businessProfileTable.tenantId, req.tenantId!))
          .limit(1);
        Promise.all([getTenantSmtpCreds(req.tenantId), getTenantBrand(req.tenantId)])
          .then(([smtpCreds, brand]) =>
            withBrand(brand, () => withSmtpCreds(smtpCreds, () => sendChatReplyToRenterEmail({
              renterEmail: thread.customerEmail,
              renterName: thread.customerName,
              companyName: profile?.name ?? tenant?.slug ?? "Your Company",
              companyEmail: profile?.outboundEmail ?? profile?.email ?? undefined,
              messageBody: body,
              threadId,
              slug: tenant?.slug ?? "",
            })))
          ).catch(() => {});
      } catch {}
    } else {
      // Notify admin
      createNotification({
        tenantId: req.tenantId!,
        targetType: "admin",
        type: "new_chat_message",
        title: `New message from ${senderName}`,
        body: body.length > 80 ? body.substring(0, 80) + "…" : body,
        actionUrl: "/messages",
        isActionRequired: false,
        relatedId: threadId,
      }).catch(() => {});
    }

    res.status(201).json(msg);
  } catch (err) {
    console.error("[chat] send message:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ── Mark thread as read ───────────────────────────────────────────────────────
router.patch("/chat/threads/:id/read", requireTenant, async (req, res) => {
  try {
    const threadId = Number(req.params.id);
    const { readerType } = req.body as { readerType: "admin" | "renter" };

    if (readerType === "admin") {
      await db
        .update(supportMessagesTable)
        .set({ isReadByAdmin: true })
        .where(eq(supportMessagesTable.threadId, threadId));
      await db
        .update(supportThreadsTable)
        .set({ unreadByAdmin: 0 })
        .where(and(eq(supportThreadsTable.id, threadId), eq(supportThreadsTable.tenantId, req.tenantId!)));
    } else {
      await db
        .update(supportMessagesTable)
        .set({ isReadByRenter: true })
        .where(eq(supportMessagesTable.threadId, threadId));
      await db
        .update(supportThreadsTable)
        .set({ unreadByRenter: 0 })
        .where(and(eq(supportThreadsTable.id, threadId), eq(supportThreadsTable.tenantId, req.tenantId!)));
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

// ── Close / reopen thread (admin) ─────────────────────────────────────────────
router.patch("/chat/threads/:id/status", requireTenant, async (req, res) => {
  try {
    const threadId = Number(req.params.id);
    const { status } = req.body as { status: "open" | "closed" };

    await db
      .update(supportThreadsTable)
      .set({ status })
      .where(and(eq(supportThreadsTable.id, threadId), eq(supportThreadsTable.tenantId, req.tenantId!)));

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to update thread status" });
  }
});

export default router;
