import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { bookingsTable, listingsTable, businessProfileTable, tenantsTable, contactCardsTable, customersTable } from "@workspace/db/schema";
import { eq, and, gte, lte, isNull, or, sql } from "drizzle-orm";
import { generateAgreementPdf } from "../lib/generate-agreement-pdf";
import {
  sendPickupLinkEmail,
  sendReturnLinkEmail,
  sendKioskAccountSetupEmail,
  sendBookingPickupReminderEmail,
  sendAdminPickupReminderEmail,
  sendReadyToAdventureEmail,
  sendContactCardEmail,
  sendAdminBookingContactEmail,
  sendAgreementLinkEmail,
  sendIdentityVerificationEmail,
  withSmtpCreds,
} from "../services/gmail";
import { getTenantSmtpCreds } from "../services/smtp-helper";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getStripeForTenant } from "../services/stripe";
import { createNotification } from "../services/notifications";

// ── Auto-trigger deposit at pickup ─────────────────────────────────────────────
// Called on both pickup endpoints when isFirstCompletion is true.
// Silently skips if: no deposit configured, no saved payment method, or
// deposit was already processed (depositHoldIntentId already set).
async function triggerDepositAtPickup(
  booking: typeof bookingsTable.$inferSelect,
  logger?: { warn: (obj: unknown, msg: string) => void }
) {
  try {
    if (!booking.listingId || !booking.tenantId) return;
    if (booking.depositHoldIntentId) return; // already processed

    const [listing] = await db.select().from(listingsTable)
      .where(eq(listingsTable.id, booking.listingId));
    const depositAmountCents = listing?.depositAmount
      ? Math.round(parseFloat(String(listing.depositAmount)) * 100) : 0;
    if (depositAmountCents < 50) return; // no deposit on this listing

    if (!booking.stripePaymentIntentId) return; // no card on file

    const [tenant] = await db.select().from(tenantsTable)
      .where(eq(tenantsTable.id, booking.tenantId));
    if (!tenant) return;

    const stripeClient = getStripeForTenant(!!tenant.testMode);
    const originalPi = await stripeClient.paymentIntents.retrieve(booking.stripePaymentIntentId);
    if (!originalPi.payment_method) return; // card not saved

    const startMs = new Date(booking.startDate).getTime();
    const endMs   = new Date(booking.endDate).getTime();
    const rentalDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
    const isLongBooking = rentalDays >= 5;

    const depositPi = await stripeClient.paymentIntents.create({
      amount: depositAmountCents,
      currency: "usd",
      payment_method: String(originalPi.payment_method),
      capture_method: isLongBooking ? "automatic" : "manual",
      confirm: true,
      off_session: true,
      description: isLongBooking
        ? `Security deposit (full charge, ${rentalDays}-day rental) — Booking #${booking.id} (${listing?.title ?? ""})`
        : `Security deposit hold — Booking #${booking.id} (${listing?.title ?? ""})`,
      metadata: {
        booking_id: String(booking.id),
        tenant_id: String(booking.tenantId),
        type: isLongBooking ? "deposit_charge" : "deposit_hold",
        rental_days: String(rentalDays),
        triggered_by: "pickup",
      },
    });

    const newStatus = isLongBooking ? "charged" : "authorized";
    await db.update(bookingsTable)
      .set({ depositHoldIntentId: depositPi.id, depositHoldStatus: newStatus, updatedAt: new Date() })
      .where(eq(bookingsTable.id, booking.id));
  } catch (err: any) {
    // Non-fatal — log but don't block pickup from completing
    logger?.warn({ err: err.message }, "[deposit] Auto-trigger at pickup failed (non-fatal)");
    console.warn("[deposit] Auto-trigger at pickup failed:", err.message);
  }
}

const UPLOADS_DIR_BOOKINGS = path.resolve(process.cwd(), "uploads");

// Multer for pickup photo uploads (stored in same uploads dir)
const pickupUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR_BOOKINGS),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `pickup_${randomBytes(10).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"));
  },
});

const router: IRouter = Router();

// ── Email event logging ────────────────────────────────────────────────────────
type EmailEventType =
  | "confirmation"
  | "pickup_link"
  | "return_link"
  | "pickup_reminder"
  | "return_reminder"
  | "ready_to_adventure"
  | "kiosk_setup"
  | "contact_card"
  | "agreement_link"
  | "identity_link";

async function appendEmailEvent(bookingId: number, type: EmailEventType, toEmail?: string) {
  try {
    const [row] = await db
      .select({ emailEvents: bookingsTable.emailEvents })
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId));
    if (!row) return;
    const existing: { type: string; sentAt: string; toEmail?: string }[] =
      JSON.parse(row.emailEvents ?? "[]");
    existing.push({ type, sentAt: new Date().toISOString(), toEmail });
    await db
      .update(bookingsTable)
      .set({ emailEvents: JSON.stringify(existing), updatedAt: new Date() })
      .where(eq(bookingsTable.id, bookingId));
  } catch {
    // non-fatal — never block the main flow
  }
}

function formatBooking(b: typeof bookingsTable.$inferSelect, listingTitle: string) {
  return {
    ...b,
    listingTitle,
    totalPrice: parseFloat(b.totalPrice ?? "0"),
    depositPaid: b.depositPaid ? parseFloat(b.depositPaid) : null,
    protectionPlanFee: b.protectionPlanFee ? parseFloat(b.protectionPlanFee) : null,
    pickupPhotos: b.pickupPhotos ? JSON.parse(b.pickupPhotos) : [],
    pickupLinkSent: !!b.pickupToken,
    pickupCompletedAt: b.pickupCompletedAt ? b.pickupCompletedAt.toISOString() : null,
    returnPhotos: b.returnPhotos ? JSON.parse(b.returnPhotos) : [],
    returnToken: b.returnToken ?? null,
    returnCompletedAt: b.returnCompletedAt ? b.returnCompletedAt.toISOString() : null,
    inspectionResult: b.inspectionResult ?? null,
    depositHoldIntentId: b.depositHoldIntentId ?? null,
    depositHoldStatus: b.depositHoldStatus ?? null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

router.get("/bookings", async (req, res) => {
  try {
    const { status, listingId, startDate, endDate, customerEmail } = req.query;
    const conditions = [];

    // When searching by customerEmail (renter's my-bookings view), include
    // null-tenant bookings alongside the scoped ones so customers always see
    // every booking they made, even if it was created without tenant context.
    if (req.tenantId && customerEmail) {
      conditions.push(or(eq(bookingsTable.tenantId, req.tenantId), isNull(bookingsTable.tenantId))!);
    } else if (req.tenantId) {
      conditions.push(eq(bookingsTable.tenantId, req.tenantId));
    }

    if (status) conditions.push(eq(bookingsTable.status, status as any));
    if (listingId) conditions.push(eq(bookingsTable.listingId, Number(listingId)));
    if (startDate) conditions.push(gte(bookingsTable.startDate, String(startDate)));
    if (endDate) conditions.push(lte(bookingsTable.endDate, String(endDate)));
    if (customerEmail) conditions.push(eq(bookingsTable.customerEmail, String(customerEmail)));

    const bookings = await db
      .select()
      .from(bookingsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(bookingsTable.createdAt);

    // Collect all listing IDs referenced by the returned bookings for title lookup
    const listingIds = [...new Set(bookings.map(b => b.listingId))];
    const listings = listingIds.length > 0
      ? await db.select({ id: listingsTable.id, title: listingsTable.title })
          .from(listingsTable)
          .where(or(...listingIds.map(id => eq(listingsTable.id, id))))
      : [];
    const titleMap = Object.fromEntries(listings.map(l => [l.id, l.title]));

    res.json(bookings.map(b => formatBooking(b, titleMap[b.listingId] ?? "Unknown")));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

router.post("/bookings", async (req, res) => {
  try {
    const body = req.body;

    // Verify listing belongs to this tenant
    const listingConditions = [eq(listingsTable.id, body.listingId)];
    if (req.tenantId) listingConditions.push(eq(listingsTable.tenantId, req.tenantId));
    const [listing] = await db.select().from(listingsTable).where(and(...listingConditions));
    if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }

    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const basePrice = parseFloat(listing.pricePerDay) * days * (body.quantity ?? 1);

    const addons: Array<{ id: number; name: string; price: number; priceType: string; subtotal: number }> = body.addons ?? [];
    const addonsTotal = addons.reduce((sum, a) => {
      const subtotal = a.priceType === "per_day" ? a.price * days : a.price;
      return sum + subtotal;
    }, 0);

    // Platform protection plan fee (passed from frontend, already validated against the category)
    const protectionPlanFee = body.protectionPlanFee ? parseFloat(body.protectionPlanFee) : 0;

    // Bundle items — additional listings included in this booking
    type BundleItem = { listingId: number; title: string; qty: number; pricePerDay: number; days: number; subtotal: number };
    const bundleItems: BundleItem[] = body.bundleItems ?? [];
    const bundleItemsTotal = bundleItems.reduce((sum, bi) => sum + (bi.subtotal ?? 0), 0);

    // Bundle discount — fetch from business profile if not provided by caller
    let bundleDiscountPct = 0;
    if (bundleItems.length > 0) {
      const explicitPct = body.bundleDiscountPct !== undefined ? parseFloat(body.bundleDiscountPct) : null;
      if (explicitPct !== null && !isNaN(explicitPct)) {
        bundleDiscountPct = explicitPct;
      } else if (req.tenantId) {
        const [biz] = await db.select({ pct: businessProfileTable.bundleDiscountPercent })
          .from(businessProfileTable)
          .where(eq(businessProfileTable.tenantId, req.tenantId));
        bundleDiscountPct = parseFloat(biz?.pct ?? "0") || 0;
      }
    }

    const preDiscountTotal = basePrice + bundleItemsTotal + addonsTotal + protectionPlanFee;
    const bundleDiscountAmount = bundleItems.length > 0 ? preDiscountTotal * (bundleDiscountPct / 100) : 0;
    const totalPrice = preDiscountTotal - bundleDiscountAmount;
    const addonsData = addons.length > 0 ? JSON.stringify(addons) : null;
    const bundleItemsJson = bundleItems.length > 0 ? JSON.stringify(bundleItems) : null;

    const { addons: _addons, bundleItems: _bi, assignedUnitIds: rawUnitIds, agreementSignedAt: _ignoredTs, agreementSignatureDataUrl, ruleInitials: ruleInitialsJson, protectionPlanFee: _ppf, ...restBody } = body;
    const assignedUnitIds = Array.isArray(rawUnitIds) && rawUnitIds.length > 0 ? JSON.stringify(rawUnitIds) : null;
    // Set agreementSignedAt server-side when the customer provides their signature
    const agreementSignedAt = restBody.agreementSignerName ? new Date() : null;

    // Kiosk bookings are always auto-confirmed; otherwise check the tenant's instant booking setting
    let autoConfirm = restBody.source === "kiosk";
    if (!autoConfirm && req.tenantId) {
      const [biz] = await db.select({ instantBooking: businessProfileTable.instantBooking })
        .from(businessProfileTable)
        .where(eq(businessProfileTable.tenantId, req.tenantId));
      autoConfirm = biz?.instantBooking ?? false;
    }

    const [created] = await db.insert(bookingsTable).values({
      ...restBody,
      tenantId: req.tenantId ?? null,
      totalPrice: String(totalPrice),
      addonsData,
      bundleItems: bundleItemsJson,
      bundleDiscountPct: bundleItems.length > 0 ? String(bundleDiscountPct) : null,
      assignedUnitIds,
      agreementSignedAt,
      agreementSignature: agreementSignatureDataUrl ?? null,
      ruleInitials: ruleInitialsJson ?? null,
      protectionPlanFee: protectionPlanFee > 0 ? String(protectionPlanFee) : null,
      ...(autoConfirm ? { status: "confirmed" } : {}),
      // Online bookings are unseen by admin until they open them
      seenByAdmin: restBody.source === "online" ? false : true,
      seenByRenter: true,
    }).returning();

    // Generate and save agreement PDF in the background
    if (agreementSignatureDataUrl && restBody.agreementSignerName && restBody.agreementText) {
      try {
        // Fetch company name for the PDF header
        let companyName = "Rental Company";
        if (req.tenantId) {
          const [biz] = await db.select({ businessName: businessProfileTable.businessName })
            .from(businessProfileTable)
            .where(eq(businessProfileTable.tenantId, req.tenantId));
          if (biz?.businessName) companyName = biz.businessName;
        }
        const signedAtDate = agreementSignedAt ?? new Date();
        const parsedRuleInitials = ruleInitialsJson
          ? (() => { try { return JSON.parse(ruleInitialsJson); } catch { return []; } })()
          : [];
        const pdfFilename = await generateAgreementPdf({
          bookingId: created.id,
          companyName,
          customerName: created.customerName,
          customerEmail: created.customerEmail,
          listingTitle: listing.title,
          startDate: created.startDate,
          endDate: created.endDate,
          agreementText: restBody.agreementText,
          signerName: restBody.agreementSignerName,
          signedAt: signedAtDate,
          signatureDataUrl: agreementSignatureDataUrl,
          ruleInitials: parsedRuleInitials,
        });
        await db.update(bookingsTable)
          .set({ agreementPdfPath: pdfFilename })
          .where(eq(bookingsTable.id, created.id));
        created.agreementPdfPath = pdfFilename;
      } catch (pdfErr) {
        req.log.error(pdfErr, "Failed to generate agreement PDF");
      }
    }

    // Send kiosk account-setup email in the background
    if (created.source === "kiosk" && created.customerEmail) {
      (async () => {
        try {
          let companyName = "Rental Company";
          let tenantSlug = "";
          let adminEmail: string | undefined;
          if (req.tenantId) {
            const [biz] = await db
              .select({ name: businessProfileTable.name, outboundEmail: businessProfileTable.outboundEmail })
              .from(businessProfileTable)
              .where(eq(businessProfileTable.tenantId, req.tenantId));
            if (biz?.name) companyName = biz.name;
            const [t] = await db
              .select({ slug: tenantsTable.slug, email: tenantsTable.email })
              .from(tenantsTable)
              .where(eq(tenantsTable.id, req.tenantId));
            if (t?.slug) tenantSlug = t.slug;
            adminEmail = biz?.outboundEmail ?? t?.email ?? undefined;
          }
          const smtpCreds = await getTenantSmtpCreds(req.tenantId);
          await withSmtpCreds(smtpCreds, () => sendKioskAccountSetupEmail({
            customerName: created.customerName,
            customerEmail: created.customerEmail,
            bookingId: created.id,
            tenantSlug,
            companyName,
            adminEmail,
            startDate: created.startDate,
            endDate: created.endDate,
            listingTitle: listing.title,
          }));
          appendEmailEvent(created.id, "kiosk_setup", created.customerEmail);
        } catch (emailErr) {
          req.log.warn(emailErr, "Failed to send kiosk account-setup email");
        }
      })();
    }

    // Send non-kiosk booking confirmation + pickup photo reminder to renter & admin
    if (created.source !== "kiosk" && created.customerEmail) {
      (async () => {
        try {
          let companyName = "Rental Company";
          let tenantSlug = "";
          let adminEmail: string | undefined;
          if (req.tenantId) {
            const [biz] = await db
              .select({ name: businessProfileTable.name, outboundEmail: businessProfileTable.outboundEmail })
              .from(businessProfileTable)
              .where(eq(businessProfileTable.tenantId, req.tenantId));
            if (biz?.name) companyName = biz.name;
            const [t] = await db
              .select({ slug: tenantsTable.slug, email: tenantsTable.email })
              .from(tenantsTable)
              .where(eq(tenantsTable.id, req.tenantId));
            if (t?.slug) tenantSlug = t.slug;
            adminEmail = biz?.outboundEmail ?? t?.email ?? undefined;
          }
          const smtpCreds = await getTenantSmtpCreds(req.tenantId);
          await withSmtpCreds(smtpCreds, () => sendBookingPickupReminderEmail({
            customerName: created.customerName,
            customerEmail: created.customerEmail,
            bookingId: created.id,
            listingTitle: listing.title,
            startDate: created.startDate,
            endDate: created.endDate,
            companyName,
            tenantSlug,
            adminEmail,
          }));
          appendEmailEvent(created.id, "confirmation", created.customerEmail);
          if (adminEmail && tenantSlug) {
            await sendAdminPickupReminderEmail({
              adminEmail,
              customerName: created.customerName,
              customerEmail: created.customerEmail,
              bookingId: created.id,
              listingTitle: listing.title,
              startDate: created.startDate,
              endDate: created.endDate,
              companyName,
              tenantSlug,
            });
          }
        } catch (emailErr) {
          req.log.warn(emailErr, "Failed to send non-kiosk booking emails");
        }
      })();
    }

    // Notify admin of new pending booking (action required if not auto-confirmed)
    if (req.tenantId && created.status !== "confirmed") {
      createNotification({
        tenantId: req.tenantId,
        targetType: "admin",
        type: "new_booking",
        title: "New booking request",
        body: `${created.customerName} booked ${listing.title} — ${created.startDate} to ${created.endDate}`,
        actionUrl: `/bookings/${created.id}`,
        isActionRequired: true,
        relatedId: created.id,
      }).catch(() => {});
    }

    res.status(201).json(formatBooking(created, listing.title));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// ── Unseen count for admin red dot ────────────────────────────────────────────
router.get("/bookings/unseen-count", async (req, res) => {
  try {
    if (!req.tenantId) { res.json({ count: 0 }); return; }
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookingsTable)
      .where(and(eq(bookingsTable.tenantId, req.tenantId), eq(bookingsTable.seenByAdmin, false)));
    res.json({ count: row?.count ?? 0 });
  } catch { res.json({ count: 0 }); }
});

// ── Mark booking as seen by admin or renter ────────────────────────────────────
router.patch("/bookings/:id/seen", async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    const { viewer } = req.body as { viewer: "admin" | "renter" };
    const updateField = viewer === "admin" ? { seenByAdmin: true } : { seenByRenter: true };
    const conditions = [eq(bookingsTable.id, bookingId)];
    if (req.tenantId) conditions.push(eq(bookingsTable.tenantId, req.tenantId));
    await db.update(bookingsTable).set(updateField).where(and(...conditions));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to mark seen" }); }
});

router.get("/bookings/:id", async (req, res) => {
  try {
    const bookingId = Number(req.params.id);

    // Require either tenant context (admin) or a valid customer token before returning booking data
    if (!req.tenantId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [booking] = await db.select().from(bookingsTable)
      .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.tenantId, req.tenantId)));

    if (!booking) { res.status(404).json({ error: "Not found" }); return; }

    const [listing] = await db
      .select({ title: listingsTable.title, contactCardId: listingsTable.contactCardId, depositAmount: listingsTable.depositAmount })
      .from(listingsTable)
      .where(eq(listingsTable.id, booking.listingId));

    let contactCard: typeof contactCardsTable.$inferSelect | null = null;
    const showCard = ["confirmed", "active", "completed"].includes(booking.status ?? "");
    if (showCard && listing?.contactCardId) {
      const [cc] = await db.select().from(contactCardsTable).where(eq(contactCardsTable.id, listing.contactCardId));
      contactCard = cc ?? null;
    }

    const depositAmount = listing?.depositAmount ? parseFloat(String(listing.depositAmount)) : null;

    res.json({ ...formatBooking(booking, listing?.title ?? "Unknown"), contactCard, depositAmount });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch booking" });
  }
});

router.get("/bookings/:id/agreement-pdf", async (req, res) => {
  try {
    const conditions = [eq(bookingsTable.id, Number(req.params.id))];
    if (req.tenantId) conditions.push(eq(bookingsTable.tenantId, req.tenantId));
    const [booking] = await db.select().from(bookingsTable).where(and(...conditions));
    if (!booking) { res.status(404).json({ error: "Not found" }); return; }
    if (!booking.agreementPdfPath) { res.status(404).json({ error: "No PDF available for this booking" }); return; }

    const filepath = path.join(UPLOADS_DIR_BOOKINGS, booking.agreementPdfPath);
    if (!fs.existsSync(filepath)) { res.status(404).json({ error: "PDF file not found" }); return; }

    const forceDownload = req.query.download === "1";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${forceDownload ? "attachment" : "inline"}; filename="rental-agreement-${booking.id}.pdf"`
    );
    fs.createReadStream(filepath).pipe(res);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to serve PDF" });
  }
});

router.put("/bookings/:id", async (req, res) => {
  try {
    const body = req.body;
    const bookingId = Number(req.params.id);
    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (body.status !== undefined) {
      updateData.status = body.status;
      // Status change → renter needs to see the new status
      updateData.seenByRenter = false;
    }
    // Any admin action on a booking marks it seen by admin
    updateData.seenByAdmin = true;
    if (body.adminNotes !== undefined) updateData.adminNotes = body.adminNotes;
    if (body.depositPaid !== undefined) updateData.depositPaid = body.depositPaid != null ? String(body.depositPaid) : null;
    if (body.customerName !== undefined) updateData.customerName = body.customerName;
    if (body.customerEmail !== undefined) updateData.customerEmail = body.customerEmail;
    if (body.customerPhone !== undefined) updateData.customerPhone = body.customerPhone || null;
    if (body.startDate !== undefined) updateData.startDate = body.startDate;
    if (body.endDate !== undefined) updateData.endDate = body.endDate;
    if (body.pickupTime !== undefined) updateData.pickupTime = body.pickupTime || null;
    if (body.dropoffTime !== undefined) updateData.dropoffTime = body.dropoffTime || null;
    if (body.quantity !== undefined) updateData.quantity = Number(body.quantity);
    if (body.notes !== undefined) updateData.notes = body.notes || null;
    if (body.source !== undefined) updateData.source = body.source;
    if (body.assignedUnitIds !== undefined) {
      updateData.assignedUnitIds = Array.isArray(body.assignedUnitIds) && body.assignedUnitIds.length > 0
        ? JSON.stringify(body.assignedUnitIds)
        : null;
    }
    // Accept explicit protectionPlanFee from admin form
    if (body.protectionPlanFee !== undefined) {
      updateData.protectionPlanFee = body.protectionPlanFee != null ? String(body.protectionPlanFee) : null;
    }

    // Recalculate total if dates/qty/listingId changed
    if (body.startDate !== undefined || body.endDate !== undefined || body.quantity !== undefined || body.listingId !== undefined) {
      const existingConditions = [eq(bookingsTable.id, bookingId)];
      if (req.tenantId) existingConditions.push(eq(bookingsTable.tenantId, req.tenantId));
      const [existing] = await db.select().from(bookingsTable).where(and(...existingConditions));
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }

      const listingId = body.listingId ?? existing.listingId;
      if (body.listingId !== undefined) updateData.listingId = Number(body.listingId);

      const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, listingId));
      if (listing) {
        const start = new Date(body.startDate ?? existing.startDate);
        const end = new Date(body.endDate ?? existing.endDate);
        const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        const qty = body.quantity ?? existing.quantity;
        const basePrice = parseFloat(listing.pricePerDay) * days * qty;
        const deposit = listing.depositAmount ? parseFloat(listing.depositAmount) : 0;
        // Include protection plan fee in recalculated total (use new value if provided, otherwise keep existing)
        const ppFee = body.protectionPlanFee != null
          ? parseFloat(String(body.protectionPlanFee))
          : (existing.protectionPlanFee ? parseFloat(existing.protectionPlanFee) : 0);
        updateData.totalPrice = String(basePrice + deposit + ppFee);
      }
    }

    // Get previous status for automation trigger — scoped to tenant
    const statusConditions = [eq(bookingsTable.id, bookingId)];
    if (req.tenantId) statusConditions.push(eq(bookingsTable.tenantId, req.tenantId));
    const previousStatus = (await db.select({ status: bookingsTable.status }).from(bookingsTable).where(and(...statusConditions)))[0]?.status;

    const whereConditions = [eq(bookingsTable.id, bookingId)];
    if (req.tenantId) whereConditions.push(eq(bookingsTable.tenantId, req.tenantId));
    const [updated] = await db
      .update(bookingsTable)
      .set(updateData)
      .where(and(...whereConditions))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }

    if (body.status && body.status !== previousStatus) {
      const triggerMap: Record<string, string> = {
        confirmed: "booking_confirmed",
        active: "booking_activated",
        completed: "booking_completed",
        cancelled: "booking_cancelled",
      };
      const trigger = triggerMap[body.status];
      if (trigger) {
        fetch(`http://localhost:8080/api/communications/send-automation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger, bookingId: updated.id, tenantId: req.tenantId ?? null }),
        }).catch(() => {});
      }

      // On confirmation: send contact card email to renter + notify admin
      if (body.status === "confirmed") {
        (async () => {
          try {
            const [listingRow] = await db
              .select({ title: listingsTable.title, contactCardId: listingsTable.contactCardId })
              .from(listingsTable)
              .where(eq(listingsTable.id, updated.listingId));

            const [profileRow] = await db
              .select({ name: businessProfileTable.name, email: businessProfileTable.email, outboundEmail: businessProfileTable.outboundEmail })
              .from(businessProfileTable)
              .where(eq(businessProfileTable.tenantId, updated.tenantId!));

            const [tenantRow] = await db
              .select({ slug: tenantsTable.slug, email: tenantsTable.email })
              .from(tenantsTable)
              .where(eq(tenantsTable.id, updated.tenantId!));

            const companyName = profileRow?.name ?? tenantRow?.slug ?? "Your Rental Company";
            const companyEmail = profileRow?.outboundEmail ?? profileRow?.email ?? tenantRow?.email ?? undefined;
            const smtpCreds = await getTenantSmtpCreds(updated.tenantId);

            // Notify renter: booking confirmed
            if (updated.tenantId && updated.customerEmail) {
              await createNotification({
                tenantId: updated.tenantId,
                targetType: "renter",
                targetEmail: updated.customerEmail,
                type: "booking_confirmed",
                title: "Booking confirmed!",
                body: `Your booking for ${listingRow?.title ?? "your rental"} from ${updated.startDate} to ${updated.endDate} has been confirmed by ${companyName}.`,
                actionUrl: "/my-bookings",
                isActionRequired: false,
                relatedId: updated.id,
              });
            }

            // Send contact card to renter if card is assigned
            if (listingRow?.contactCardId) {
              const [card] = await db
                .select()
                .from(contactCardsTable)
                .where(eq(contactCardsTable.id, listingRow.contactCardId));

              if (card) {
                await withSmtpCreds(smtpCreds, () => sendContactCardEmail({
                  toEmail: updated.customerEmail,
                  customerName: updated.customerName,
                  listingTitle: listingRow.title,
                  startDate: updated.startDate,
                  endDate: updated.endDate,
                  companyName,
                  companyEmail,
                  contactCard: card,
                }));
              }
            }

            // Notify admin/host with renter's contact info
            const adminEmail = companyEmail ?? tenantRow?.email;
            if (adminEmail) {
              await sendAdminBookingContactEmail({
                toEmail: adminEmail,
                companyName,
                customerName: updated.customerName,
                customerEmail: updated.customerEmail,
                customerPhone: updated.customerPhone,
                listingTitle: listingRow?.title ?? "Rental",
                startDate: updated.startDate,
                endDate: updated.endDate,
                bookingId: updated.id,
                slug: tenantRow?.slug ?? "",
              });
            }

            // Auto-send pickup link to renter on confirmation
            if (updated.customerEmail) {
              const pickupToken = updated.pickupToken ?? randomBytes(24).toString("hex");
              if (!updated.pickupToken) {
                await db.update(bookingsTable)
                  .set({ pickupToken: pickupToken, updatedAt: new Date() })
                  .where(eq(bookingsTable.id, updated.id));
              }
              const BASE = process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
              const pickupUrl = `${BASE}/${tenantRow?.slug ?? ""}/pickup/${pickupToken}`;
              withSmtpCreds(smtpCreds, () => sendPickupLinkEmail({
                toEmail: updated.customerEmail,
                customerName: updated.customerName,
                pickupUrl,
                listingTitle: listingRow?.title ?? "Rental Equipment",
                startDate: updated.startDate,
                endDate: updated.endDate,
                companyName,
                companyEmail,
                hostPickup: false,
              })).then(() => appendEmailEvent(updated.id, "pickup_link", updated.customerEmail))
                .catch(err => console.error("[auto pickup email]", err));
            }
          } catch (e) {
            console.error("[bookings] contact card email error:", e);
          }
        })();
      }

      // On cancellation → notify renter
      if (body.status === "cancelled" && updated.tenantId && updated.customerEmail) {
        createNotification({
          tenantId: updated.tenantId,
          targetType: "renter",
          targetEmail: updated.customerEmail,
          type: "booking_cancelled",
          title: "Booking cancelled",
          body: "Your booking has been cancelled. Please contact us if you have questions.",
          actionUrl: "/my-bookings",
          isActionRequired: false,
          relatedId: updated.id,
        }).catch(() => {});
      }

      // On check-in (active) → notify renter + auto-send return link
      if (body.status === "active" && updated.tenantId && updated.customerEmail) {
        createNotification({
          tenantId: updated.tenantId,
          targetType: "renter",
          targetEmail: updated.customerEmail,
          type: "booking_active",
          title: "You're checked in!",
          body: "Your rental is now active. Enjoy your adventure!",
          actionUrl: "/my-bookings",
          isActionRequired: false,
          relatedId: updated.id,
        }).catch(() => {});

        (async () => {
          try {
            const [listingRow] = await db
              .select({ title: listingsTable.title })
              .from(listingsTable)
              .where(eq(listingsTable.id, updated.listingId));

            const [profileRow] = await db
              .select({ name: businessProfileTable.name, email: businessProfileTable.email, outboundEmail: businessProfileTable.outboundEmail })
              .from(businessProfileTable)
              .where(eq(businessProfileTable.tenantId, updated.tenantId!));

            const [tenantRow] = await db
              .select({ slug: tenantsTable.slug, email: tenantsTable.email })
              .from(tenantsTable)
              .where(eq(tenantsTable.id, updated.tenantId!));

            const companyName = profileRow?.name ?? tenantRow?.slug ?? "Your Rental Company";
            const companyEmail = profileRow?.outboundEmail ?? profileRow?.email ?? tenantRow?.email ?? undefined;
            const smtpCreds = await getTenantSmtpCreds(updated.tenantId);

            const returnToken = updated.returnToken ?? randomBytes(24).toString("hex");
            if (!updated.returnToken) {
              await db.update(bookingsTable)
                .set({ returnToken: returnToken, updatedAt: new Date() })
                .where(eq(bookingsTable.id, updated.id));
            }
            const BASE = process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
            const returnUrl = `${BASE}/${tenantRow?.slug ?? ""}/return/${returnToken}`;

            await withSmtpCreds(smtpCreds, () => sendReturnLinkEmail({
              toEmail: updated.customerEmail,
              customerName: updated.customerName,
              returnUrl,
              listingTitle: listingRow?.title ?? "Rental Equipment",
              startDate: updated.startDate,
              endDate: updated.endDate,
              companyName,
              companyEmail,
            }));
            await appendEmailEvent(updated.id, "return_link", updated.customerEmail);
          } catch (e) {
            console.error("[auto return email]", e);
          }
        })();
      }
    }

    const [listing] = await db.select({ title: listingsTable.title }).from(listingsTable).where(eq(listingsTable.id, updated.listingId));
    res.json(formatBooking(updated, listing?.title ?? "Unknown"));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update booking" });
  }
});

// ── Helper: find a booking for admin actions ───────────────────────────────────
// Mirrors the two-stage lookup in GET /bookings/:id so admin action endpoints
// (send email, copy link, etc.) succeed even when a booking's tenant_id is null
// or was set under a slightly different tenant context.
async function findBookingForAdmin(bookingId: number, tenantId?: number) {
  let booking: typeof bookingsTable.$inferSelect | undefined;
  if (tenantId) {
    [booking] = await db.select().from(bookingsTable)
      .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.tenantId, tenantId)));
  }
  if (!booking) {
    [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId));
  }
  return booking;
}

// ── GET /bookings/:id/pickup-link ──────────────────────────────────────────────
// Admin: get existing pickup URL (no email sent); generates token if missing
router.get("/bookings/:id/pickup-link", async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    const booking = await findBookingForAdmin(bookingId, req.tenantId);
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

    const token = booking.pickupToken ?? randomBytes(24).toString("hex");
    if (!booking.pickupToken) {
      await db.update(bookingsTable).set({ pickupToken: token, updatedAt: new Date() }).where(eq(bookingsTable.id, bookingId));
    }

    const BASE = process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
    const slug = req.headers["x-tenant-slug"] as string ?? "";
    const pickupUrl = `${BASE}/${slug}/pickup/${token}`;
    res.json({ ok: true, token, pickupUrl, linkSent: !!booking.pickupToken });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get pickup link" });
  }
});

// ── POST /bookings/:id/send-pickup-link ────────────────────────────────────────
// Admin: generate a unique token and email the renter their pickup photo link
// Body: { hostPickup?: boolean }  — when true, email copy says host handed off equipment
router.post("/bookings/:id/send-pickup-link", async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    const { hostPickup } = req.body as { hostPickup?: boolean };
    const booking = await findBookingForAdmin(bookingId, req.tenantId);
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

    // Generate a token (or reuse existing one)
    const token = booking.pickupToken ?? randomBytes(24).toString("hex");
    await db.update(bookingsTable).set({ pickupToken: token, updatedAt: new Date() }).where(eq(bookingsTable.id, bookingId));

    // Get listing title and business profile for the email
    const [listing] = await db.select({ title: listingsTable.title }).from(listingsTable).where(eq(listingsTable.id, booking.listingId));
    let companyName = "OutdoorShare";
    let companyEmail: string | undefined;
    if (req.tenantId) {
      const [biz] = await db.select({ name: businessProfileTable.name }).from(businessProfileTable).where(eq(businessProfileTable.tenantId, req.tenantId));
      if (biz?.name) companyName = biz.name;
      const [tenant] = await db.select({ email: tenantsTable.email }).from(tenantsTable).where(eq(tenantsTable.id, req.tenantId)).limit(1);
      if (tenant?.email) companyEmail = tenant.email;
    }

    const BASE = process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
    const slug = req.headers["x-tenant-slug"] as string ?? "";
    const pickupUrl = `${BASE}/${slug}/pickup/${token}`;

    sendPickupLinkEmail({
      toEmail: booking.customerEmail,
      customerName: booking.customerName,
      pickupUrl,
      listingTitle: listing?.title ?? "Rental Equipment",
      startDate: booking.startDate,
      endDate: booking.endDate,
      companyName,
      companyEmail,
      hostPickup: !!hostPickup,
    }).then(() => appendEmailEvent(bookingId, "pickup_link", booking.customerEmail))
      .catch(err => console.error("[pickup email]", err));

    res.json({ ok: true, token, pickupUrl });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to send pickup link" });
  }
});

// ── POST /bookings/:id/send-agreement-link ─────────────────────────────────────
// Admin: generate/reuse pickup token and send an agreement-focused email to renter
router.post("/bookings/:id/send-agreement-link", async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    const booking = await findBookingForAdmin(bookingId, req.tenantId);
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

    // Generate or reuse existing pickup token
    const token = booking.pickupToken ?? randomBytes(24).toString("hex");
    if (!booking.pickupToken) {
      await db.update(bookingsTable).set({ pickupToken: token, updatedAt: new Date() }).where(eq(bookingsTable.id, bookingId));
    }

    const [listing] = await db.select({ title: listingsTable.title }).from(listingsTable).where(eq(listingsTable.id, booking.listingId));
    let companyName = "OutdoorShare";
    let companyEmail: string | undefined;
    if (req.tenantId) {
      const [biz] = await db.select({ name: businessProfileTable.name }).from(businessProfileTable).where(eq(businessProfileTable.tenantId, req.tenantId));
      if (biz?.name) companyName = biz.name;
      const [tenant] = await db.select({ email: tenantsTable.email }).from(tenantsTable).where(eq(tenantsTable.id, req.tenantId)).limit(1);
      if (tenant?.email) companyEmail = tenant.email;
    }

    const BASE = process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
    const slug = req.headers["x-tenant-slug"] as string ?? "";
    const agreementUrl = `${BASE}/${slug}/pickup/${token}`;

    sendAgreementLinkEmail({
      toEmail: booking.customerEmail,
      customerName: booking.customerName,
      agreementUrl,
      listingTitle: listing?.title ?? "Rental Equipment",
      startDate: booking.startDate,
      endDate: booking.endDate,
      companyName,
      companyEmail,
    }).then(() => appendEmailEvent(bookingId, "agreement_link", booking.customerEmail))
      .catch(err => console.error("[agreement email]", err));

    res.json({ ok: true, token, agreementUrl });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to send agreement link" });
  }
});

// ── POST /bookings/:id/send-identity-link ──────────────────────────────────────
// Admin: create a Stripe Identity verification session and email the renter the link
router.post("/bookings/:id/send-identity-link", async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    const booking = await findBookingForAdmin(bookingId, req.tenantId);
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

    const [listing] = await db.select({ title: listingsTable.title }).from(listingsTable).where(eq(listingsTable.id, booking.listingId));
    let companyName = "OutdoorShare";
    let companyEmail: string | undefined;
    const slug = req.headers["x-tenant-slug"] as string ?? "";

    const [tenant] = req.tenantId
      ? await db.select().from(tenantsTable).where(eq(tenantsTable.id, req.tenantId))
      : [];
    if (tenant?.name) companyName = tenant.name;
    if (tenant?.email) companyEmail = tenant.email;

    const isTestMode = !!(tenant?.testMode);
    const stripeClient = getStripeForTenant(isTestMode);

    // Look up customer to link session
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.email, booking.customerEmail.toLowerCase()));

    const BASE = process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
    const returnUrl = `${BASE}/${slug}`;

    let session: any;
    try {
      session = await (stripeClient as any).identity.verificationSessions.create({
        type: "document",
        metadata: {
          tenant_slug: slug,
          booking_id: String(bookingId),
          customer_id: customer ? String(customer.id) : undefined,
        },
        options: {
          document: {
            allowed_types: ["driving_license", "passport", "id_card"],
            require_id_number: false,
            require_live_capture: true,
            require_matching_selfie: true,
          },
        },
        return_url: returnUrl,
      });
    } catch (primaryErr: any) {
      // Fall back to test mode if live key lacks identity permission
      const isPermErr = primaryErr?.code === "permission_error" || (primaryErr?.message ?? "").includes("rak_identity_product_write");
      if (!isTestMode && isPermErr) {
        session = await (getStripeForTenant(true) as any).identity.verificationSessions.create({
          type: "document",
          metadata: { tenant_slug: slug, booking_id: String(bookingId) },
          options: { document: { allowed_types: ["driving_license", "passport", "id_card"], require_id_number: false, require_live_capture: true, require_matching_selfie: true } },
          return_url: returnUrl,
        });
      } else throw primaryErr;
    }

    // Update customer record if found
    if (customer) {
      await db.update(customersTable).set({
        identityVerificationStatus: "pending",
        identityVerificationSessionId: session.id,
        updatedAt: new Date(),
      }).where(eq(customersTable.id, customer.id));
    }

    sendIdentityVerificationEmail({
      toEmail: booking.customerEmail,
      customerName: booking.customerName,
      verificationUrl: session.url,
      listingTitle: listing?.title ?? "Rental Equipment",
      companyName,
      companyEmail,
    }).then(() => appendEmailEvent(bookingId, "identity_link", booking.customerEmail))
      .catch(err => console.error("[identity email]", err));

    res.json({ ok: true, sessionId: session.id, url: session.url });
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: err.message || "Failed to send identity link" });
  }
});

// ── GET /pickup/:token ────────────────────────────────────────────────────────
// Public: renter loads their pickup page
router.get("/pickup/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.pickupToken, token));
    if (!booking) { res.status(404).json({ error: "Pickup link not found or expired" }); return; }

    const [listing] = await db.select({ title: listingsTable.title, imageUrls: listingsTable.imageUrls }).from(listingsTable).where(eq(listingsTable.id, booking.listingId));
    let companyName = "OutdoorShare";
    let logoUrl: string | null = null;
    if (booking.tenantId) {
      const [biz] = await db.select({ name: businessProfileTable.name, logoUrl: businessProfileTable.logoUrl }).from(businessProfileTable).where(eq(businessProfileTable.tenantId, booking.tenantId));
      if (biz?.name) companyName = biz.name;
      if (biz?.logoUrl) logoUrl = biz.logoUrl;
    }

    res.json({
      bookingId: booking.id,
      customerName: booking.customerName,
      startDate: booking.startDate,
      endDate: booking.endDate,
      listingTitle: listing?.title ?? "Rental Equipment",
      listingImage: Array.isArray(listing?.imageUrls) && listing.imageUrls.length > 0 ? listing.imageUrls[0] : null,
      companyName,
      logoUrl,
      source: booking.source ?? "online",
      pickupCompleted: !!booking.pickupCompletedAt,
      pickupPhotos: booking.pickupPhotos ? JSON.parse(booking.pickupPhotos) : [],
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to load pickup info" });
  }
});

// ── POST /bookings/:id/before-photos ─────────────────────────────────────────
// Public: renter uploads before-rental condition photos during booking flow
router.post("/bookings/:id/before-photos", pickupUpload.array("photos", 15), async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    if (isNaN(bookingId)) { res.status(400).json({ error: "Invalid booking id" }); return; }

    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId));
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) { res.status(400).json({ error: "No photos uploaded" }); return; }

    const isFirstCompletion = !booking.pickupCompletedAt;
    const existingPhotos: string[] = booking.pickupPhotos ? JSON.parse(booking.pickupPhotos) : [];
    const newPhotoUrls = files.map(f => `/api/uploads/${f.filename}`);
    const allPhotos = [...existingPhotos, ...newPhotoUrls];

    await db.update(bookingsTable).set({
      pickupPhotos: JSON.stringify(allPhotos),
      pickupCompletedAt: booking.pickupCompletedAt ?? new Date(),
      updatedAt: new Date(),
    }).where(eq(bookingsTable.id, booking.id));

    if (isFirstCompletion) {
      // Auto-trigger deposit hold/charge at pickup (non-fatal)
      await triggerDepositAtPickup(booking, req.log);

      // Send "ready to adventure" email
      if (booking.customerEmail) {
        (async () => {
          try {
            let companyName = "Rental Company";
            let adminEmail: string | undefined;
            if (booking.tenantId) {
              const [biz] = await db.select({ businessName: businessProfileTable.businessName })
                .from(businessProfileTable).where(eq(businessProfileTable.tenantId, booking.tenantId));
              if (biz?.businessName) companyName = biz.businessName;
              const [t] = await db.select({ email: tenantsTable.email })
                .from(tenantsTable).where(eq(tenantsTable.id, booking.tenantId));
              if (t?.email) adminEmail = t.email;
            }
            const smtpCreds = await getTenantSmtpCreds(booking.tenantId);
            const listingTitle1 = booking.listingId
              ? (await db.select({ title: listingsTable.title }).from(listingsTable).where(eq(listingsTable.id, booking.listingId)))[0]?.title ?? "your rental"
              : "your rental";
            await withSmtpCreds(smtpCreds, () => sendReadyToAdventureEmail({
              customerName: booking.customerName,
              customerEmail: booking.customerEmail,
              bookingId: booking.id,
              listingTitle: listingTitle1,
              startDate: booking.startDate,
              endDate: booking.endDate,
              companyName,
              adminEmail,
            }));
          } catch (emailErr) {
            req.log.warn(emailErr, "Failed to send ready-to-adventure email");
          }
        })();
      }
    }

    res.json({ ok: true, photos: allPhotos, count: allPhotos.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to upload before-rental photos" });
  }
});

// ── POST /pickup/:token/photos ────────────────────────────────────────────────
// Public: renter uploads pickup condition photos
router.post("/pickup/:token/photos", pickupUpload.array("photos", 20), async (req, res) => {
  try {
    const { token } = req.params;
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.pickupToken, token));
    if (!booking) { res.status(404).json({ error: "Pickup link not found" }); return; }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) { res.status(400).json({ error: "No photos uploaded" }); return; }

    const isFirstCompletion = !booking.pickupCompletedAt;
    const existingPhotos: string[] = booking.pickupPhotos ? JSON.parse(booking.pickupPhotos) : [];
    const newPhotoUrls = files.map(f => `/api/uploads/${f.filename}`);
    const allPhotos = [...existingPhotos, ...newPhotoUrls];

    await db.update(bookingsTable).set({
      pickupPhotos: JSON.stringify(allPhotos),
      pickupCompletedAt: booking.pickupCompletedAt ?? new Date(),
      updatedAt: new Date(),
    }).where(eq(bookingsTable.id, booking.id));

    if (isFirstCompletion) {
      // Auto-trigger deposit hold/charge at pickup (non-fatal)
      await triggerDepositAtPickup(booking, req.log);

      // Send "ready to adventure" email
      if (booking.customerEmail) {
        (async () => {
          try {
            let companyName = "Rental Company";
            let adminEmail: string | undefined;
            if (booking.tenantId) {
              const [biz] = await db.select({ businessName: businessProfileTable.businessName })
                .from(businessProfileTable).where(eq(businessProfileTable.tenantId, booking.tenantId));
              if (biz?.businessName) companyName = biz.businessName;
              const [t] = await db.select({ email: tenantsTable.email })
                .from(tenantsTable).where(eq(tenantsTable.id, booking.tenantId));
              if (t?.email) adminEmail = t.email;
            }
            const smtpCreds = await getTenantSmtpCreds(booking.tenantId);
            const listingTitle = booking.listingId
              ? (await db.select({ title: listingsTable.title }).from(listingsTable).where(eq(listingsTable.id, booking.listingId)))[0]?.title ?? "your rental"
              : "your rental";
            await withSmtpCreds(smtpCreds, () => sendReadyToAdventureEmail({
              customerName: booking.customerName,
              customerEmail: booking.customerEmail,
              bookingId: booking.id,
              listingTitle,
              startDate: booking.startDate,
              endDate: booking.endDate,
              companyName,
              adminEmail,
            }));
          } catch (emailErr) {
            req.log.warn(emailErr, "Failed to send ready-to-adventure email");
          }
        })();
      }
    }

    res.json({ ok: true, photos: allPhotos, count: allPhotos.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to upload pickup photos" });
  }
});

// ── GET /bookings/:id/return-link ─────────────────────────────────────────────
// Admin: get existing return URL (no email sent); generates token if missing
router.get("/bookings/:id/return-link", async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    const booking = await findBookingForAdmin(bookingId, req.tenantId);
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

    const token = booking.returnToken ?? randomBytes(24).toString("hex");
    if (!booking.returnToken) {
      await db.update(bookingsTable).set({ returnToken: token, updatedAt: new Date() }).where(eq(bookingsTable.id, bookingId));
    }

    const BASE = process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
    const slug = req.headers["x-tenant-slug"] as string ?? "";
    const returnUrl = `${BASE}/${slug}/return/${token}`;
    res.json({ ok: true, token, returnUrl });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get return link" });
  }
});

// ── POST /bookings/:id/send-return-link ────────────────────────────────────────
// Admin: generate a unique token and email the renter their return photo link
router.post("/bookings/:id/send-return-link", async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    const booking = await findBookingForAdmin(bookingId, req.tenantId);
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

    const token = booking.returnToken ?? randomBytes(24).toString("hex");
    await db.update(bookingsTable).set({ returnToken: token, updatedAt: new Date() }).where(eq(bookingsTable.id, bookingId));

    const [listing] = await db.select({ title: listingsTable.title }).from(listingsTable).where(eq(listingsTable.id, booking.listingId));
    let companyName = "OutdoorShare";
    let companyEmail: string | undefined;
    if (req.tenantId) {
      const [biz] = await db.select({ name: businessProfileTable.name }).from(businessProfileTable).where(eq(businessProfileTable.tenantId, req.tenantId));
      if (biz?.name) companyName = biz.name;
      const [tenant] = await db.select({ email: tenantsTable.email }).from(tenantsTable).where(eq(tenantsTable.id, req.tenantId)).limit(1);
      if (tenant?.email) companyEmail = tenant.email;
    }

    const BASE = process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
    const slug = req.headers["x-tenant-slug"] as string ?? "";
    const returnUrl = `${BASE}/${slug}/return/${token}`;

    sendReturnLinkEmail({
      toEmail: booking.customerEmail,
      customerName: booking.customerName,
      returnUrl,
      listingTitle: listing?.title ?? "Rental Equipment",
      startDate: booking.startDate,
      endDate: booking.endDate,
      companyName,
      companyEmail,
    }).then(() => appendEmailEvent(bookingId, "return_link", booking.customerEmail))
      .catch(err => console.error("[return email]", err));

    res.json({ ok: true, token, returnUrl });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to send return link" });
  }
});

// ── GET /return/:token ────────────────────────────────────────────────────────
// Public: renter loads their return photo page
router.get("/return/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.returnToken, token));
    if (!booking) { res.status(404).json({ error: "Return link not found or expired" }); return; }

    const [listing] = await db.select({ title: listingsTable.title, imageUrls: listingsTable.imageUrls }).from(listingsTable).where(eq(listingsTable.id, booking.listingId));
    let companyName = "OutdoorShare";
    let logoUrl: string | null = null;
    if (booking.tenantId) {
      const [biz] = await db.select({ name: businessProfileTable.name, logoUrl: businessProfileTable.logoUrl }).from(businessProfileTable).where(eq(businessProfileTable.tenantId, booking.tenantId));
      if (biz?.name) companyName = biz.name;
      if (biz?.logoUrl) logoUrl = biz.logoUrl;
    }

    res.json({
      bookingId: booking.id,
      customerName: booking.customerName,
      startDate: booking.startDate,
      endDate: booking.endDate,
      listingTitle: listing?.title ?? "Rental Equipment",
      listingImage: Array.isArray(listing?.imageUrls) && listing.imageUrls.length > 0 ? listing.imageUrls[0] : null,
      companyName,
      logoUrl,
      returnCompleted: !!booking.returnCompletedAt,
      returnPhotos: booking.returnPhotos ? JSON.parse(booking.returnPhotos) : [],
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to load return info" });
  }
});

// ── POST /return/:token/photos ─────────────────────────────────────────────────
// Public: renter uploads return condition photos
router.post("/return/:token/photos", pickupUpload.array("photos", 20), async (req, res) => {
  try {
    const { token } = req.params;
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.returnToken, token));
    if (!booking) { res.status(404).json({ error: "Return link not found" }); return; }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) { res.status(400).json({ error: "No photos uploaded" }); return; }

    const existing: string[] = booking.returnPhotos ? JSON.parse(booking.returnPhotos) : [];
    const newUrls = files.map(f => `/api/uploads/${f.filename}`);
    const allPhotos = [...existing, ...newUrls];

    await db.update(bookingsTable).set({
      returnPhotos: JSON.stringify(allPhotos),
      returnCompletedAt: booking.returnCompletedAt ?? new Date(),
      updatedAt: new Date(),
    }).where(eq(bookingsTable.id, booking.id));

    res.json({ ok: true, photos: allPhotos, count: allPhotos.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to upload return photos" });
  }
});

// ── POST /bookings/:id/inspect ─────────────────────────────────────────────────
// Admin: run AI vision inspection comparing before (pickup) and after (return) photos
const INSPECTION_SYSTEM_PROMPT = `You are an AI inspection assistant for OutdoorShare rental returns.

Compare BEFORE and AFTER images of the same rental product and identify NEW issues introduced during the rental.

Detect:

- Physical damage (scratches, dents, cracks, broken parts)
- Excessive dirt or cleanliness issues
- Missing parts or accessories
- Visible mechanical issues (flat tires, misalignment, broken components)

Be accurate and conservative. Only report issues that clearly appear in the AFTER image but not in BEFORE.

Also determine if each issue is suitable for a damage claim.

Return ONLY valid JSON:

{
  "status": "no_issues | minor_issues | major_issues",
  "damage_detected": true/false,
  "claim_recommended": true/false,
  "issues": [
    {
      "type": "damage | cleanliness | missing_part | mechanical",
      "description": "what changed",
      "location": "where on the product",
      "severity": "minor | moderate | severe",
      "claim_recommended": true/false,
      "confidence": 0-100
    }
  ],
  "admin_summary": "clear explanation for admin decision making",
  "confidence_score": 0-100
}`;

router.post("/bookings/:id/inspect", async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    const conditions = [eq(bookingsTable.id, bookingId)];
    if (req.tenantId) conditions.push(eq(bookingsTable.tenantId, req.tenantId));
    const [booking] = await db.select().from(bookingsTable).where(and(...conditions));
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

    const beforePhotos: string[] = booking.pickupPhotos ? JSON.parse(booking.pickupPhotos) : [];
    const afterPhotos: string[] = (booking as any).returnPhotos ? JSON.parse((booking as any).returnPhotos) : [];

    if (beforePhotos.length === 0 && afterPhotos.length === 0) {
      res.status(400).json({ error: "No photos available for inspection" }); return;
    }

    // Helper: read a photo (from disk if local path, or from the before-photos stored in uploads/)
    const toBase64 = (photoPath: string): { base64: string; mime: string } | null => {
      try {
        // Local path: /api/uploads/filename.jpg → uploads/filename.jpg
        const relative = photoPath.replace(/^\/api\/uploads\//, "");
        const filePath = path.join(UPLOADS_DIR_BOOKINGS, relative);
        if (!fs.existsSync(filePath)) return null;
        const buf = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase().replace(".", "");
        const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic" };
        const mime = mimeMap[ext] ?? "image/jpeg";
        return { base64: buf.toString("base64"), mime };
      } catch { return null; }
    };

    // Build vision content array
    const buildImageContent = (photos: string[], label: string): any[] => {
      const items: any[] = [{ type: "text", text: `--- ${label} ---` }];
      for (const p of photos.slice(0, 5)) {
        const img = toBase64(p);
        if (img) {
          items.push({ type: "image_url", image_url: { url: `data:${img.mime};base64,${img.base64}`, detail: "low" } });
        }
      }
      return items;
    };

    const content: any[] = [
      { type: "text", text: "Please compare the BEFORE and AFTER images of this rental equipment and identify any new damage or issues introduced during the rental." },
      ...buildImageContent(beforePhotos, "BEFORE photos (at pickup)"),
      ...buildImageContent(afterPhotos, "AFTER photos (at return)"),
      { type: "text", text: "Return ONLY valid JSON as specified in your system prompt." },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: INSPECTION_SYSTEM_PROMPT },
        { role: "user", content },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

    let result: any;
    try { result = JSON.parse(cleaned); }
    catch { result = { status: "error", admin_summary: "AI returned an unparseable response. Try again.", raw }; }

    // Store result in DB
    await db.update(bookingsTable).set({
      inspectionResult: JSON.stringify(result),
      updatedAt: new Date(),
    } as any).where(eq(bookingsTable.id, bookingId));

    res.json({ ok: true, result });
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: err.message ?? "Inspection failed" });
  }
});

export default router;
