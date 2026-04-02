import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tenantsTable, bookingsTable, customersTable, listingsTable } from "@workspace/db/schema";
import { eq, desc, and, isNull, isNotNull } from "drizzle-orm";
import { stripe, getStripeForTenant, PLATFORM_FEE_PERCENT } from "../services/stripe";
import type { Request } from "express";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
function requireAdminAuth(req: Request, res: any, next: any) {
  if (!req.tenantId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

// ── Stripe Connect: start onboarding ─────────────────────────────────────────
router.post("/stripe/connect/onboard", requireAdminAuth, async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

    const isTestMode = !!tenant.testMode;
    const stripeClient = getStripeForTenant(isTestMode);

    let accountId = tenant.stripeAccountId;

    // Create a new Express account if one doesn't exist yet
    if (!accountId) {
      const account = await stripeClient.accounts.create({
        type: "express",
        email: tenant.email,
        metadata: { tenant_id: String(tenantId), tenant_slug: tenant.slug },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;
      await db.update(tenantsTable).set({
        stripeAccountId: account.id,
        stripeAccountStatus: "onboarding",
        updatedAt: new Date(),
      }).where(eq(tenantsTable.id, tenantId));
    }

    const protocol = req.headers["x-forwarded-proto"] ?? "https";
    const host = req.get("host");
    const baseUrl = `${protocol}://${host}`;

    const link = await stripeClient.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/${tenant.slug}/admin/settings?stripe=refresh`,
      return_url: `${baseUrl}/${tenant.slug}/admin/settings?stripe=success`,
      type: "account_onboarding",
    });

    res.json({ url: link.url, testMode: isTestMode });
  } catch (e: any) {
    console.error("[stripe/connect/onboard]", e.message);
    res.status(500).json({ error: e.message || "Failed to start onboarding" });
  }
});

// ── Stripe Connect: get account status ───────────────────────────────────────
router.get("/stripe/connect/status", requireAdminAuth, async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    if (!tenant.stripeAccountId) {
      res.json({ connected: false, testMode: !!tenant.testMode });
      return;
    }

    const stripeClient = getStripeForTenant(!!tenant.testMode);
    const account = await stripeClient.accounts.retrieve(tenant.stripeAccountId);
    const chargesEnabled = account.charges_enabled;
    const payoutsEnabled = account.payouts_enabled;

    await db.update(tenantsTable).set({
      stripeChargesEnabled: chargesEnabled,
      stripePayoutsEnabled: payoutsEnabled,
      stripeAccountStatus: chargesEnabled ? "active" : "onboarding",
      updatedAt: new Date(),
    }).where(eq(tenantsTable.id, tenantId));

    res.json({
      connected: true,
      accountId: tenant.stripeAccountId,
      chargesEnabled,
      payoutsEnabled,
      detailsSubmitted: account.details_submitted,
    });
  } catch (e: any) {
    console.error("[stripe/connect/status]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Stripe Connect: generate express dashboard link ───────────────────────────
router.post("/stripe/connect/dashboard", requireAdminAuth, async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    if (!tenant?.stripeAccountId) { res.status(400).json({ error: "No Stripe account connected" }); return; }
    const stripeClient = getStripeForTenant(!!tenant.testMode);
    const link = await stripeClient.accounts.createLoginLink(tenant.stripeAccountId);
    res.json({ url: link.url });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Wallet: balance + payouts + transaction breakdown ─────────────────────────
router.get("/stripe/wallet", requireAdminAuth, async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

    const isTestMode = !!tenant.testMode;
    const walletStripe = getStripeForTenant(isTestMode);
    const feePercent = parseFloat(tenant.platformFeePercent ?? String(PLATFORM_FEE_PERCENT * 100));

    // Fetch bookings with listing titles
    const bookings = await db
      .select({
        id: bookingsTable.id,
        customerName: bookingsTable.customerName,
        startDate: bookingsTable.startDate,
        endDate: bookingsTable.endDate,
        totalPrice: bookingsTable.totalPrice,
        stripePlatformFee: bookingsTable.stripePlatformFee,
        stripePaymentStatus: bookingsTable.stripePaymentStatus,
        status: bookingsTable.status,
        createdAt: bookingsTable.createdAt,
        listingTitle: listingsTable.title,
      })
      .from(bookingsTable)
      .leftJoin(listingsTable, eq(bookingsTable.listingId, listingsTable.id))
      .where(and(eq(bookingsTable.tenantId, tenantId), eq(bookingsTable.stripePaymentStatus, "paid")))
      .orderBy(desc(bookingsTable.createdAt))
      .limit(50);

    const transactions = bookings.map(b => {
      const gross = parseFloat(b.totalPrice ?? "0");
      const fee = b.stripePlatformFee != null ? parseFloat(b.stripePlatformFee) : gross * (feePercent / 100);
      const net = gross - fee;
      return {
        id: b.id,
        customerName: b.customerName,
        listingTitle: b.listingTitle ?? "Unknown listing",
        startDate: b.startDate,
        endDate: b.endDate,
        gross,
        platformFee: parseFloat(fee.toFixed(2)),
        net: parseFloat(net.toFixed(2)),
        status: b.status,
        createdAt: b.createdAt.toISOString(),
      };
    });

    // No Stripe account yet — return just DB transactions
    if (!tenant.stripeAccountId) {
      return res.json({
        connected: false,
        testMode: isTestMode,
        balance: null,
        payouts: [],
        transactions,
        feePercent,
      });
    }

    // Fetch Stripe balance + recent payouts
    const [balance, payoutsResp] = await Promise.all([
      walletStripe.balance.retrieve({ stripeAccount: tenant.stripeAccountId }),
      walletStripe.payouts.list({ limit: 20 }, { stripeAccount: tenant.stripeAccountId }),
    ]);

    const available = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
    const pending = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100;

    const payouts = payoutsResp.data.map(p => ({
      id: p.id,
      amount: p.amount / 100,
      currency: p.currency.toUpperCase(),
      status: p.status,
      arrivalDate: new Date(p.arrival_date * 1000).toISOString(),
      description: p.description,
    }));

    res.json({ connected: true, testMode: isTestMode, balance: { available, pending, currency: balance.available[0]?.currency?.toUpperCase() ?? "USD" }, payouts, transactions, feePercent });
  } catch (e: any) {
    console.error("[stripe/wallet]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Connect: public readiness check ──────────────────────────────────────────
// Payments are always accepted (funds held on platform if tenant not connected)
router.get("/stripe/connect/check/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug));
    if (!tenant) { res.status(404).json({ ready: false, reason: "tenant_not_found" }); return; }
    // Always ready — OutdoorShare platform Stripe is always available
    const tenantConnected = !!(tenant.stripeAccountId && tenant.stripeChargesEnabled);
    res.json({ ready: true, tenantConnected, reason: "ok" });
  } catch (e: any) {
    res.status(500).json({ ready: false, reason: "error" });
  }
});

// ── Payment Intent: create for a booking ─────────────────────────────────────
// If tenant has Connect → funds route to their account automatically.
// If tenant has NOT connected → funds sit on OutdoorShare platform until they do.
router.post("/stripe/payment-intent", async (req, res) => {
  try {
    const { tenantSlug, amountCents, customerEmail, customerName, bookingMeta } = req.body ?? {};
    console.log(`[payment-intent] slug="${tenantSlug}" amount=${amountCents} body-keys=${Object.keys(req.body ?? {}).join(",")}`);
    if (!tenantSlug || !amountCents || amountCents < 50) {
      res.status(400).json({ error: "tenantSlug and amountCents (min 50) required" });
      return;
    }

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
    if (!tenant) {
      console.error(`[payment-intent] No tenant for slug="${tenantSlug}"`);
      res.status(404).json({ error: "Tenant not found" }); return;
    }

    const isTestMode = !!tenant.testMode;
    const stripeClient = getStripeForTenant(isTestMode);

    const feePercent = tenant.platformFeePercent != null
      ? parseFloat(tenant.platformFeePercent) / 100
      : PLATFORM_FEE_PERCENT;
    const platformFeeAmount = Math.round(amountCents * feePercent);
    const transferAmount = amountCents - platformFeeAmount;

    // In test mode, don't route to tenant's connected account (test ≠ live accounts)
    const tenantConnected = !isTestMode && !!(tenant.stripeAccountId && tenant.stripeChargesEnabled);

    // Build payment intent — only route to tenant's account if they're connected
    const intentParams: any = {
      amount: amountCents,
      currency: "usd",
      receipt_email: customerEmail,
      // Save the payment method for future off-session use (required for deposit hold/charge at pickup)
      setup_future_usage: "off_session",
      description: `Rental booking — ${tenant.name}${isTestMode ? " [TEST MODE]" : ""}`,
      metadata: {
        tenant_id: String(tenant.id),
        tenant_slug: tenantSlug,
        customer_name: customerName ?? "",
        platform_fee_cents: String(platformFeeAmount),
        transfer_amount_cents: String(transferAmount),
        test_mode: isTestMode ? "true" : "false",
        ...(bookingMeta ?? {}),
      },
    };

    if (tenantConnected) {
      // Funds go directly to tenant; platform keeps its fee
      intentParams.transfer_data = { destination: tenant.stripeAccountId, amount: transferAmount };
      intentParams.application_fee_amount = platformFeeAmount;
    }
    // Otherwise: full amount held on platform, swept later via sweep-pending

    const intent = await stripeClient.paymentIntents.create(intentParams);

    res.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      platformFee: (platformFeeAmount / 100).toFixed(2),
      heldOnPlatform: !tenantConnected,
      testMode: isTestMode,
      stripePublishableKey: isTestMode
        ? (process.env.STRIPE_TEST_PUBLISHABLE_KEY ?? "")
        : (process.env.STRIPE_PUBLISHABLE_KEY ?? ""),
    });
  } catch (e: any) {
    console.error("[stripe/payment-intent]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Sweep pending payouts to a newly-connected tenant ─────────────────────────
// Finds all paid bookings with funds held on platform and transfers owed amount.
async function sweepPendingPayouts(tenantId: number): Promise<{ swept: number; totalCents: number }> {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant?.stripeAccountId || !tenant.stripeChargesEnabled) return { swept: 0, totalCents: 0 };
  const sweepStripe = getStripeForTenant(!!tenant.testMode);

  // Bookings paid to platform but not yet transferred to tenant
  const pending = await db.select().from(bookingsTable).where(
    and(
      eq(bookingsTable.tenantId, tenantId),
      eq(bookingsTable.stripePaymentStatus, "paid"),
      isNotNull(bookingsTable.stripePaymentIntentId),
      isNull(bookingsTable.stripeTransferId),
    )
  );

  const feePercent = tenant.platformFeePercent != null
    ? parseFloat(tenant.platformFeePercent) / 100
    : PLATFORM_FEE_PERCENT;

  let swept = 0;
  let totalCents = 0;

  for (const booking of pending) {
    // Check if this PI originally had transfer_data (already routed to tenant) by checking metadata
    try {
      const pi = await sweepStripe.paymentIntents.retrieve(booking.stripePaymentIntentId!);
      // If transfer_data was set on the original PI, funds already went to tenant — mark as transferred
      if ((pi as any).transfer_data?.destination) {
        await db.update(bookingsTable).set({
          stripeTransferId: "via_destination",
          stripeTransferredAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(bookingsTable.id, booking.id));
        continue;
      }
      // Funds are on platform — calculate and sweep
      const totalCentsForBooking = Math.round(parseFloat(booking.totalPrice) * 100);
      const platformFee = Math.round(totalCentsForBooking * feePercent);
      const transferAmt = totalCentsForBooking - platformFee;
      if (transferAmt < 50) continue; // Stripe minimum

      const transfer = await sweepStripe.transfers.create({
        amount: transferAmt,
        currency: "usd",
        destination: tenant.stripeAccountId,
        source_transaction: (pi.latest_charge as string) || undefined,
        metadata: {
          booking_id: String(booking.id),
          tenant_id: String(tenantId),
          type: "platform_payout",
        },
        description: `Payout for booking #${booking.id} — ${tenant.name}`,
      });

      await db.update(bookingsTable).set({
        stripeTransferId: transfer.id,
        stripeTransferredAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(bookingsTable.id, booking.id));

      swept++;
      totalCents += transferAmt;
    } catch (err: any) {
      console.error(`[sweep] booking ${booking.id} failed:`, err.message);
    }
  }

  return { swept, totalCents };
}

// POST /stripe/connect/sweep-pending — manually trigger payout sweep (admin)
router.post("/stripe/connect/sweep-pending", requireAdminAuth, async (req, res) => {
  try {
    const result = await sweepPendingPayouts(req.tenantId!);
    res.json({ ...result, message: result.swept > 0 ? `Swept ${result.swept} booking(s) totalling $${(result.totalCents / 100).toFixed(2)}` : "No pending payouts to sweep" });
  } catch (e: any) {
    console.error("[stripe/sweep-pending]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Identity: create verification session ────────────────────────────────────
router.post("/stripe/identity/session", async (req, res) => {
  try {
    const { tenantSlug, customerId, returnUrl } = req.body;
    if (!tenantSlug) { res.status(400).json({ error: "tenantSlug required" }); return; }

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
    const isTestMode = !!(tenant?.testMode);

    const createSession = async (stripeClient: any) => {
      return stripeClient.identity.verificationSessions.create({
        type: "document",
        metadata: {
          tenant_slug: tenantSlug,
          customer_id: customerId ? String(customerId) : undefined,
        },
        options: {
          document: {
            allowed_types: ["driving_license", "passport", "id_card"],
            require_id_number: false,
            require_live_capture: true,
            require_matching_selfie: true,
          },
        },
        return_url: returnUrl ?? undefined,
      });
    };

    let session: any;
    let usedTestMode = isTestMode;

    try {
      session = await createSession(getStripeForTenant(isTestMode));
    } catch (primaryErr: any) {
      // If live key lacks Identity permissions (restricted key without identity scope),
      // automatically fall back to the test Stripe client so verification still works.
      const isPermissionError =
        primaryErr?.code === "permission_error" ||
        primaryErr?.type === "StripePermissionError" ||
        (primaryErr?.message ?? "").includes("rak_identity_product_write");

      if (!isTestMode && isPermissionError) {
        console.warn("[stripe/identity/session] Live key missing identity permission — falling back to test mode");
        session = await createSession(getStripeForTenant(true));
        usedTestMode = true;
      } else {
        throw primaryErr;
      }
    }

    // Store pending session on customer if id provided
    if (customerId) {
      await db.update(customersTable).set({
        identityVerificationStatus: "pending",
        identityVerificationSessionId: session.id,
        updatedAt: new Date(),
      }).where(eq(customersTable.id, customerId));
    }

    res.json({
      sessionId: session.id,
      url: session.url,
      clientSecret: session.client_secret,
      testMode: usedTestMode,
    });
  } catch (e: any) {
    console.error("[stripe/identity/session]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Identity: check verification status ──────────────────────────────────────
router.get("/stripe/identity/status/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const tenantSlug = req.query.tenantSlug as string | undefined;
    let testMode = false;
    if (tenantSlug) {
      const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
      testMode = !!(tenant?.testMode);
    }
    const stripeClient = getStripeForTenant(testMode);
    const session = await (stripeClient as any).identity.verificationSessions.retrieve(sessionId);
    const verified = session.status === "verified";

    // Update customer record if we can find them
    const [customer] = await db.select().from(customersTable)
      .where(eq(customersTable.identityVerificationSessionId, sessionId));

    if (customer) {
      await db.update(customersTable).set({
        identityVerificationStatus: verified ? "verified" : session.status === "requires_input" ? "failed" : "pending",
        identityVerifiedAt: verified ? new Date() : null,
        updatedAt: new Date(),
      }).where(eq(customersTable.id, customer.id));
    }

    res.json({ status: session.status, verified });
  } catch (e: any) {
    console.error("[stripe/identity/status]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Webhook ───────────────────────────────────────────────────────────────────
router.post("/stripe/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: any;

  if (webhookSecret && sig) {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (e: any) {
      console.error("[stripe/webhook] Signature failed:", e.message);
      res.status(400).json({ error: "Invalid signature" });
      return;
    }
  } else {
    event = req.body;
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        await db.update(bookingsTable).set({
          stripePaymentStatus: "paid",
          updatedAt: new Date(),
        }).where(eq(bookingsTable.stripePaymentIntentId, pi.id));
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        await db.update(bookingsTable).set({
          stripePaymentStatus: "failed",
          updatedAt: new Date(),
        }).where(eq(bookingsTable.stripePaymentIntentId, pi.id));
        break;
      }
      case "account.updated": {
        const account = event.data.object;
        const meta = account.metadata as Record<string, string> | undefined;
        if (meta?.tenant_id) {
          const tenantId = parseInt(meta.tenant_id);
          const [prevTenant] = await db.select({ stripeChargesEnabled: tenantsTable.stripeChargesEnabled })
            .from(tenantsTable).where(eq(tenantsTable.id, tenantId));
          await db.update(tenantsTable).set({
            stripeChargesEnabled: account.charges_enabled,
            stripePayoutsEnabled: account.payouts_enabled,
            stripeAccountStatus: account.charges_enabled ? "active" : "onboarding",
            updatedAt: new Date(),
          }).where(eq(tenantsTable.id, tenantId));
          // Auto-sweep held funds when tenant first becomes active
          if (account.charges_enabled && !prevTenant?.stripeChargesEnabled) {
            sweepPendingPayouts(tenantId).then(r => {
              if (r.swept > 0) console.log(`[webhook] Auto-swept ${r.swept} bookings ($${(r.totalCents/100).toFixed(2)}) to tenant ${tenantId}`);
            }).catch(err => console.error("[webhook] sweep failed:", err.message));
          }
        }
        break;
      }
      case "identity.verification_session.verified": {
        const session = event.data.object;
        await db.update(customersTable).set({
          identityVerificationStatus: "verified",
          identityVerifiedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(customersTable.identityVerificationSessionId, session.id));
        break;
      }
      case "identity.verification_session.requires_input": {
        const session = event.data.object;
        await db.update(customersTable).set({
          identityVerificationStatus: "failed",
          updatedAt: new Date(),
        }).where(eq(customersTable.identityVerificationSessionId, session.id));
        break;
      }
    }

    res.json({ received: true });
  } catch (e: any) {
    console.error("[stripe/webhook] Handler error:", e.message);
    res.status(500).json({ error: "Webhook handler failed" });
  }
});

// ── Checkout QR: create a Stripe Checkout Session (phone pay via QR) ──────────
router.post("/stripe/checkout-qr", async (req, res) => {
  try {
    const { tenantSlug, amountCents, customerEmail, customerName, listingTitle } = req.body ?? {};
    console.log(`[checkout-qr] slug="${tenantSlug}" amount=${amountCents}`);
    if (!tenantSlug || !amountCents || amountCents < 50) {
      res.status(400).json({ error: "tenantSlug and amountCents (min 50) required" });
      return;
    }

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
    if (!tenant) {
      console.error(`[checkout-qr] No tenant for slug="${tenantSlug}"`);
      res.status(404).json({ error: "Tenant not found" }); return;
    }

    const isTestMode = !!tenant.testMode;
    const stripeClient = getStripeForTenant(isTestMode);

    const feePercent = tenant.platformFeePercent != null
      ? parseFloat(tenant.platformFeePercent) / 100
      : PLATFORM_FEE_PERCENT;
    const platformFeeAmount = Math.round(amountCents * feePercent);
    const transferAmount = amountCents - platformFeeAmount;
    const tenantConnected = !isTestMode && !!(tenant.stripeAccountId && tenant.stripeChargesEnabled);

    const protocol = req.headers["x-forwarded-proto"] ?? "https";
    const host = req.get("host");
    const baseUrl = `${protocol}://${host}`;

    const sessionParams: any = {
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: listingTitle || "Rental Booking",
            description: `Rental with ${tenant.name}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      customer_email: customerEmail || undefined,
      success_url: `${baseUrl}/${tenantSlug}?qr_payment=success`,
      cancel_url:  `${baseUrl}/${tenantSlug}?qr_payment=cancel`,
      metadata: {
        tenant_id: String(tenant.id),
        tenant_slug: tenantSlug,
        customer_name: customerName ?? "",
        test_mode: isTestMode ? "true" : "false",
      },
    };

    if (tenantConnected) {
      sessionParams.payment_intent_data = {
        transfer_data: { destination: tenant.stripeAccountId, amount: transferAmount },
        application_fee_amount: platformFeeAmount,
      };
    }

    const session = await stripeClient.checkout.sessions.create(sessionParams);

    res.json({
      sessionId: session.id,
      url: session.url,
      testMode: isTestMode,
    });
  } catch (e: any) {
    console.error("[stripe/checkout-qr]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Checkout QR: poll a session's payment status ──────────────────────────────
router.get("/stripe/checkout-qr/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const tenantSlug = (req.query.tenantSlug as string)
      || (req.headers["x-tenant-slug"] as string)
      || "";

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
    const isTestMode = !!tenant?.testMode;
    const stripeClient = getStripeForTenant(isTestMode);

    const session = await stripeClient.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.payment_method"],
    });

    const pi = session.payment_intent as any;
    const pm = pi?.payment_method;

    // Resolve human-readable wallet label
    let paymentMethodLabel: string | null = null;
    if (pm) {
      const walletType = pm.card?.wallet?.type;
      if (walletType === "apple_pay") paymentMethodLabel = "Apple Pay";
      else if (walletType === "google_pay") paymentMethodLabel = "Google Pay";
      else if (pm.type === "card") paymentMethodLabel = "Card";
      else paymentMethodLabel = pm.type ?? "Payment";
    }

    res.json({
      status: session.status,
      paymentStatus: session.payment_status,
      paymentIntentId: pi?.id ?? null,
      paymentMethodLabel,
    });
  } catch (e: any) {
    console.error("[stripe/checkout-qr/status]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Security Deposit: authorize hold (or full charge for 5+ day bookings) ─────
router.post("/bookings/:id/deposit/authorize", requireAdminAuth, async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    const tenantId = req.tenantId!;

    const [booking] = await db.select().from(bookingsTable)
      .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.tenantId, tenantId)));
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
    if (!booking.stripePaymentIntentId) {
      res.status(400).json({ error: "No payment on file for this booking" }); return;
    }

    const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, booking.listingId));
    const depositAmountCents = listing?.depositAmount
      ? Math.round(parseFloat(String(listing.depositAmount)) * 100) : 0;
    if (depositAmountCents < 50) {
      res.status(400).json({ error: "No deposit amount configured on this listing" }); return;
    }

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    const stripeClient = getStripeForTenant(!!tenant.testMode);

    const originalPi = await stripeClient.paymentIntents.retrieve(booking.stripePaymentIntentId);
    if (!originalPi.payment_method) {
      res.status(400).json({ error: "No saved payment method on this booking. The card was not saved for future use." }); return;
    }

    // Bookings of 5+ days get a full charge instead of an authorized hold
    const startMs = new Date(booking.startDate).getTime();
    const endMs   = new Date(booking.endDate).getTime();
    const rentalDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
    const isLongBooking = rentalDays >= 5;

    const depositPi = await stripeClient.paymentIntents.create({
      amount: depositAmountCents,
      currency: "usd",
      payment_method: String(originalPi.payment_method),
      ...(isLongBooking
        ? { capture_method: "automatic" }          // full charge — funds captured immediately
        : { capture_method: "manual" }),            // hold — only captured on damage/claim
      confirm: true,
      off_session: true,
      description: isLongBooking
        ? `Security deposit (full charge, ${rentalDays}-day rental) — Booking #${bookingId} (${listing?.title ?? ""})`
        : `Security deposit hold — Booking #${bookingId} (${listing?.title ?? ""})`,
      metadata: {
        booking_id: String(bookingId),
        tenant_id: String(tenantId),
        type: isLongBooking ? "deposit_charge" : "deposit_hold",
        rental_days: String(rentalDays),
      },
    });

    const newStatus = isLongBooking ? "charged" : "authorized";

    await db.update(bookingsTable)
      .set({ depositHoldIntentId: depositPi.id, depositHoldStatus: newStatus, updatedAt: new Date() })
      .where(eq(bookingsTable.id, bookingId));

    res.json({
      depositHoldIntentId: depositPi.id,
      depositHoldStatus: newStatus,
      amountCents: depositAmountCents,
      isFullCharge: isLongBooking,
      rentalDays,
    });
  } catch (e: any) {
    console.error("[deposit/authorize]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Security Deposit: release hold ───────────────────────────────────────────
router.post("/bookings/:id/deposit/release", requireAdminAuth, async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    const tenantId = req.tenantId!;

    const [booking] = await db.select().from(bookingsTable)
      .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.tenantId, tenantId)));
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
    if (!booking.depositHoldIntentId) {
      res.status(400).json({ error: "No deposit hold on this booking" }); return;
    }

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    const stripeClient = getStripeForTenant(!!tenant?.testMode);

    await stripeClient.paymentIntents.cancel(booking.depositHoldIntentId);

    await db.update(bookingsTable)
      .set({ depositHoldStatus: "released", updatedAt: new Date() })
      .where(eq(bookingsTable.id, bookingId));

    res.json({ depositHoldStatus: "released" });
  } catch (e: any) {
    console.error("[deposit/release]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Security Deposit: capture (damage claim) ─────────────────────────────────
router.post("/bookings/:id/deposit/capture", requireAdminAuth, async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    const tenantId = req.tenantId!;

    const [booking] = await db.select().from(bookingsTable)
      .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.tenantId, tenantId)));
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
    if (!booking.depositHoldIntentId) {
      res.status(400).json({ error: "No deposit hold on this booking" }); return;
    }

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    const stripeClient = getStripeForTenant(!!tenant?.testMode);

    await stripeClient.paymentIntents.capture(booking.depositHoldIntentId);

    await db.update(bookingsTable)
      .set({ depositHoldStatus: "captured", updatedAt: new Date() })
      .where(eq(bookingsTable.id, bookingId));

    res.json({ depositHoldStatus: "captured" });
  } catch (e: any) {
    console.error("[deposit/capture]", e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
