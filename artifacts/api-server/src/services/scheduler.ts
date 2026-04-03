/**
 * Scheduled reminder service — runs every 15 minutes.
 *
 * Sends two timed emails per booking:
 *   1. ~12 hrs before pickup → renter reminder + admin heads-up
 *   2. ~24 hrs before return → renter return-due reminder
 */

import { db } from "@workspace/db";
import {
  bookingsTable,
  listingsTable,
  businessProfileTable,
  tenantsTable,
} from "@workspace/db/schema";
import { eq, and, isNull, or, sql } from "drizzle-orm";
import {
  sendPrePickupReminderRenterEmail,
  sendPrePickupReminderAdminEmail,
  sendReturnReminderRenterEmail,
  sendStripeRestrictedAlertEmail,
} from "./gmail";
import { createNotification } from "./notifications";

const APP_URL = process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Lookup helpers
async function getContext(tenantId: number | null | undefined) {
  if (!tenantId) return { companyName: "Your Rental Company", adminEmail: undefined as string | undefined, slug: "" };
  const [biz] = await db.select({ name: businessProfileTable.name, phone: businessProfileTable.phone })
    .from(businessProfileTable).where(eq(businessProfileTable.tenantId, tenantId));
  const [tenant] = await db.select({ email: tenantsTable.email, slug: tenantsTable.slug })
    .from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  return {
    companyName: biz?.name ?? tenant?.slug ?? "Your Rental Company",
    adminEmail: tenant?.email ?? undefined,
    slug: tenant?.slug ?? "",
    contactPhone: (biz as any)?.phone ?? null,
  };
}

async function getListingTitle(listingId: number): Promise<string> {
  const [listing] = await db.select({ title: listingsTable.title, pickupAddress: (listingsTable as any).pickupAddress })
    .from(listingsTable).where(eq(listingsTable.id, listingId));
  return listing?.title ?? "your rental";
}

async function getListingPickupAddress(listingId: number): Promise<string | null> {
  const [listing] = await db.select({ pickupAddress: (listingsTable as any).pickupAddress })
    .from(listingsTable).where(eq(listingsTable.id, listingId));
  return (listing as any)?.pickupAddress ?? null;
}

// ── 1. Pre-pickup reminders (12 hrs window) ────────────────────────────────────
async function sendPickupReminders() {
  const now = new Date();
  // Window: startDate is between now+11h and now+13h (centred on 12-hour mark)
  const windowStart = new Date(now.getTime() + 11 * 60 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + 13 * 60 * 60 * 1000);

  const wsStr = windowStart.toISOString().slice(0, 10); // yyyy-mm-dd
  const weStr = windowEnd.toISOString().slice(0, 10);

  // Also include bookings starting today that haven't been reminded yet
  // (for immediate send when < 12 hrs away)
  const todayStr = now.toISOString().slice(0, 10);

  const bookings = await db.select().from(bookingsTable).where(
    and(
      sql`${bookingsTable.startDate} >= ${todayStr}`,
      sql`${bookingsTable.startDate} <= ${weStr}`,
      sql`coalesce(${bookingsTable.pickupReminderSent}, false) = false`,
      sql`${bookingsTable.status} NOT IN ('cancelled', 'completed')`,
    )
  );

  for (const booking of bookings) {
    try {
      // Mark as sent first to avoid double-sends if something throws
      await db.update(bookingsTable)
        .set({ pickupReminderSent: true, updatedAt: new Date() })
        .where(eq(bookingsTable.id, booking.id));

      const ctx = await getContext(booking.tenantId);
      const listingTitle = await getListingTitle(booking.listingId);
      const pickupAddress = await getListingPickupAddress(booking.listingId);

      if (booking.customerEmail) {
        await sendPrePickupReminderRenterEmail({
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          bookingId: booking.id,
          listingTitle,
          startDate: booking.startDate,
          endDate: booking.endDate,
          pickupTime: booking.pickupTime,
          pickupAddress,
          companyName: ctx.companyName,
          tenantSlug: ctx.slug,
          adminEmail: ctx.adminEmail,
          contactPhone: ctx.contactPhone ?? null,
        });
      }

      if (ctx.adminEmail && ctx.slug) {
        await sendPrePickupReminderAdminEmail({
          adminEmail: ctx.adminEmail,
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          customerPhone: booking.customerPhone,
          bookingId: booking.id,
          listingTitle,
          startDate: booking.startDate,
          endDate: booking.endDate,
          pickupTime: booking.pickupTime,
          companyName: ctx.companyName,
          tenantSlug: ctx.slug,
        });
      }

      // In-app notifications for pickup due soon
      if (booking.tenantId) {
        if (booking.customerEmail) {
          createNotification({
            tenantId: booking.tenantId,
            targetType: "renter",
            targetEmail: booking.customerEmail,
            type: "pickup_due_soon",
            title: "Pickup coming up!",
            body: `Your ${listingTitle} pickup is on ${booking.startDate}. Get ready for your adventure!`,
            actionUrl: "/my-bookings",
            isActionRequired: false,
            relatedId: booking.id,
          }).catch(() => {});
        }
        createNotification({
          tenantId: booking.tenantId,
          targetType: "admin",
          type: "pickup_due_soon",
          title: "Pickup due soon",
          body: `${booking.customerName} is picking up ${listingTitle} on ${booking.startDate}.`,
          actionUrl: `/bookings/${booking.id}`,
          isActionRequired: false,
          relatedId: booking.id,
        }).catch(() => {});
      }

      console.log(`[scheduler] Pickup reminder sent for booking #${booking.id}`);
    } catch (err: any) {
      console.warn(`[scheduler] Pickup reminder failed for booking #${booking.id}:`, err?.message);
      // Undo the sent flag so it retries next cycle
      await db.update(bookingsTable)
        .set({ pickupReminderSent: false, updatedAt: new Date() })
        .where(eq(bookingsTable.id, booking.id)).catch(() => {});
    }
  }
}

// ── 2. Return reminders (24 hrs window) ────────────────────────────────────────
async function sendReturnReminders() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const wsStr = windowStart.toISOString().slice(0, 10);
  const weStr = windowEnd.toISOString().slice(0, 10);

  const bookings = await db.select().from(bookingsTable).where(
    and(
      sql`${bookingsTable.endDate} >= ${wsStr}`,
      sql`${bookingsTable.endDate} <= ${weStr}`,
      sql`coalesce(${bookingsTable.returnReminderSent}, false) = false`,
      sql`${bookingsTable.status} IN ('confirmed', 'active')`,
    )
  );

  for (const booking of bookings) {
    try {
      await db.update(bookingsTable)
        .set({ returnReminderSent: true, updatedAt: new Date() })
        .where(eq(bookingsTable.id, booking.id));

      const ctx = await getContext(booking.tenantId);
      const listingTitle = await getListingTitle(booking.listingId);

      // Build deposit note
      const startMs = new Date(booking.startDate).getTime();
      const endMs   = new Date(booking.endDate).getTime();
      const rentalDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
      const depositNote = rentalDays >= 5
        ? "Your security deposit was charged at pickup. It will be reviewed and released after your return is confirmed."
        : "Your security deposit was authorized as a hold on your card at pickup. It will be automatically released once your return is confirmed.";

      if (booking.customerEmail) {
        await sendReturnReminderRenterEmail({
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          bookingId: booking.id,
          listingTitle,
          startDate: booking.startDate,
          endDate: booking.endDate,
          companyName: ctx.companyName,
          tenantSlug: ctx.slug,
          adminEmail: ctx.adminEmail,
          depositNote,
        });
      }

      // In-app notifications for return due soon
      if (booking.tenantId) {
        if (booking.customerEmail) {
          createNotification({
            tenantId: booking.tenantId,
            targetType: "renter",
            targetEmail: booking.customerEmail,
            type: "return_due_soon",
            title: "Return due tomorrow",
            body: `Your ${listingTitle} is due back on ${booking.endDate}. Please plan your return.`,
            actionUrl: "/my-bookings",
            isActionRequired: false,
            relatedId: booking.id,
          }).catch(() => {});
        }
        createNotification({
          tenantId: booking.tenantId,
          targetType: "admin",
          type: "return_due_soon",
          title: "Return due tomorrow",
          body: `${booking.customerName}'s ${listingTitle} is due back on ${booking.endDate}.`,
          actionUrl: `/bookings/${booking.id}`,
          isActionRequired: false,
          relatedId: booking.id,
        }).catch(() => {});
      }

      console.log(`[scheduler] Return reminder sent for booking #${booking.id}`);
    } catch (err: any) {
      console.warn(`[scheduler] Return reminder failed for booking #${booking.id}:`, err?.message);
      await db.update(bookingsTable)
        .set({ returnReminderSent: false, updatedAt: new Date() })
        .where(eq(bookingsTable.id, booking.id)).catch(() => {});
    }
  }
}

// ── 3. Stripe restricted account reminders (weekly) ────────────────────────────
//
// Any tenant whose stripeAccountStatus is "restricted" and whose last alert was
// sent more than 7 days ago (or was never sent) gets a follow-up email.
// The webhook fires the FIRST alert instantly; this handles the ongoing reminders.
async function alertRestrictedStripeAccounts() {
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - ONE_WEEK_MS);

  // Fetch tenants that are currently restricted
  const restrictedTenants = await db
    .select({
      id: tenantsTable.id,
      email: tenantsTable.email,
      slug: tenantsTable.slug,
      stripeRestrictedAlertSentAt: tenantsTable.stripeRestrictedAlertSentAt,
    })
    .from(tenantsTable)
    .where(
      and(
        sql`${tenantsTable.stripeAccountStatus} = 'restricted'`,
        // Either never alerted OR last alert was > 7 days ago
        or(
          isNull(tenantsTable.stripeRestrictedAlertSentAt),
          sql`${tenantsTable.stripeRestrictedAlertSentAt} < ${cutoff.toISOString()}`,
        ),
      )
    );

  for (const tenant of restrictedTenants) {
    try {
      const [biz] = await db.select({ name: businessProfileTable.name })
        .from(businessProfileTable).where(eq(businessProfileTable.tenantId, tenant.id));
      const companyName = biz?.name ?? tenant.slug ?? "Your Company";

      await sendStripeRestrictedAlertEmail({
        adminEmail: tenant.email,
        companyName,
        tenantSlug: tenant.slug,
        isReminder: true,
      });

      await db.update(tenantsTable).set({
        stripeRestrictedAlertSentAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(tenantsTable.id, tenant.id));

      console.log(`[scheduler] Stripe restriction reminder sent to ${tenant.email} (tenant ${tenant.id})`);
    } catch (err: any) {
      console.warn(`[scheduler] Stripe restriction reminder failed for tenant ${tenant.id}:`, err?.message);
    }
  }
}

// ── Main scheduler loop ────────────────────────────────────────────────────────
async function runSchedulerCycle() {
  try {
    await sendPickupReminders();
    await sendReturnReminders();
    await alertRestrictedStripeAccounts();
  } catch (err: any) {
    console.warn("[scheduler] Cycle error:", err?.message);
  }
}

export function startScheduler() {
  // Run once at startup after a brief delay, then every 15 minutes
  setTimeout(() => {
    runSchedulerCycle();
    setInterval(runSchedulerCycle, INTERVAL_MS);
  }, 10_000);

  console.log("[scheduler] Started — pickup reminders at 12 hrs, return reminders at 24 hrs");
}
