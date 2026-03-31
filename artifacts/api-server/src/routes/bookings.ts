import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { bookingsTable, listingsTable, businessProfileTable, tenantsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, isNull, or } from "drizzle-orm";
import { generateAgreementPdf } from "../lib/generate-agreement-pdf";
import { sendPickupLinkEmail, sendKioskAccountSetupEmail } from "../services/gmail";

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

function formatBooking(b: typeof bookingsTable.$inferSelect, listingTitle: string) {
  return {
    ...b,
    listingTitle,
    totalPrice: parseFloat(b.totalPrice ?? "0"),
    depositPaid: b.depositPaid ? parseFloat(b.depositPaid) : null,
    pickupPhotos: b.pickupPhotos ? JSON.parse(b.pickupPhotos) : [],
    pickupLinkSent: !!b.pickupToken,
    pickupCompletedAt: b.pickupCompletedAt ? b.pickupCompletedAt.toISOString() : null,
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

    const totalPrice = basePrice + addonsTotal;
    const addonsData = addons.length > 0 ? JSON.stringify(addons) : null;

    const { addons: _addons, assignedUnitIds: rawUnitIds, agreementSignedAt: _ignoredTs, agreementSignatureDataUrl, ruleInitials: ruleInitialsJson, ...restBody } = body;
    const assignedUnitIds = Array.isArray(rawUnitIds) && rawUnitIds.length > 0 ? JSON.stringify(rawUnitIds) : null;
    // Set agreementSignedAt server-side when the customer provides their signature
    const agreementSignedAt = restBody.agreementSignerName ? new Date() : null;
    const [created] = await db.insert(bookingsTable).values({
      ...restBody,
      tenantId: req.tenantId ?? null,
      totalPrice: String(totalPrice),
      addonsData,
      assignedUnitIds,
      agreementSignedAt,
      agreementSignature: agreementSignatureDataUrl ?? null,
      ruleInitials: ruleInitialsJson ?? null,
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
              .select({ businessName: businessProfileTable.businessName })
              .from(businessProfileTable)
              .where(eq(businessProfileTable.tenantId, req.tenantId));
            if (biz?.businessName) companyName = biz.businessName;
            const [t] = await db
              .select({ slug: tenantsTable.slug, email: tenantsTable.email })
              .from(tenantsTable)
              .where(eq(tenantsTable.id, req.tenantId));
            if (t?.slug) tenantSlug = t.slug;
            if (t?.email) adminEmail = t.email;
          }
          await sendKioskAccountSetupEmail({
            customerName: created.customerName,
            customerEmail: created.customerEmail,
            bookingId: created.id,
            tenantSlug,
            companyName,
            adminEmail,
            startDate: created.startDate,
            endDate: created.endDate,
            listingTitle: listing.title,
          });
        } catch (emailErr) {
          req.log.warn(emailErr, "Failed to send kiosk account-setup email");
        }
      })();
    }

    res.status(201).json(formatBooking(created, listing.title));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

router.get("/bookings/:id", async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    let booking: typeof bookingsTable.$inferSelect | undefined;

    // First try scoped to this tenant
    if (req.tenantId) {
      [booking] = await db.select().from(bookingsTable)
        .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.tenantId, req.tenantId)));
    }

    // If not found (or no tenant context), fall back to finding by ID alone.
    // The caller (storefront) enforces ownership via customerEmail check on the client.
    if (!booking) {
      [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId));
    }

    if (!booking) { res.status(404).json({ error: "Not found" }); return; }

    const [listing] = await db.select({ title: listingsTable.title }).from(listingsTable).where(eq(listingsTable.id, booking.listingId));
    res.json(formatBooking(booking, listing?.title ?? "Unknown"));
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

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="rental-agreement-${booking.id}.pdf"`);
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

    if (body.status !== undefined) updateData.status = body.status;
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
        updateData.totalPrice = String(basePrice + deposit);
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
    }

    const [listing] = await db.select({ title: listingsTable.title }).from(listingsTable).where(eq(listingsTable.id, updated.listingId));
    res.json(formatBooking(updated, listing?.title ?? "Unknown"));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update booking" });
  }
});

// ── GET /bookings/:id/pickup-link ──────────────────────────────────────────────
// Admin: get existing pickup URL (no email sent); generates token if missing
router.get("/bookings/:id/pickup-link", async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    const conditions = [eq(bookingsTable.id, bookingId)];
    if (req.tenantId) conditions.push(eq(bookingsTable.tenantId, req.tenantId));
    const [booking] = await db.select().from(bookingsTable).where(and(...conditions));
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
    const conditions = [eq(bookingsTable.id, bookingId)];
    if (req.tenantId) conditions.push(eq(bookingsTable.tenantId, req.tenantId));

    const [booking] = await db.select().from(bookingsTable).where(and(...conditions));
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
    }).catch(err => console.error("[pickup email]", err));

    res.json({ ok: true, token, pickupUrl });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to send pickup link" });
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
      pickupCompleted: !!booking.pickupCompletedAt,
      pickupPhotos: booking.pickupPhotos ? JSON.parse(booking.pickupPhotos) : [],
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to load pickup info" });
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

    const existingPhotos: string[] = booking.pickupPhotos ? JSON.parse(booking.pickupPhotos) : [];
    const newPhotoUrls = files.map(f => `/api/uploads/${f.filename}`);
    const allPhotos = [...existingPhotos, ...newPhotoUrls];

    await db.update(bookingsTable).set({
      pickupPhotos: JSON.stringify(allPhotos),
      pickupCompletedAt: booking.pickupCompletedAt ?? new Date(),
      updatedAt: new Date(),
    }).where(eq(bookingsTable.id, booking.id));

    res.json({ ok: true, photos: allPhotos, count: allPhotos.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to upload pickup photos" });
  }
});

export default router;
