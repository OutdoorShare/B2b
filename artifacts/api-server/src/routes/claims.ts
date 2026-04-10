import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { claimsTable, bookingsTable, listingsTable, tenantsTable } from "@workspace/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { sendClaimAlertEmail, sendClaimStatusAlertEmail } from "../services/gmail";
import { getStripeForTenant } from "../services/stripe";
import { createNotification } from "../services/notifications";

const router: IRouter = Router();

function formatClaim(c: typeof claimsTable.$inferSelect) {
  return {
    ...c,
    claimedAmount: c.claimedAmount ? parseFloat(c.claimedAmount) : null,
    settledAmount: c.settledAmount ? parseFloat(c.settledAmount) : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.get("/claims", async (req, res) => {
  try {
    const { status, type, customerEmail, startDate, endDate } = req.query;
    const conditions = [];
    if (req.tenantId) conditions.push(eq(claimsTable.tenantId, req.tenantId));
    if (status) conditions.push(eq(claimsTable.status, status as any));
    if (type) conditions.push(eq(claimsTable.type, type as any));
    if (customerEmail) conditions.push(eq(claimsTable.customerEmail, String(customerEmail)));
    if (startDate) conditions.push(gte(claimsTable.createdAt, new Date(String(startDate))));
    if (endDate) conditions.push(lte(claimsTable.createdAt, new Date(String(endDate))));

    const claims = await db
      .select()
      .from(claimsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(claimsTable.createdAt));

    res.json(claims.map(formatClaim));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch claims" });
  }
});

router.get("/claims/:id", async (req, res) => {
  try {
    const conditions = [eq(claimsTable.id, Number(req.params.id))];
    if (req.tenantId) conditions.push(eq(claimsTable.tenantId, req.tenantId));
    const [claim] = await db.select().from(claimsTable).where(and(...conditions));
    if (!claim) return res.status(404).json({ error: "Not found" });

    let bookingInfo = null;
    let listingInfo = null;
    if (claim.bookingId) {
      const bookingConditions = [eq(bookingsTable.id, claim.bookingId)];
      if (req.tenantId) bookingConditions.push(eq(bookingsTable.tenantId, req.tenantId));
      const [b] = await db
        .select({ id: bookingsTable.id, startDate: bookingsTable.startDate, endDate: bookingsTable.endDate, totalPrice: bookingsTable.totalPrice })
        .from(bookingsTable).where(and(...bookingConditions));
      bookingInfo = b ?? null;
    }
    if (claim.listingId) {
      const listingConditions = [eq(listingsTable.id, claim.listingId)];
      if (req.tenantId) listingConditions.push(eq(listingsTable.tenantId, req.tenantId));
      const [l] = await db
        .select({ id: listingsTable.id, title: listingsTable.title, imageUrls: listingsTable.imageUrls })
        .from(listingsTable).where(and(...listingConditions));
      listingInfo = l ?? null;
    }

    res.json({ ...formatClaim(claim), booking: bookingInfo, listing: listingInfo });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch claim" });
  }
});

router.post("/claims", async (req, res) => {
  try {
    const { bookingId, listingId, customerName, customerEmail, type, description, claimedAmount, evidenceUrls, chargeCardOnFile } = req.body;
    if (!customerName || !customerEmail || !description) {
      return res.status(400).json({ error: "customerName, customerEmail, and description are required" });
    }

    // Block claims on bookings where the renter explicitly declined the protection plan
    if (bookingId) {
      const [booking] = await db
        .select({ protectionPlanDeclined: bookingsTable.protectionPlanDeclined })
        .from(bookingsTable)
        .where(eq(bookingsTable.id, Number(bookingId)))
        .limit(1);
      if (booking?.protectionPlanDeclined) {
        return res.status(403).json({
          error: "claim_not_eligible",
          message: "This booking is not eligible for an OutdoorShare protection claim. The protection plan was declined at checkout. The renter acknowledged responsibility for any damage or loss per the signed rental agreement.",
        });
      }
    }

    const now = new Date();
    const [created] = await db
      .insert(claimsTable)
      .values({
        tenantId: req.tenantId ?? null,
        bookingId: bookingId ?? null,
        listingId: listingId ?? null,
        customerName,
        customerEmail,
        type: type || "damage",
        description,
        claimedAmount: claimedAmount != null ? String(claimedAmount) : null,
        evidenceUrls: evidenceUrls ? JSON.stringify(evidenceUrls) : null,
        status: "open",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // ── Auto-capture security deposit to OutdoorShare platform account ──────────
    let depositCaptureIntentId: string | null = null;
    let depositCapturedAmountCents: number | null = null;
    let cardCharged = false;
    let cardChargedAmountCents: number | null = null;
    let cardChargeBlocked = false; // true when outside the 48-hour window

    if (created.bookingId) {
      try {
        const [booking] = await db
          .select({
            depositHoldIntentId: bookingsTable.depositHoldIntentId,
            depositHoldStatus: bookingsTable.depositHoldStatus,
            stripePaymentIntentId: bookingsTable.stripePaymentIntentId,
            endDate: bookingsTable.endDate,
            tenantId: bookingsTable.tenantId,
          })
          .from(bookingsTable)
          .where(eq(bookingsTable.id, created.bookingId))
          .limit(1);

        if (booking?.depositHoldIntentId && booking.depositHoldStatus === "authorized") {
          // ── Path 1: Capture existing deposit hold ──────────────────────────────
          const [tenant] = await db
            .select({ testMode: tenantsTable.testMode })
            .from(tenantsTable)
            .where(eq(tenantsTable.id, booking.tenantId!))
            .limit(1);

          const stripeClient = getStripeForTenant(!!tenant?.testMode);
          const captured = await stripeClient.paymentIntents.capture(booking.depositHoldIntentId);
          depositCaptureIntentId = captured.id;
          depositCapturedAmountCents = captured.amount_received ?? captured.amount;

          await db
            .update(bookingsTable)
            .set({ depositHoldStatus: "captured", updatedAt: new Date() })
            .where(eq(bookingsTable.id, created.bookingId));

          await db
            .update(claimsTable)
            .set({
              chargeMode: "deposit_capture",
              chargeStatus: "deposit_captured",
              chargedAmount: String((depositCapturedAmountCents ?? 0) / 100),
              stripeChargeRefs: JSON.stringify([captured.id]),
              updatedAt: new Date(),
            })
            .where(eq(claimsTable.id, created.id));

          req.log.info({ claimId: created.id, intentId: captured.id }, "Deposit auto-captured on claim submission");

        } else if (chargeCardOnFile && type === "policy_violation" && booking?.stripePaymentIntentId) {
          // ── Path 2: No deposit hold — charge card on file for policy violations ──
          // Enforce 48-hour window from booking end date.
          const endDateMs = new Date(booking.endDate + "T23:59:59").getTime();
          const windowDeadlineMs = endDateMs + 48 * 60 * 60 * 1000;

          if (Date.now() > windowDeadlineMs) {
            // Outside the 48-hour window — flag it but don't block the claim
            cardChargeBlocked = true;
            req.log.warn({ claimId: created.id }, "Card charge blocked: outside 48-hour return window");
          } else {
            const [tenant] = await db
              .select({ testMode: tenantsTable.testMode })
              .from(tenantsTable)
              .where(eq(tenantsTable.id, booking.tenantId!))
              .limit(1);

            const stripeClient = getStripeForTenant(!!tenant?.testMode);
            const originalPi = await stripeClient.paymentIntents.retrieve(booking.stripePaymentIntentId);

            if (originalPi.payment_method) {
              const chargeCents = claimedAmount != null ? Math.round(parseFloat(String(claimedAmount)) * 100) : null;
              if (chargeCents && chargeCents >= 50) {
                const chargePi = await stripeClient.paymentIntents.create({
                  amount: chargeCents,
                  currency: "usd",
                  customer: typeof originalPi.customer === "string"
                    ? originalPi.customer
                    : (originalPi.customer as any)?.id ?? undefined,
                  payment_method: String(originalPi.payment_method),
                  confirm: true,
                  off_session: true,
                  description: `Policy violation charge — Claim #${created.id}, Booking #${created.bookingId}`,
                  metadata: {
                    claim_id: String(created.id),
                    booking_id: String(created.bookingId),
                    type: "policy_violation_charge",
                  },
                });

                cardCharged = true;
                cardChargedAmountCents = chargePi.amount;

                await db
                  .update(claimsTable)
                  .set({
                    chargeMode: "card_on_file",
                    chargeStatus: "card_charged",
                    chargedAmount: String(chargePi.amount / 100),
                    stripeChargeRefs: JSON.stringify([chargePi.id]),
                    updatedAt: new Date(),
                  })
                  .where(eq(claimsTable.id, created.id));

                req.log.info({ claimId: created.id, intentId: chargePi.id }, "Card-on-file charged on policy violation claim");
              }
            }
          }
        }
      } catch (e: any) {
        req.log.warn({ err: e }, "Deposit/card charge failed (non-fatal) — claim still created");
      }
    }

    res.status(201).json({
      ...formatClaim(created),
      depositCaptured: !!depositCaptureIntentId,
      depositCapturedAmount: depositCapturedAmountCents != null ? depositCapturedAmountCents / 100 : null,
      cardCharged,
      cardChargedAmount: cardChargedAmountCents != null ? cardChargedAmountCents / 100 : null,
      cardChargeBlocked,
    });

    // Fire-and-forget email alert to superadmin
    (async () => {
      try {
        let companyName = "Unknown Company";
        let slug = "unknown";
        if (created.tenantId) {
          const [tenant] = await db
            .select({ name: tenantsTable.name, slug: tenantsTable.slug })
            .from(tenantsTable)
            .where(eq(tenantsTable.id, created.tenantId))
            .limit(1);
          if (tenant) { companyName = tenant.name; slug = tenant.slug; }
        }
        await sendClaimAlertEmail({
          claimId: created.id,
          customerName: created.customerName,
          customerEmail: created.customerEmail,
          type: created.type,
          description: created.description,
          claimedAmount: created.claimedAmount ? parseFloat(created.claimedAmount) : null,
          companyName,
          slug,
          bookingId: created.bookingId ?? null,
        });

        // Notify admin in-app (action required)
        if (created.tenantId) {
          await createNotification({
            tenantId: created.tenantId,
            targetType: "admin",
            type: "claim_submitted",
            title: "New claim submitted",
            body: `${created.customerName} submitted a ${created.type} claim${created.bookingId ? ` for booking #${created.bookingId}` : ""}: "${created.description.substring(0, 80)}${created.description.length > 80 ? "…" : ""}"`,
            actionUrl: "/claims",
            isActionRequired: true,
            relatedId: created.id,
          });
        }
      } catch (e) {
        req.log.warn({ err: e }, "Failed to send claim alert email (non-fatal)");
      }
    })();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create claim" });
  }
});

router.put("/claims/:id", async (req, res) => {
  try {
    const { status, adminNotes, settledAmount, claimedAmount, description, type, evidenceUrls } = req.body;

    const whereConditions = [eq(claimsTable.id, Number(req.params.id))];
    if (req.tenantId) whereConditions.push(eq(claimsTable.tenantId, req.tenantId));

    // Fetch current claim so we can detect status changes
    const [existing] = await db.select().from(claimsTable).where(and(...whereConditions));
    if (!existing) return res.status(404).json({ error: "Not found" });

    const [updated] = await db
      .update(claimsTable)
      .set({
        ...(status !== undefined && { status }),
        ...(adminNotes !== undefined && { adminNotes }),
        ...(settledAmount !== undefined && { settledAmount: settledAmount != null ? String(settledAmount) : null }),
        ...(claimedAmount !== undefined && { claimedAmount: claimedAmount != null ? String(claimedAmount) : null }),
        ...(description !== undefined && { description }),
        ...(type !== undefined && { type }),
        ...(evidenceUrls !== undefined && { evidenceUrls: evidenceUrls ? JSON.stringify(evidenceUrls) : null }),
        updatedAt: new Date(),
      })
      .where(and(...whereConditions))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(formatClaim(updated));

    // Fire-and-forget: alert super admin when a tenant changes a claim's status
    if (status && status !== existing.status && existing.tenantId) {
      (async () => {
        try {
          const [tenant] = await db
            .select({ name: tenantsTable.name, slug: tenantsTable.slug })
            .from(tenantsTable)
            .where(eq(tenantsTable.id, existing.tenantId!))
            .limit(1);
          await sendClaimStatusAlertEmail({
            claimId: existing.id,
            customerName: existing.customerName,
            customerEmail: existing.customerEmail,
            type: updated.type,
            oldStatus: existing.status,
            newStatus: status,
            companyName: tenant?.name ?? "Unknown Company",
            slug: tenant?.slug ?? "unknown",
            adminNotes: updated.adminNotes,
          });
        } catch (e) {
          req.log.warn({ err: e }, "Failed to send claim status alert email (non-fatal)");
        }
      })();
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update claim" });
  }
});

router.delete("/claims/:id", async (req, res) => {
  try {
    const whereConditions = [eq(claimsTable.id, Number(req.params.id))];
    if (req.tenantId) whereConditions.push(eq(claimsTable.tenantId, req.tenantId));
    await db.delete(claimsTable).where(and(...whereConditions));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete claim" });
  }
});

export default router;
