import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { bookingsTable, messageLogs, automationSettings, businessProfileTable } from "@workspace/db/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import { sendBlastEmail, withSmtpCreds } from "../services/gmail";
import { getTenantSmtpCreds } from "../services/smtp-helper";

const router: IRouter = Router();

const DEFAULT_AUTOMATIONS = [
  {
    trigger: "booking_confirmed",
    name: "Booking Confirmed",
    description: "Sent when a booking is confirmed by the admin",
    emailEnabled: true,
    smsEnabled: false,
    subject: "Your booking is confirmed! 🎉",
    bodyTemplate: `Hi {{customerName}},\n\nGreat news! Your booking for {{listingTitle}} has been confirmed.\n\nBooking Details:\n• Dates: {{startDate}} – {{endDate}}\n• Total: \${{totalPrice}}\n\nWe look forward to seeing you. If you have any questions, don't hesitate to reach out.\n\nSee you soon,\n{{businessName}}`,
  },
  {
    trigger: "booking_reminder",
    name: "Upcoming Rental Reminder",
    description: "Sent 24 hours before the rental starts",
    emailEnabled: true,
    smsEnabled: true,
    subject: "Your rental starts tomorrow! 🏕️",
    bodyTemplate: `Hi {{customerName}},\n\nJust a reminder — your rental of {{listingTitle}} starts tomorrow, {{startDate}}.\n\nPlease make sure to bring:\n• A valid ID\n• Your booking confirmation\n\nWe'll have everything ready for you. See you tomorrow!\n\n{{businessName}}`,
  },
  {
    trigger: "booking_activated",
    name: "Rental Started",
    description: "Sent when the rental is marked as active/in progress",
    emailEnabled: true,
    smsEnabled: true,
    subject: "Your rental is now active — enjoy! 🚀",
    bodyTemplate: `Hi {{customerName}},\n\nYour rental of {{listingTitle}} is now active. Enjoy your adventure!\n\nYour rental runs through {{endDate}}. Please reach out if you need anything during your rental period.\n\nHave a great time,\n{{businessName}}`,
  },
  {
    trigger: "booking_completed",
    name: "Rental Completed",
    description: "Sent when the rental is marked as completed",
    emailEnabled: true,
    smsEnabled: false,
    subject: "Thanks for renting with us! How was it? ⭐",
    bodyTemplate: `Hi {{customerName}},\n\nYour rental of {{listingTitle}} has been completed. We hope you had an amazing experience!\n\nWe'd love to hear how it went — reviews help other renters and help us improve.\n\nThanks for choosing us, and we hope to see you again!\n\n{{businessName}}`,
  },
  {
    trigger: "booking_cancelled",
    name: "Booking Cancelled",
    description: "Sent when a booking is cancelled",
    emailEnabled: true,
    smsEnabled: false,
    subject: "Your booking has been cancelled",
    bodyTemplate: `Hi {{customerName}},\n\nYour booking for {{listingTitle}} ({{startDate}} – {{endDate}}) has been cancelled.\n\nIf you have any questions about your cancellation or need to rebook, please contact us directly.\n\nWe hope to serve you again in the future.\n\n{{businessName}}`,
  },
];

async function seedAutomationsForTenant(tenantId: number | null) {
  if (!tenantId) return; // Only seed for known tenants
  for (const auto of DEFAULT_AUTOMATIONS) {
    const existing = await db
      .select()
      .from(automationSettings)
      .where(and(eq(automationSettings.trigger, auto.trigger), eq(automationSettings.tenantId, tenantId)));
    if (existing.length === 0) {
      await db.insert(automationSettings).values({ ...auto, tenantId });
    }
  }
}

// GET /api/communications/renters?filter=all|future|active|past
router.get("/communications/renters", async (req, res) => {
  try {
    const filter = (req.query.filter as string) || "all";
    const today = new Date().toISOString().split("T")[0];

    const conditions: any[] = [];
    if (req.tenantId) conditions.push(eq(bookingsTable.tenantId, req.tenantId));
    if (filter === "future") {
      conditions.push(gt(bookingsTable.startDate, today));
      conditions.push(eq(bookingsTable.status, "confirmed"));
    } else if (filter === "active") {
      conditions.push(eq(bookingsTable.status, "active"));
    } else if (filter === "past") {
      conditions.push(eq(bookingsTable.status, "completed"));
    }

    const rows = await db
      .select()
      .from(bookingsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bookingsTable.createdAt));

    const seen = new Set<string>();
    const renters = rows
      .filter((b) => {
        if (seen.has(b.customerEmail)) return false;
        seen.add(b.customerEmail);
        return true;
      })
      .map((b) => ({
        bookingId: b.id,
        name: b.customerName,
        email: b.customerEmail,
        phone: b.customerPhone,
        status: b.status,
        startDate: b.startDate,
        endDate: b.endDate,
      }));

    res.json(renters);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch renters" });
  }
});

// POST /api/communications/send
router.post("/communications/send", async (req, res) => {
  try {
    const { recipients, channel, subject, body } = req.body;
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({ error: "recipients array is required" });
      return;
    }
    if (!body) {
      res.status(400).json({ error: "body is required" });
      return;
    }

    // Look up business profile for sender identity
    let companyName = "Your Rental Company";
    let companyEmail: string | null = null;
    if (req.tenantId) {
      const [biz] = await db.select().from(businessProfileTable).where(eq(businessProfileTable.tenantId, req.tenantId)).limit(1);
      if (biz) {
        companyName = biz.name ?? companyName;
        companyEmail = biz.outboundEmail ?? biz.email ?? null;
      }
    }
    const smtpCreds = await getTenantSmtpCreds(req.tenantId);

    const logs = [];
    const emailChannel = channel === "email" || channel === "both" || !channel;

    for (const r of recipients) {
      let status: "sent" | "failed" | "simulated" = "simulated";
      let errorMsg: string | undefined;

      // Attempt real email delivery
      if (emailChannel && r.email) {
        try {
          await withSmtpCreds(smtpCreds, () => sendBlastEmail({
            toEmail: r.email,
            customerName: r.name || "there",
            subject: subject || `Message from ${companyName}`,
            bodyText: body,
            companyName,
            companyEmail,
          }));
          status = "sent";
        } catch (emailErr: any) {
          req.log.warn({ emailErr }, "Failed to send blast email (logging anyway)");
          status = "failed";
          errorMsg = emailErr?.message;
        }
      }

      const [log] = await db
        .insert(messageLogs)
        .values({
          tenantId: req.tenantId ?? null,
          bookingId: r.bookingId || null,
          customerName: r.name,
          customerEmail: r.email,
          customerPhone: r.phone || null,
          channel: channel || "email",
          subject: subject || null,
          body,
          trigger: "manual",
          status,
        })
        .returning();
      logs.push({ ...log, errorMsg });
    }

    const sentCount = logs.filter(l => l.status === "sent").length;
    const failedCount = logs.filter(l => l.status === "failed").length;
    res.json({ sent: sentCount, failed: failedCount, total: logs.length, logs });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to send messages" });
  }
});

// POST /api/communications/send-automation — triggered on booking status change
// tenantId can be passed in the body for internal calls from bookings route
router.post("/communications/send-automation", async (req, res) => {
  try {
    const { trigger, bookingId, tenantId: bodyTenantId } = req.body;
    if (!trigger || !bookingId) {
      res.status(400).json({ error: "trigger and bookingId are required" });
      return;
    }

    const effectiveTenantId: number | null = req.tenantId ?? bodyTenantId ?? null;

    // Look up automation for this tenant (fall back to null-tenant if none found)
    const autoConditions = [eq(automationSettings.trigger, trigger)];
    if (effectiveTenantId) autoConditions.push(eq(automationSettings.tenantId, effectiveTenantId));
    const [automation] = await db
      .select()
      .from(automationSettings)
      .where(and(...autoConditions));

    if (!automation || (!automation.emailEnabled && !automation.smsEnabled)) {
      res.json({ skipped: true });
      return;
    }

    const bookingConditions = [eq(bookingsTable.id, bookingId)];
    if (effectiveTenantId) bookingConditions.push(eq(bookingsTable.tenantId, effectiveTenantId));
    const [booking] = await db.select().from(bookingsTable).where(and(...bookingConditions));
    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    // Look up business profile for sender identity
    let companyName = "Your Rental Company";
    let companyEmail: string | null = null;
    if (effectiveTenantId) {
      const [biz] = await db.select().from(businessProfileTable).where(eq(businessProfileTable.tenantId, effectiveTenantId)).limit(1);
      if (biz) {
        companyName = biz.name ?? companyName;
        companyEmail = biz.outboundEmail ?? biz.email ?? null;
      }
    }

    const body = automation.bodyTemplate
      .replace(/{{customerName}}/g, booking.customerName)
      .replace(/{{startDate}}/g, booking.startDate)
      .replace(/{{endDate}}/g, booking.endDate)
      .replace(/{{totalPrice}}/g, booking.totalPrice?.toString() ?? "")
      .replace(/{{businessName}}/g, companyName);

    const channel = automation.emailEnabled && automation.smsEnabled
      ? "both"
      : automation.emailEnabled
      ? "email"
      : "sms";

    // Attempt real email delivery for email channel
    const smtpCreds = await getTenantSmtpCreds(req.tenantId);
    let status: "sent" | "failed" | "simulated" = "simulated";
    if (automation.emailEnabled && booking.customerEmail) {
      try {
        await withSmtpCreds(smtpCreds, () => sendBlastEmail({
          toEmail: booking.customerEmail,
          customerName: booking.customerName,
          subject: automation.subject || `Message from ${companyName}`,
          bodyText: body,
          companyName,
          companyEmail,
        }));
        status = "sent";
      } catch (emailErr) {
        req.log.warn({ emailErr }, "Failed to send automation email (logging anyway)");
        status = "failed";
      }
    }

    const [log] = await db
      .insert(messageLogs)
      .values({
        tenantId: effectiveTenantId,
        bookingId,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        channel,
        subject: automation.subject || null,
        body,
        trigger,
        status,
      })
      .returning();

    res.json({ sent: 1, log });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to send automation" });
  }
});

// GET /api/communications/logs
router.get("/communications/logs", async (req, res) => {
  try {
    const where = req.tenantId ? eq(messageLogs.tenantId, req.tenantId) : undefined;
    const logs = await db
      .select()
      .from(messageLogs)
      .where(where)
      .orderBy(desc(messageLogs.sentAt))
      .limit(200);
    res.json(logs.map((l) => ({ ...l, sentAt: l.sentAt.toISOString() })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

// GET /api/communications/automations
router.get("/communications/automations", async (req, res) => {
  try {
    // Seed defaults for this tenant on first access
    await seedAutomationsForTenant(req.tenantId ?? null);

    const where = req.tenantId ? eq(automationSettings.tenantId, req.tenantId) : undefined;
    const settings = await db.select().from(automationSettings).where(where).orderBy(automationSettings.id);
    res.json(settings.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch automations" });
  }
});

// PUT /api/communications/automations/:trigger
router.put("/communications/automations/:trigger", async (req, res) => {
  try {
    const { trigger } = req.params;
    const { emailEnabled, smsEnabled, subject, bodyTemplate } = req.body;

    const whereConditions = [eq(automationSettings.trigger, trigger)];
    if (req.tenantId) whereConditions.push(eq(automationSettings.tenantId, req.tenantId));

    const [updated] = await db
      .update(automationSettings)
      .set({
        emailEnabled: emailEnabled !== undefined ? emailEnabled : undefined,
        smsEnabled: smsEnabled !== undefined ? smsEnabled : undefined,
        subject: subject !== undefined ? subject : undefined,
        bodyTemplate: bodyTemplate !== undefined ? bodyTemplate : undefined,
        updatedAt: new Date(),
      })
      .where(and(...whereConditions))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Automation not found" });
      return;
    }
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update automation" });
  }
});

export default router;
