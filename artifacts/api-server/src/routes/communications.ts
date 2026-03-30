import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { bookingsTable, messageLogs, automationSettings } from "@workspace/db/schema";
import { eq, and, gte, lte, lt, gt, desc } from "drizzle-orm";

const router: IRouter = Router();

const DEFAULT_AUTOMATIONS = [
  {
    trigger: "booking_confirmed",
    name: "Booking Confirmed",
    description: "Sent when a booking is confirmed by the admin",
    emailEnabled: true,
    smsEnabled: false,
    subject: "Your booking is confirmed! 🎉",
    bodyTemplate: `Hi {{customerName}},

Great news! Your booking for {{listingTitle}} has been confirmed.

Booking Details:
• Dates: {{startDate}} – {{endDate}}
• Total: \${{totalPrice}}

We look forward to seeing you. If you have any questions, don't hesitate to reach out.

See you soon,
{{businessName}}`,
  },
  {
    trigger: "booking_reminder",
    name: "Upcoming Rental Reminder",
    description: "Sent 24 hours before the rental starts",
    emailEnabled: true,
    smsEnabled: true,
    subject: "Your rental starts tomorrow! 🏕️",
    bodyTemplate: `Hi {{customerName}},

Just a reminder — your rental of {{listingTitle}} starts tomorrow, {{startDate}}.

Please make sure to bring:
• A valid ID
• Your booking confirmation

We'll have everything ready for you. See you tomorrow!

{{businessName}}`,
  },
  {
    trigger: "booking_activated",
    name: "Rental Started",
    description: "Sent when the rental is marked as active/in progress",
    emailEnabled: true,
    smsEnabled: true,
    subject: "Your rental is now active — enjoy! 🚀",
    bodyTemplate: `Hi {{customerName}},

Your rental of {{listingTitle}} is now active. Enjoy your adventure!

Your rental runs through {{endDate}}. Please reach out if you need anything during your rental period.

Have a great time,
{{businessName}}`,
  },
  {
    trigger: "booking_completed",
    name: "Rental Completed",
    description: "Sent when the rental is marked as completed",
    emailEnabled: true,
    smsEnabled: false,
    subject: "Thanks for renting with us! How was it? ⭐",
    bodyTemplate: `Hi {{customerName}},

Your rental of {{listingTitle}} has been completed. We hope you had an amazing experience!

We'd love to hear how it went — reviews help other renters and help us improve.

Thanks for choosing us, and we hope to see you again!

{{businessName}}`,
  },
  {
    trigger: "booking_cancelled",
    name: "Booking Cancelled",
    description: "Sent when a booking is cancelled",
    emailEnabled: true,
    smsEnabled: false,
    subject: "Your booking has been cancelled",
    bodyTemplate: `Hi {{customerName}},

Your booking for {{listingTitle}} ({{startDate}} – {{endDate}}) has been cancelled.

If you have any questions about your cancellation or need to rebook, please contact us directly.

We hope to serve you again in the future.

{{businessName}}`,
  },
];

async function seedAutomations() {
  for (const auto of DEFAULT_AUTOMATIONS) {
    const existing = await db.select().from(automationSettings).where(eq(automationSettings.trigger, auto.trigger));
    if (existing.length === 0) {
      await db.insert(automationSettings).values(auto);
    }
  }
}

// Seed on startup
seedAutomations().catch(console.error);

// GET /api/communications/renters?filter=all|future|active|past
router.get("/communications/renters", async (req, res) => {
  try {
    const filter = (req.query.filter as string) || "all";
    const today = new Date().toISOString().split("T")[0];

    let conditions: any[] = [];
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

    // Deduplicate by email but keep booking info
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

    const logs = [];
    for (const r of recipients) {
      const [log] = await db
        .insert(messageLogs)
        .values({
          bookingId: r.bookingId || null,
          customerName: r.name,
          customerEmail: r.email,
          customerPhone: r.phone || null,
          channel: channel || "email",
          subject: subject || null,
          body,
          trigger: "manual",
          status: "simulated",
        })
        .returning();
      logs.push(log);
    }

    res.json({ sent: logs.length, logs });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to send messages" });
  }
});

// POST /api/communications/send-automation — triggered on booking status change
router.post("/communications/send-automation", async (req, res) => {
  try {
    const { trigger, bookingId } = req.body;
    if (!trigger || !bookingId) {
      res.status(400).json({ error: "trigger and bookingId are required" });
      return;
    }

    const [automation] = await db
      .select()
      .from(automationSettings)
      .where(eq(automationSettings.trigger, trigger));

    if (!automation || (!automation.emailEnabled && !automation.smsEnabled)) {
      res.json({ skipped: true });
      return;
    }

    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId));
    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    const body = automation.bodyTemplate
      .replace(/{{customerName}}/g, booking.customerName)
      .replace(/{{startDate}}/g, booking.startDate)
      .replace(/{{endDate}}/g, booking.endDate)
      .replace(/{{totalPrice}}/g, booking.totalPrice?.toString() ?? "")
      .replace(/{{businessName}}/g, "Your Rental Company");

    const channel = automation.emailEnabled && automation.smsEnabled
      ? "both"
      : automation.emailEnabled
      ? "email"
      : "sms";

    const [log] = await db
      .insert(messageLogs)
      .values({
        bookingId,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        channel,
        subject: automation.subject || null,
        body,
        trigger,
        status: "simulated",
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
    const logs = await db
      .select()
      .from(messageLogs)
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
    const settings = await db.select().from(automationSettings).orderBy(automationSettings.id);
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

    const [updated] = await db
      .update(automationSettings)
      .set({
        emailEnabled: emailEnabled !== undefined ? emailEnabled : undefined,
        smsEnabled: smsEnabled !== undefined ? smsEnabled : undefined,
        subject: subject !== undefined ? subject : undefined,
        bodyTemplate: bodyTemplate !== undefined ? bodyTemplate : undefined,
        updatedAt: new Date(),
      })
      .where(eq(automationSettings.trigger, trigger))
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
