import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  rentalExtensionsTable,
  bookingsTable,
  listingsTable,
  blockedDatesTable,
  tenantsTable,
  businessProfileTable,
} from "@workspace/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { getStripeForTenant } from "../services/stripe";
import { createNotification } from "../services/notifications";
import {
  sendExtensionRequestedAdminEmail,
  sendExtensionApprovedRenterEmail,
  sendExtensionDeniedRenterEmail,
} from "../services/gmail";
import { withSmtpCreds, withBrand } from "../services/gmail";
import { getTenantSmtpCreds, getTenantBrand } from "../services/smtp-helper";

function buildAppUrl(): string {
  if (process.env.APP_URL?.trim()) return process.env.APP_URL.trim().replace(/\/$/, "");
  if (process.env.REPLIT_DOMAINS) return `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}`;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:8080";
}

const router: IRouter = Router();

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  const msA = new Date(a).getTime();
  const msB = new Date(b).getTime();
  return Math.round(Math.abs(msB - msA) / (1000 * 60 * 60 * 24));
}

/** Returns true if [s1,e1] overlaps [s2,e2] (exclusive end) */
function datesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 < e2 && e1 > s2;
}

/** Check whether the extension window (currentEnd → newEnd) is free for a listing */
async function checkExtensionAvailability(
  listingId: number,
  tenantId: number,
  bookingId: number,
  currentEndDate: string,
  newEndDate: string,
): Promise<{ available: boolean; reason?: string }> {
  // 1. Blocked dates overlap
  const blocks = await db.select()
    .from(blockedDatesTable)
    .where(
      and(
        eq(blockedDatesTable.tenantId, tenantId),
        sql`(${blockedDatesTable.listingId} IS NULL OR ${blockedDatesTable.listingId} = ${listingId})`,
        sql`${blockedDatesTable.startDate} < ${newEndDate}`,
        sql`${blockedDatesTable.endDate} > ${currentEndDate}`,
      )
    );
  if (blocks.length > 0) {
    return { available: false, reason: `Dates ${blocks[0].startDate} – ${blocks[0].endDate} are blocked on the calendar.` };
  }

  // 2. Conflicting bookings (excluding this booking itself)
  const [listing] = await db.select({ quantity: listingsTable.quantity })
    .from(listingsTable).where(eq(listingsTable.id, listingId));
  const totalQty = listing?.quantity ?? 1;

  const conflicts = await db.select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.listingId, listingId),
        eq(bookingsTable.tenantId, tenantId),
        sql`${bookingsTable.id} != ${bookingId}`,
        sql`${bookingsTable.status} NOT IN ('cancelled', 'rejected')`,
        sql`${bookingsTable.startDate} < ${newEndDate}`,
        sql`${bookingsTable.endDate} > ${currentEndDate}`,
      )
    );

  // Sum up quantity of conflicting bookings
  const bookedQty = conflicts.reduce((sum, b) => sum + (b.quantity ?? 1), 0);
  if (bookedQty >= totalQty) {
    return { available: false, reason: "The equipment is already booked for part of the requested extension period." };
  }

  return { available: true };
}

// ── POST /api/bookings/:id/extension-request ───────────────────────────────────
// Renter submits an extension request. Auth: customerEmail from booking (session-less).
router.post("/bookings/:id/extension-request", async (req: Request, res: Response) => {
  try {
    const bookingId = Number(req.params.id);
    const { requestedEndDate, requestNote, customerEmail } = req.body;

    if (!requestedEndDate || !customerEmail) {
      return res.status(400).json({ error: "requestedEndDate and customerEmail are required" });
    }

    // Load booking
    const [booking] = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId));
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // Verify the renter owns this booking
    if (booking.customerEmail.toLowerCase() !== String(customerEmail).toLowerCase()) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Must be confirmed or active
    if (!["confirmed", "active"].includes(booking.status)) {
      return res.status(400).json({ error: "Extensions can only be requested for confirmed or active bookings" });
    }

    // New end date must be after current end date
    if (requestedEndDate <= booking.endDate) {
      return res.status(400).json({ error: "New end date must be after the current end date" });
    }

    // Check for pending extension request already
    const existing = await db.select({ id: rentalExtensionsTable.id })
      .from(rentalExtensionsTable)
      .where(
        and(
          eq(rentalExtensionsTable.bookingId, bookingId),
          eq(rentalExtensionsTable.status, "pending"),
        )
      );
    if (existing.length > 0) {
      return res.status(409).json({ error: "A pending extension request already exists for this booking" });
    }

    // Availability check
    const availability = await checkExtensionAvailability(
      booking.listingId,
      booking.tenantId!,
      bookingId,
      booking.endDate,
      requestedEndDate,
    );
    if (!availability.available) {
      return res.status(409).json({ error: availability.reason });
    }

    // Calculate pricing
    const [listing] = await db.select({ pricePerDay: listingsTable.pricePerDay, title: listingsTable.title })
      .from(listingsTable).where(eq(listingsTable.id, booking.listingId));
    const pricePerDay = parseFloat(String(listing?.pricePerDay ?? "0"));
    const additionalDays = daysBetween(booking.endDate, requestedEndDate);
    const additionalAmount = (pricePerDay * additionalDays * (booking.quantity ?? 1)).toFixed(2);

    // Create extension request
    const [ext] = await db.insert(rentalExtensionsTable).values({
      bookingId,
      tenantId: booking.tenantId,
      originalEndDate: booking.endDate,
      requestedEndDate,
      additionalDays,
      additionalAmount,
      status: "pending",
      requestNote: requestNote?.trim() || null,
    }).returning();

    // Notify admin via email + in-app
    const [tenant] = await db.select({ email: tenantsTable.email, slug: tenantsTable.slug })
      .from(tenantsTable).where(eq(tenantsTable.id, booking.tenantId!));
    const [biz] = await db.select({ name: businessProfileTable.name })
      .from(businessProfileTable).where(eq(businessProfileTable.tenantId, booking.tenantId!));
    const companyName = biz?.name ?? tenant?.slug ?? "Your Rental Company";
    const adminEmail = tenant?.email;
    const tenantSlug = tenant?.slug ?? "";

    if (adminEmail) {
      const smtpCreds = await getTenantSmtpCreds(booking.tenantId);
      const brand = await getTenantBrand(booking.tenantId);
      await withSmtpCreds(smtpCreds, () => withBrand(brand, () =>
        sendExtensionRequestedAdminEmail({
          adminEmail,
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          bookingId,
          listingTitle: listing?.title ?? "your rental",
          originalEndDate: booking.endDate,
          requestedEndDate,
          additionalDays,
          additionalAmount,
          requestNote: requestNote?.trim() || null,
          companyName,
          tenantSlug,
          bookingUrl: `${buildAppUrl()}/${tenantSlug}/admin/bookings/${bookingId}`,
        })
      )).catch(e => console.warn("[extension] Admin email failed:", e?.message));
    }

    if (booking.tenantId) {
      createNotification({
        tenantId: booking.tenantId,
        targetType: "admin",
        type: "action_required",
        title: "Extension request received",
        body: `${booking.customerName} is requesting to extend their rental of ${listing?.title ?? "equipment"} by ${additionalDays} day${additionalDays !== 1 ? "s" : ""} (new return: ${requestedEndDate}).`,
        actionUrl: `/bookings/${bookingId}`,
        isActionRequired: true,
        relatedId: bookingId,
      }).catch(() => {});
    }

    res.json({ success: true, extension: ext });
  } catch (err: any) {
    console.error("[extension] POST request error:", err);
    res.status(500).json({ error: "Failed to submit extension request" });
  }
});

// ── GET /api/bookings/:id/extension-requests ───────────────────────────────────
// Admin or renter can fetch extension requests for a booking
router.get("/bookings/:id/extension-requests", async (req: Request, res: Response) => {
  try {
    const bookingId = Number(req.params.id);
    const { customerEmail } = req.query;

    const [booking] = await db.select({ tenantId: bookingsTable.tenantId, customerEmail: bookingsTable.customerEmail })
      .from(bookingsTable).where(eq(bookingsTable.id, bookingId));
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // Auth: must be the admin for this tenant OR the renter (by email)
    const isAdmin = req.tenantId && req.tenantId === booking.tenantId;
    const isRenter = customerEmail && String(customerEmail).toLowerCase() === booking.customerEmail.toLowerCase();
    if (!isAdmin && !isRenter) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const extensions = await db.select().from(rentalExtensionsTable)
      .where(eq(rentalExtensionsTable.bookingId, bookingId))
      .orderBy(desc(rentalExtensionsTable.requestedAt));

    res.json(extensions.map(e => ({
      ...e,
      additionalAmount: parseFloat(String(e.additionalAmount)),
    })));
  } catch (err: any) {
    console.error("[extension] GET error:", err);
    res.status(500).json({ error: "Failed to fetch extension requests" });
  }
});

// ── GET /api/admin/extension-requests ──────────────────────────────────────────
// Admin views all pending extension requests for their tenant
router.get("/admin/extension-requests", async (req: Request, res: Response) => {
  try {
    if (!req.tenantId) return res.status(401).json({ error: "Unauthorized" });

    const extensions = await db.select({
      ext: rentalExtensionsTable,
      booking: {
        customerName: bookingsTable.customerName,
        customerEmail: bookingsTable.customerEmail,
        listingId: bookingsTable.listingId,
        status: bookingsTable.status,
      },
    })
      .from(rentalExtensionsTable)
      .leftJoin(bookingsTable, eq(rentalExtensionsTable.bookingId, bookingsTable.id))
      .where(eq(rentalExtensionsTable.tenantId, req.tenantId))
      .orderBy(desc(rentalExtensionsTable.requestedAt));

    res.json(extensions.map(({ ext, booking }) => ({
      ...ext,
      additionalAmount: parseFloat(String(ext.additionalAmount)),
      customerName: booking?.customerName,
      customerEmail: booking?.customerEmail,
      bookingStatus: booking?.status,
    })));
  } catch (err: any) {
    console.error("[extension] GET admin list error:", err);
    res.status(500).json({ error: "Failed to fetch extension requests" });
  }
});

// ── POST /api/admin/extension-requests/:id/approve ─────────────────────────────
router.post("/admin/extension-requests/:id/approve", async (req: Request, res: Response) => {
  try {
    if (!req.tenantId) return res.status(401).json({ error: "Unauthorized" });

    const extId = Number(req.params.id);
    const [ext] = await db.select().from(rentalExtensionsTable)
      .where(and(eq(rentalExtensionsTable.id, extId), eq(rentalExtensionsTable.tenantId, req.tenantId)));
    if (!ext) return res.status(404).json({ error: "Extension request not found" });
    if (ext.status !== "pending") return res.status(400).json({ error: "Extension request is no longer pending" });

    const [booking] = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.id, ext.bookingId));
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const [tenant] = await db.select().from(tenantsTable)
      .where(eq(tenantsTable.id, req.tenantId));
    const [biz] = await db.select({ name: businessProfileTable.name })
      .from(businessProfileTable).where(eq(businessProfileTable.tenantId, req.tenantId));
    const [listing] = await db.select({ title: listingsTable.title, pricePerDay: listingsTable.pricePerDay })
      .from(listingsTable).where(eq(listingsTable.id, booking.listingId));

    const companyName = biz?.name ?? tenant?.slug ?? "Your Rental Company";
    const tenantSlug = tenant?.slug ?? "";

    // Re-check availability before charging
    const availability = await checkExtensionAvailability(
      booking.listingId,
      req.tenantId,
      booking.id,
      ext.originalEndDate,
      ext.requestedEndDate,
    );
    if (!availability.available) {
      return res.status(409).json({ error: `Cannot approve — ${availability.reason}` });
    }

    const additionalAmountCents = Math.round(parseFloat(String(ext.additionalAmount)) * 100);
    let stripePaymentIntentId: string | null = null;
    let stripePaymentStatus = "n/a";

    // Charge the additional amount if there's a payment method on file and amount > 0
    if (additionalAmountCents >= 50 && booking.stripePaymentIntentId) {
      try {
        const stripeClient = getStripeForTenant(!!tenant?.testMode);
        const originalPi = await stripeClient.paymentIntents.retrieve(booking.stripePaymentIntentId);

        if (originalPi.payment_method) {
          const extensionPi = await stripeClient.paymentIntents.create({
            amount: additionalAmountCents,
            currency: "usd",
            payment_method: String(originalPi.payment_method),
            confirm: true,
            off_session: true,
            description: `Extension charge (${ext.additionalDays}d) — Booking #${booking.id} (${listing?.title ?? ""})`,
            metadata: {
              booking_id: String(booking.id),
              tenant_id: String(req.tenantId),
              type: "extension",
              extension_id: String(extId),
              additional_days: String(ext.additionalDays),
            },
            ...(tenant?.stripeAccountId ? {
              transfer_data: { destination: tenant.stripeAccountId },
              application_fee_amount: Math.round(additionalAmountCents * 0.1),
            } : {}),
          });

          stripePaymentIntentId = extensionPi.id;
          stripePaymentStatus = extensionPi.status;
        }
      } catch (stripeErr: any) {
        console.warn("[extension] Stripe charge failed:", stripeErr?.message);
        return res.status(402).json({ error: `Payment failed: ${stripeErr?.message}` });
      }
    }

    // Update extension record
    await db.update(rentalExtensionsTable).set({
      status: "approved",
      respondedAt: new Date(),
      stripePaymentIntentId,
      stripePaymentStatus,
      updatedAt: new Date(),
    }).where(eq(rentalExtensionsTable.id, extId));

    // Update booking end date (and also reset the 36hr claim window alert flag)
    await db.update(bookingsTable).set({
      endDate: ext.requestedEndDate,
      claimWindowAlertSent: false,
      updatedAt: new Date(),
    }).where(eq(bookingsTable.id, booking.id));

    // Email renter
    const smtpCreds = await getTenantSmtpCreds(req.tenantId);
    const brand = await getTenantBrand(req.tenantId);
    await withSmtpCreds(smtpCreds, () => withBrand(brand, () =>
      sendExtensionApprovedRenterEmail({
        toEmail: booking.customerEmail,
        customerName: booking.customerName,
        bookingId: booking.id,
        listingTitle: listing?.title ?? "your rental",
        originalEndDate: ext.originalEndDate,
        newEndDate: ext.requestedEndDate,
        additionalDays: ext.additionalDays,
        additionalAmount: parseFloat(String(ext.additionalAmount)).toFixed(2),
        companyName,
        bookingUrl: `${buildAppUrl()}/${tenantSlug}/my-bookings/${booking.id}`,
      })
    )).catch(e => console.warn("[extension] Approval email failed:", e?.message));

    // In-app notification for renter
    createNotification({
      tenantId: req.tenantId,
      targetType: "renter",
      type: "status_update",
      title: "Rental extension approved!",
      body: `Your extension request has been approved. Your new return date is ${ext.requestedEndDate}.`,
      actionUrl: `/${tenantSlug}/my-bookings/${booking.id}`,
      isActionRequired: false,
      relatedId: booking.id,
    }).catch(() => {});

    res.json({ success: true, newEndDate: ext.requestedEndDate });
  } catch (err: any) {
    console.error("[extension] Approve error:", err);
    res.status(500).json({ error: "Failed to approve extension" });
  }
});

// ── POST /api/admin/extension-requests/:id/deny ───────────────────────────────
router.post("/admin/extension-requests/:id/deny", async (req: Request, res: Response) => {
  try {
    if (!req.tenantId) return res.status(401).json({ error: "Unauthorized" });

    const extId = Number(req.params.id);
    const { denialReason } = req.body;

    const [ext] = await db.select().from(rentalExtensionsTable)
      .where(and(eq(rentalExtensionsTable.id, extId), eq(rentalExtensionsTable.tenantId, req.tenantId)));
    if (!ext) return res.status(404).json({ error: "Extension request not found" });
    if (ext.status !== "pending") return res.status(400).json({ error: "Extension request is no longer pending" });

    const [booking] = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.id, ext.bookingId));
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const [tenant] = await db.select().from(tenantsTable)
      .where(eq(tenantsTable.id, req.tenantId));
    const [biz] = await db.select({ name: businessProfileTable.name })
      .from(businessProfileTable).where(eq(businessProfileTable.tenantId, req.tenantId));
    const [listing] = await db.select({ title: listingsTable.title })
      .from(listingsTable).where(eq(listingsTable.id, booking.listingId));

    const companyName = biz?.name ?? tenant?.slug ?? "Your Rental Company";
    const tenantSlug = tenant?.slug ?? "";

    await db.update(rentalExtensionsTable).set({
      status: "denied",
      denialReason: denialReason?.trim() || null,
      respondedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(rentalExtensionsTable.id, extId));

    // Email renter
    const smtpCreds = await getTenantSmtpCreds(req.tenantId);
    const brand = await getTenantBrand(req.tenantId);
    await withSmtpCreds(smtpCreds, () => withBrand(brand, () =>
      sendExtensionDeniedRenterEmail({
        toEmail: booking.customerEmail,
        customerName: booking.customerName,
        bookingId: booking.id,
        listingTitle: listing?.title ?? "your rental",
        originalEndDate: ext.originalEndDate,
        requestedEndDate: ext.requestedEndDate,
        denialReason: denialReason?.trim() || null,
        companyName,
        bookingUrl: `${buildAppUrl()}/${tenantSlug}/my-bookings/${booking.id}`,
      })
    )).catch(e => console.warn("[extension] Denial email failed:", e?.message));

    // In-app notification for renter
    createNotification({
      tenantId: req.tenantId,
      targetType: "renter",
      type: "status_update",
      title: "Extension request declined",
      body: `Your request to extend the rental of ${listing?.title ?? "equipment"} was not approved. Your return date remains ${ext.originalEndDate}.`,
      actionUrl: `/${tenantSlug}/my-bookings/${booking.id}`,
      isActionRequired: false,
      relatedId: booking.id,
    }).catch(() => {});

    res.json({ success: true });
  } catch (err: any) {
    console.error("[extension] Deny error:", err);
    res.status(500).json({ error: "Failed to deny extension" });
  }
});

// ── POST /api/admin/bookings/:id/extend ────────────────────────────────────────
// Admin directly extends a booking return date (no renter request needed).
router.post("/admin/bookings/:id/extend", async (req: Request, res: Response) => {
  try {
    if (!req.tenantId) return res.status(401).json({ error: "Unauthorized" });

    const bookingId = Number(req.params.id);
    const { newEndDate } = req.body;

    if (!newEndDate) return res.status(400).json({ error: "newEndDate is required" });

    const [booking] = await db.select().from(bookingsTable)
      .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.tenantId, req.tenantId)));
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    if (!["confirmed", "active"].includes(booking.status)) {
      return res.status(400).json({ error: "Can only extend confirmed or active bookings" });
    }
    if (newEndDate <= booking.endDate) {
      return res.status(400).json({ error: "New end date must be after the current end date" });
    }

    // Availability check
    const availability = await checkExtensionAvailability(
      booking.listingId,
      req.tenantId,
      bookingId,
      booking.endDate,
      newEndDate,
    );
    if (!availability.available) {
      return res.status(409).json({ error: availability.reason });
    }

    const [listing] = await db.select({ pricePerDay: listingsTable.pricePerDay, title: listingsTable.title })
      .from(listingsTable).where(eq(listingsTable.id, booking.listingId));
    const additionalDays = daysBetween(booking.endDate, newEndDate);
    const additionalAmount = (parseFloat(String(listing?.pricePerDay ?? "0")) * additionalDays * (booking.quantity ?? 1)).toFixed(2);

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, req.tenantId));
    const [biz] = await db.select({ name: businessProfileTable.name })
      .from(businessProfileTable).where(eq(businessProfileTable.tenantId, req.tenantId));
    const companyName = biz?.name ?? tenant?.slug ?? "Your Rental Company";
    const tenantSlug = tenant?.slug ?? "";

    const additionalAmountCents = Math.round(parseFloat(additionalAmount) * 100);
    let stripePaymentIntentId: string | null = null;
    let stripePaymentStatus = "n/a";

    if (additionalAmountCents >= 50 && booking.stripePaymentIntentId) {
      try {
        const stripeClient = getStripeForTenant(!!tenant?.testMode);
        const originalPi = await stripeClient.paymentIntents.retrieve(booking.stripePaymentIntentId);
        if (originalPi.payment_method) {
          const extensionPi = await stripeClient.paymentIntents.create({
            amount: additionalAmountCents,
            currency: "usd",
            payment_method: String(originalPi.payment_method),
            confirm: true,
            off_session: true,
            description: `Admin extension (${additionalDays}d) — Booking #${booking.id} (${listing?.title ?? ""})`,
            metadata: {
              booking_id: String(booking.id),
              tenant_id: String(req.tenantId),
              type: "admin_extension",
              additional_days: String(additionalDays),
            },
            ...(tenant?.stripeAccountId ? {
              transfer_data: { destination: tenant.stripeAccountId },
              application_fee_amount: Math.round(additionalAmountCents * 0.1),
            } : {}),
          });
          stripePaymentIntentId = extensionPi.id;
          stripePaymentStatus = extensionPi.status;
        }
      } catch (stripeErr: any) {
        console.warn("[admin-extend] Stripe charge failed:", stripeErr?.message);
        return res.status(402).json({ error: `Payment failed: ${stripeErr?.message}` });
      }
    }

    // Create an approved extension record (admin-initiated)
    const [ext] = await db.insert(rentalExtensionsTable).values({
      bookingId,
      tenantId: req.tenantId,
      originalEndDate: booking.endDate,
      requestedEndDate: newEndDate,
      additionalDays,
      additionalAmount,
      status: "approved",
      requestNote: "Admin-initiated extension",
      stripePaymentIntentId,
      stripePaymentStatus,
      respondedAt: new Date(),
    }).returning();

    // Update booking end date
    await db.update(bookingsTable).set({
      endDate: newEndDate,
      claimWindowAlertSent: false,
      updatedAt: new Date(),
    }).where(eq(bookingsTable.id, bookingId));

    // Email renter
    const smtpCreds = await getTenantSmtpCreds(req.tenantId);
    const brand = await getTenantBrand(req.tenantId);
    await withSmtpCreds(smtpCreds, () => withBrand(brand, () =>
      sendExtensionApprovedRenterEmail({
        toEmail: booking.customerEmail,
        customerName: booking.customerName,
        bookingId: booking.id,
        listingTitle: listing?.title ?? "your rental",
        originalEndDate: booking.endDate,
        newEndDate,
        additionalDays,
        additionalAmount: parseFloat(additionalAmount).toFixed(2),
        companyName,
        bookingUrl: `${buildAppUrl()}/${tenantSlug}/my-bookings/${booking.id}`,
      })
    )).catch(e => console.warn("[admin-extend] Email failed:", e?.message));

    createNotification({
      tenantId: req.tenantId,
      targetType: "renter",
      type: "status_update",
      title: "Your rental has been extended",
      body: `Your return date has been updated to ${newEndDate}.`,
      actionUrl: `/${tenantSlug}/my-bookings/${booking.id}`,
      isActionRequired: false,
      relatedId: booking.id,
    }).catch(() => {});

    res.json({ success: true, newEndDate, additionalDays, additionalAmount, extension: ext });
  } catch (err: any) {
    console.error("[admin-extend] error:", err);
    res.status(500).json({ error: "Failed to extend booking" });
  }
});

export default router;
