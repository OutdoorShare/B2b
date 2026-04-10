import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tenantsTable, bookingsTable, customersTable, listingsTable, businessProfileTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { stripe, getStripeForTenant, PLATFORM_FEE_PERCENT } from "../services/stripe";
import { sendStripeRestrictedAlertEmail, sendPaymentRequestEmail, sendPaymentFailedRenterEmail, sendPaymentFailedAdminEmail } from "../services/gmail";
import { triggerAvailablePayout, sweepPendingPayouts } from "../services/payouts";
import type { Request } from "express";

const router: IRouter = Router();

// ── Auth helper ───────────────────────────────────────────────────────────────
function requireAdminAuth(req: Request, res: any, next: any) {
  if (!req.tenantId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

// ── Payout helpers ────────────────────────────────────────────────────────────

/** Set a connected account's payout schedule to daily with the minimum allowed delay. */
async function setDailyPayoutSchedule(stripeClient: any, accountId: string): Promise<void> {
  try {
    await stripeClient.accounts.update(accountId, {
      settings: {
        payouts: {
          schedule: {
            interval: "daily",
            delay_days: "minimum",
          },
        },
      },
    });
    console.log(`[payout-schedule] Set daily/minimum schedule for ${accountId}`);
  } catch (e: any) {
    // Non-fatal — log but don't block the caller
    console.error(`[payout-schedule] Could not set schedule for ${accountId}: ${e.message}`);
  }
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
      // Set daily payout schedule immediately on account creation
      setDailyPayoutSchedule(stripeClient, account.id);
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
      .where(and(eq(bookingsTable.tenantId, tenantId), or(eq(bookingsTable.stripePaymentStatus, "paid"), eq(bookingsTable.stripePaymentStatus, "succeeded"))))
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
    const { tenantSlug, amountCents, customerEmail, customerName, bookingMeta, customerId, protectionFeeCents, passthroughFeeCents, customFeesCents } = req.body ?? {};
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

    // Custom fees platform charge: if custom fees total > $100, OutdoorShare keeps 3% of them.
    const CUSTOM_FEE_THRESHOLD_CENTS = 10000; // $100 in cents
    const customFeeChargeCents = (customFeesCents != null && customFeesCents > CUSTOM_FEE_THRESHOLD_CENTS)
      ? Math.round(customFeesCents * 0.03)
      : 0;

    // Determine platform fee.
    //
    // feePercent applies ONLY to the pure rental base (daily/hourly rate × days +
    // bundle items + addons, after discounts). Every other component is excluded:
    //   • Protection plan   → kept 100% by OutdoorShare
    //   • Custom fees       → flow 100% to the tenant (delivery, etc.)
    //   • Custom fee charge → kept 100% by OutdoorShare (3% on custom fees > $100)
    //   • Passthrough fee   → collected from customer, flows 100% to tenant
    //
    // amountCents already includes all of these components (sent by the frontend).
    const ppCents         = protectionFeeCents  != null && protectionFeeCents  > 0 ? Math.round(protectionFeeCents)  : 0;
    const customSubtotal  = customFeesCents      != null && customFeesCents      > 0 ? Math.round(customFeesCents)      : 0;
    const passthroughCents = passthroughFeeCents != null && passthroughFeeCents > 0 ? Math.round(passthroughFeeCents) : 0;

    // Rental base: everything that should be subject to the platform percentage
    const rentalBase = Math.max(0, amountCents - ppCents - customSubtotal - customFeeChargeCents - passthroughCents);

    const platformFeeAmount = Math.round(rentalBase * feePercent) + ppCents + customFeeChargeCents;
    const transferAmount    = amountCents - platformFeeAmount;

    // In test mode, don't route to tenant's connected account (test ≠ live accounts)
    const tenantConnected = !isTestMode && !!(tenant.stripeAccountId && tenant.stripeChargesEnabled);

    // Lookup instant booking setting — determines whether to authorize-only or capture immediately
    const [bizProfile] = await db.select({ instantBooking: businessProfileTable.instantBooking })
      .from(businessProfileTable)
      .where(eq(businessProfileTable.tenantId, tenant.id));
    const instantBooking = bizProfile?.instantBooking ?? false;

    // ── Attach or create a Stripe Customer so the card is saved for future use ──
    let stripeCustomerId: string | undefined;
    // Keep a reference so we can recreate the customer on stale-ID errors below
    let dbCustomerRef: { id: number; email: string; name: string | null } | undefined;

    if (customerId) {
      const [dbCustomer] = await db
        .select({ id: customersTable.id, email: customersTable.email, name: customersTable.name, stripeCustomerId: customersTable.stripeCustomerId })
        .from(customersTable)
        .where(eq(customersTable.id, Number(customerId)))
        .limit(1);

      if (dbCustomer) {
        dbCustomerRef = { id: dbCustomer.id, email: dbCustomer.email, name: dbCustomer.name };
        if (dbCustomer.stripeCustomerId) {
          stripeCustomerId = dbCustomer.stripeCustomerId;
        } else {
          // Create a Stripe Customer for this renter and persist the ID
          const sc = await stripeClient.customers.create({
            email: dbCustomer.email,
            name: dbCustomer.name ?? undefined,
            metadata: { platform_customer_id: String(dbCustomer.id) },
          });
          stripeCustomerId = sc.id;
          await db
            .update(customersTable)
            .set({ stripeCustomerId: sc.id, updatedAt: new Date() })
            .where(eq(customersTable.id, dbCustomer.id));
        }
      }
    }

    // Build payment intent — only route to tenant's account if they're connected
    const intentParams: any = {
      amount: amountCents,
      currency: "usd",
      receipt_email: (customerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) ? customerEmail : undefined,
      // Enable all available payment methods (Apple Pay, Google Pay, cards, etc.)
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      // Save cards for future off-session use (deposit hold/charge at pickup).
      // Scoped to card only so Apple Pay / Google Pay can still appear.
      payment_method_options: {
        card: { setup_future_usage: "off_session" },
      },
      // Non-instant bookings: authorize only — capture when admin confirms
      ...(!instantBooking ? { capture_method: "manual" } : {}),
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

    if (stripeCustomerId) intentParams.customer = stripeCustomerId;

    if (tenantConnected) {
      // Funds go directly to tenant; platform keeps its fee
      intentParams.transfer_data = { destination: tenant.stripeAccountId };
      intentParams.application_fee_amount = platformFeeAmount;
    }
    // Otherwise: full amount held on platform, swept later via sweep-pending

    let intent;
    try {
      intent = await stripeClient.paymentIntents.create(intentParams);
    } catch (piErr: any) {
      // Stale customer ID — happens when the Stripe mode changed (test ↔ live)
      // or the connected account was reset. Create a fresh customer and retry once.
      if (
        piErr?.code === "resource_missing" &&
        piErr?.message?.toLowerCase().includes("customer") &&
        dbCustomerRef
      ) {
        console.warn("[stripe/payment-intent] Stale customer ID — recreating customer for db_id", dbCustomerRef.id);
        const sc = await stripeClient.customers.create({
          email: dbCustomerRef.email,
          name: dbCustomerRef.name ?? undefined,
          metadata: { platform_customer_id: String(dbCustomerRef.id) },
        });
        // Persist the new ID so future requests don't hit this again
        await db
          .update(customersTable)
          .set({ stripeCustomerId: sc.id, updatedAt: new Date() })
          .where(eq(customersTable.id, dbCustomerRef.id));
        intentParams.customer = sc.id;
        intent = await stripeClient.paymentIntents.create(intentParams);
      } else {
        throw piErr;
      }
    }

    // Create a Customer Session so the PaymentElement can display the customer's saved cards.
    // Non-fatal — if this fails the payment still works, just without the saved-card UI.
    let customerSessionClientSecret: string | null = null;
    if (stripeCustomerId) {
      try {
        const cs = await stripeClient.customerSessions.create({
          customer: stripeCustomerId,
          components: {
            payment_element: {
              enabled: true,
              features: {
                payment_method_redisplay: "enabled",
                payment_method_save: "enabled",
                payment_method_remove: "enabled",
              },
            },
          },
        });
        customerSessionClientSecret = cs.client_secret;
      } catch {
        // Non-fatal — continue without saved-card display
      }
    }

    res.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      customerSessionClientSecret,
      platformFee: (platformFeeAmount / 100).toFixed(2),
      heldOnPlatform: !tenantConnected,
      testMode: isTestMode,
      instantBooking,
      stripePublishableKey: isTestMode
        ? (process.env.STRIPE_TEST_PUBLISHABLE_KEY ?? "")
        : (process.env.STRIPE_PUBLISHABLE_KEY ?? ""),
    });
  } catch (e: any) {
    console.error("[stripe/payment-intent]", e.message);
    res.status(500).json({ error: e.message });
  }
});

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

// ── Identity: helper — is a slug always forced to test mode? ─────────────────
// Demo tenant + any testMode tenant should always use the test Stripe key.
const DEMO_SLUGS = new Set(["demo", "demo-outdoorshare"]);
function isIdentityTestMode(tenantSlug: string | undefined, tenantTestMode: boolean | null | undefined): boolean {
  if (tenantTestMode) return true;
  if (tenantSlug && DEMO_SLUGS.has(tenantSlug.toLowerCase())) return true;
  return false;
}
// Auto-detect from Stripe session ID prefix — more reliable than tenant lookup
function isTestSessionId(sessionId: string): boolean {
  return sessionId.startsWith("vs_test_") || sessionId.startsWith("isses_test_");
}

// ── Identity: create verification session ────────────────────────────────────
router.post("/stripe/identity/session", async (req, res) => {
  try {
    const { tenantSlug, customerId, returnUrl } = req.body;
    if (!tenantSlug) { res.status(400).json({ error: "tenantSlug required" }); return; }

    // If the customer is already verified, skip creating a new session
    if (customerId) {
      const [existing] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
      if (existing?.identityVerificationStatus === "verified") {
        res.json({ alreadyVerified: true });
        return;
      }
    }

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
    const isTestMode = isIdentityTestMode(tenantSlug, tenant?.testMode);

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
        // Live key lacks identity permission — skip verification gracefully rather
        // than falling back to test mode (which would show a "Test mode" banner to real customers).
        console.warn("[stripe/identity/session] Live key missing identity permission — skipping verification");
        res.json({ skip: true });
        return;
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

    // Primary: auto-detect from session ID prefix (most reliable)
    // Fallback: look up tenant testMode flag
    let testMode = isTestSessionId(sessionId);
    if (!testMode && tenantSlug) {
      const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
      testMode = isIdentityTestMode(tenantSlug, tenant?.testMode);
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

        // For PIs routed via transfer_data, funds land on the connected account automatically.
        // Trigger an immediate payout so the balance doesn't sit waiting for the default schedule.
        const tenantIdFromMeta = pi.metadata?.tenant_id ? parseInt(pi.metadata.tenant_id) : null;
        if (tenantIdFromMeta) {
          (async () => {
            try {
              const [t] = await db.select({ stripeAccountId: tenantsTable.stripeAccountId, testMode: tenantsTable.testMode })
                .from(tenantsTable).where(eq(tenantsTable.id, tenantIdFromMeta)).limit(1);
              if (t?.stripeAccountId) {
                const piStripe = getStripeForTenant(!!t.testMode);
                await triggerAvailablePayout(piStripe, t.stripeAccountId);
              }
            } catch (e: any) {
              console.error("[webhook] payment_intent payout trigger failed:", e.message);
            }
          })();
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        const [updatedBooking] = await db.update(bookingsTable).set({
          stripePaymentStatus: "failed",
          updatedAt: new Date(),
        }).where(eq(bookingsTable.stripePaymentIntentId, pi.id)).returning();

        // Send failure notifications — best-effort
        if (updatedBooking) {
          (async () => {
            try {
              const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, updatedBooking.tenantId));
              const [listing] = updatedBooking.listingId
                ? await db.select({ title: listingsTable.title }).from(listingsTable).where(eq(listingsTable.id, updatedBooking.listingId!))
                : [{ title: "Rental" }];
              const [brand] = await db.select({ logoUrl: businessProfileTable.logoUrl, primaryColor: businessProfileTable.primaryColor })
                .from(businessProfileTable).where(eq(businessProfileTable.tenantId, updatedBooking.tenantId));
              if (!tenant) return;

              const appUrl = process.env.APP_URL ?? "https://myoutdoorshare.com";
              const bookingUrl = `${appUrl}/${tenant.slug}/admin/bookings/${updatedBooking.id}`;
              const listingTitle = listing?.title ?? "Rental";

              await sendPaymentFailedRenterEmail({
                customerName: updatedBooking.customerName,
                customerEmail: updatedBooking.customerEmail,
                bookingId: updatedBooking.id,
                listingTitle,
                startDate: updatedBooking.startDate,
                endDate: updatedBooking.endDate,
                totalPrice: parseFloat(String(updatedBooking.totalPrice)),
                companyName: tenant.name,
                companyEmail: tenant.email ?? undefined,
                logoUrl: brand?.logoUrl ?? null,
                primaryColor: brand?.primaryColor ?? null,
              });

              await sendPaymentFailedAdminEmail({
                adminEmail: tenant.email,
                customerName: updatedBooking.customerName,
                customerEmail: updatedBooking.customerEmail,
                bookingId: updatedBooking.id,
                listingTitle,
                startDate: updatedBooking.startDate,
                endDate: updatedBooking.endDate,
                totalPrice: parseFloat(String(updatedBooking.totalPrice)),
                companyName: tenant.name,
                bookingUrl,
              });

              console.log(`[webhook] payment_intent.payment_failed → notified renter+admin for booking #${updatedBooking.id}`);
            } catch (emailErr: any) {
              console.warn("[webhook] payment_intent.payment_failed — email send failed:", emailErr.message);
            }
          })();
        }
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object;
        const bookingId = session.metadata?.booking_id;
        if (bookingId) {
          const piId = typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent as any)?.id ?? null;
          await db.update(bookingsTable).set({
            status: "confirmed",
            stripePaymentIntentId: piId ?? undefined,
            stripePaymentStatus: "paid",
            updatedAt: new Date(),
          }).where(eq(bookingsTable.id, Number(bookingId)));
          console.log(`[webhook] checkout.session.completed → booking #${bookingId} confirmed, pi=${piId}`);
        }
        break;
      }
      case "account.updated": {
        const account = event.data.object;
        const meta = account.metadata as Record<string, string> | undefined;
        if (meta?.tenant_id) {
          const tenantId = parseInt(meta.tenant_id);
          const [prevTenant] = await db.select({
            stripeChargesEnabled: tenantsTable.stripeChargesEnabled,
            stripeAccountStatus: tenantsTable.stripeAccountStatus,
            stripeRestrictedAlertSentAt: tenantsTable.stripeRestrictedAlertSentAt,
            email: tenantsTable.email,
            slug: tenantsTable.slug,
          }).from(tenantsTable).where(eq(tenantsTable.id, tenantId));

          // Determine the correct new status
          const disabledReason = (account.requirements?.disabled_reason as string | null | undefined) ?? null;
          const isNowRestricted = !account.charges_enabled && !!disabledReason;
          const newStatus = account.charges_enabled
            ? "active"
            : isNowRestricted
              ? "restricted"
              : "onboarding";

          await db.update(tenantsTable).set({
            stripeChargesEnabled: account.charges_enabled,
            stripePayoutsEnabled: account.payouts_enabled,
            stripeAccountStatus: newStatus,
            // Clear the alert timestamp when the account becomes active again
            ...(account.charges_enabled ? { stripeRestrictedAlertSentAt: null } : {}),
            updatedAt: new Date(),
          }).where(eq(tenantsTable.id, tenantId));

          // When account becomes active: set daily payout schedule, sweep held funds, then trigger payout
          if (account.charges_enabled) {
            const isTestMode = !!((await db.select({ testMode: tenantsTable.testMode })
              .from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1))[0]?.testMode);
            const tenantStripe = getStripeForTenant(isTestMode);
            // (Re-)apply daily payout schedule on every activation — handles re-connections too
            setDailyPayoutSchedule(tenantStripe, account.id);
            if (!prevTenant?.stripeChargesEnabled) {
              // First-time activation — sweep any held platform funds and trigger payout
              sweepPendingPayouts(tenantId).then(async r => {
                if (r.swept > 0) {
                  console.log(`[webhook] Auto-swept ${r.swept} bookings ($${(r.totalCents/100).toFixed(2)}) to tenant ${tenantId}`);
                  await triggerAvailablePayout(tenantStripe, account.id);
                }
              }).catch(err => console.error("[webhook] sweep failed:", err.message));
            }
          }

          // Fire restriction alert if account just became restricted (or is newly detected restricted)
          if (isNowRestricted && !account.charges_enabled) {
            const wasAlreadyRestricted = prevTenant?.stripeAccountStatus === "restricted";
            const alreadyAlerted = !!prevTenant?.stripeRestrictedAlertSentAt;
            if (!wasAlreadyRestricted || !alreadyAlerted) {
              // Fetch business name for personalised email
              const [biz] = await db.select({ name: businessProfileTable.name })
                .from(businessProfileTable).where(eq(businessProfileTable.tenantId, tenantId));
              const companyName = biz?.name ?? prevTenant?.slug ?? "Your Company";
              const adminEmail = prevTenant?.email;
              const tenantSlug = prevTenant?.slug ?? "";

              if (adminEmail && tenantSlug) {
                sendStripeRestrictedAlertEmail({
                  adminEmail,
                  companyName,
                  tenantSlug,
                  disabledReason,
                  isReminder: false,
                }).then(() => {
                  // Record that we sent the alert
                  db.update(tenantsTable).set({
                    stripeRestrictedAlertSentAt: new Date(),
                    updatedAt: new Date(),
                  }).where(eq(tenantsTable.id, tenantId)).catch(() => {});
                  console.log(`[webhook] Stripe restriction alert sent to ${adminEmail} (tenant ${tenantId})`);
                }).catch(err => console.error("[webhook] Stripe restriction alert failed:", err.message));
              }
            }
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
        transfer_data: { destination: tenant.stripeAccountId },
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

// ── Admin: create Stripe Checkout session + email payment link to renter ───────
router.post("/stripe/admin-payment-link", requireAdminAuth, async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { bookingId } = req.body ?? {};
    if (!bookingId) { res.status(400).json({ error: "bookingId required" }); return; }

    const [booking] = await db.select().from(bookingsTable).where(
      and(eq(bookingsTable.id, Number(bookingId)), eq(bookingsTable.tenantId, tenantId))
    );
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

    const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, booking.listingId));

    const isTestMode = !!tenant.testMode;
    const stripeClient = getStripeForTenant(isTestMode);

    const feePercent = tenant.platformFeePercent != null
      ? parseFloat(tenant.platformFeePercent) / 100
      : PLATFORM_FEE_PERCENT;
    const amountCents = Math.round(parseFloat(String(booking.totalPrice)) * 100);
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
            name: listing?.title || "Rental Booking",
            description: `Rental with ${tenant.name} · ${booking.startDate} to ${booking.endDate}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      customer_email: booking.customerEmail,
      success_url: `${baseUrl}/${tenant.slug}?payment_success=1`,
      cancel_url: `${baseUrl}/${tenant.slug}?payment_cancel=1`,
      payment_intent_data: {
        setup_future_usage: "off_session",
        description: `Booking #${booking.id} — ${tenant.name}${isTestMode ? " [TEST]" : ""}`,
        metadata: {
          tenant_id: String(tenantId),
          tenant_slug: tenant.slug,
          booking_id: String(booking.id),
          customer_name: booking.customerName,
          test_mode: isTestMode ? "true" : "false",
        },
      },
      metadata: {
        booking_id: String(booking.id),
        tenant_id: String(tenantId),
      },
    };

    if (tenantConnected) {
      sessionParams.payment_intent_data.transfer_data = { destination: tenant.stripeAccountId };
      sessionParams.payment_intent_data.application_fee_amount = platformFeeAmount;
    }

    const session = await stripeClient.checkout.sessions.create(sessionParams);

    // Mark booking as payment-link-sent
    await db.update(bookingsTable).set({
      stripePaymentStatus: "awaiting_payment",
      status: "pending",
      updatedAt: new Date(),
    }).where(eq(bookingsTable.id, booking.id));

    // Email the renter — best-effort
    try {
      await sendPaymentRequestEmail({
        toEmail: booking.customerEmail,
        customerName: booking.customerName,
        paymentUrl: session.url!,
        listingTitle: listing?.title || "Rental",
        startDate: booking.startDate,
        endDate: booking.endDate,
        totalPrice: parseFloat(String(booking.totalPrice)),
        companyName: tenant.name,
        companyEmail: tenant.email,
      });
    } catch (emailErr: any) {
      console.warn("[admin-payment-link] Email send failed:", emailErr.message);
    }

    res.json({ url: session.url, sessionId: session.id, testMode: isTestMode });
  } catch (e: any) {
    console.error("[stripe/admin-payment-link]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: charge a customer's saved card immediately (off-session) ────────────
router.post("/stripe/admin-charge-saved", requireAdminAuth, async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { bookingId, amountOverride } = req.body ?? {};
    if (!bookingId) { res.status(400).json({ error: "bookingId required" }); return; }

    const [booking] = await db.select().from(bookingsTable).where(
      and(eq(bookingsTable.id, Number(bookingId)), eq(bookingsTable.tenantId, tenantId))
    );
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

    // Look up saved card from customers table
    const [customer] = await db.select().from(customersTable).where(
      eq(customersTable.email, booking.customerEmail.toLowerCase())
    );
    if (!customer?.stripeCustomerId) {
      res.status(400).json({ error: "No saved payment method on file for this customer." }); return;
    }

    const isTestMode = !!tenant.testMode;
    const stripeClient = getStripeForTenant(isTestMode);

    // List saved payment methods and pick the most recently used card
    const pms = await stripeClient.paymentMethods.list({
      customer: customer.stripeCustomerId,
      type: "card",
    });
    if (!pms.data.length) {
      res.status(400).json({ error: "No saved card found for this customer in Stripe." }); return;
    }
    const pm = pms.data[0];

    const feePercent = tenant.platformFeePercent != null
      ? parseFloat(tenant.platformFeePercent) / 100
      : PLATFORM_FEE_PERCENT;
    // amountOverride lets admin charge a specific amount (e.g. deposit only) instead of total
    const baseAmount = amountOverride != null ? parseFloat(String(amountOverride)) : parseFloat(String(booking.totalPrice));
    const amountCents = Math.round(baseAmount * 100);
    const totalPriceCents = Math.round(parseFloat(String(booking.totalPrice ?? "0")) * 100);
    const ppFeeTotalCents = Math.round(parseFloat(String(booking.protectionPlanFee ?? "0")) * 100);
    // OutdoorShare keeps 100% of the protection fee — never split with the host.
    // When charging a partial amount (e.g. deposit), allocate the proportional
    // share of the protection fee to the platform and apply feePercent only to
    // the rental portion.
    let platformFeeAmount: number;
    if (tenant.isHost && ppFeeTotalCents > 0 && totalPriceCents > 0) {
      const proportion = Math.min(amountCents / totalPriceCents, 1);
      const ppFeeInCharge = Math.round(ppFeeTotalCents * proportion);
      const rentalInCharge = amountCents - ppFeeInCharge;
      platformFeeAmount = Math.round(rentalInCharge * feePercent) + ppFeeInCharge;
    } else {
      platformFeeAmount = Math.round(amountCents * feePercent);
    }
    const tenantConnected = !isTestMode && !!(tenant.stripeAccountId && tenant.stripeChargesEnabled);
    const isSplitDeposit = amountOverride != null && booking.paymentPlanEnabled;

    const intentParams: any = {
      amount: amountCents,
      currency: "usd",
      customer: customer.stripeCustomerId,
      payment_method: pm.id,
      confirm: true,
      off_session: true,
      description: `${isSplitDeposit ? "Deposit" : "Admin"} charge — Booking #${booking.id} — ${tenant.name}${isTestMode ? " [TEST]" : ""}`,
      metadata: {
        tenant_id: String(tenantId),
        tenant_slug: tenant.slug,
        booking_id: String(booking.id),
        customer_name: booking.customerName,
        test_mode: isTestMode ? "true" : "false",
      },
    };

    if (tenantConnected) {
      intentParams.transfer_data = { destination: tenant.stripeAccountId };
      intentParams.application_fee_amount = platformFeeAmount;
    }

    const pi = await stripeClient.paymentIntents.create(intentParams);

    if (pi.status === "succeeded") {
      if (isSplitDeposit) {
        // Split payment deposit — keep status as-is (pending), just record that deposit was charged
        await db.update(bookingsTable).set({
          stripePaymentIntentId: pi.id,
          stripePaymentStatus: "deposit_paid",
          stripePlatformFee: String((platformFeeAmount / 100).toFixed(2)),
          updatedAt: new Date(),
        }).where(eq(bookingsTable.id, booking.id));
      } else {
        await db.update(bookingsTable).set({
          status: "confirmed",
          stripePaymentIntentId: pi.id,
          stripePaymentStatus: "paid",
          stripePlatformFee: String((platformFeeAmount / 100).toFixed(2)),
          updatedAt: new Date(),
        }).where(eq(bookingsTable.id, booking.id));
      }

      res.json({
        success: true,
        paymentIntentId: pi.id,
        brand: pm.card?.brand ?? null,
        last4: pm.card?.last4 ?? null,
      });
    } else {
      res.status(400).json({ error: `Payment not completed (status: ${pi.status}).` });
    }
  } catch (e: any) {
    console.error("[stripe/admin-charge-saved]", e.message);
    res.status(400).json({ error: e.message || "Card charge failed." });
  }
});

// ── Charge remaining split-payment balance (admin or scheduler) ───────────────
// Looks up the customer's saved payment method and charges the remaining balance
// for a booking that was originally booked with a payment plan.
router.post("/stripe/charge-remaining/:bookingId", requireAdminAuth, async (req, res) => {
  try {
    const bookingId = Number(req.params.bookingId);
    const tenantId  = req.tenantId!;

    const [booking] = await db.select().from(bookingsTable).where(
      and(eq(bookingsTable.id, bookingId), eq(bookingsTable.tenantId, tenantId))
    );
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
    if (!booking.paymentPlanEnabled) {
      res.status(400).json({ error: "This booking does not use a payment plan." }); return;
    }
    if (booking.splitRemainingStatus === "charged") {
      res.status(400).json({ error: "Remaining balance has already been charged." }); return;
    }
    if (booking.splitRemainingStatus === "waived") {
      res.status(400).json({ error: "Remaining balance was waived." }); return;
    }

    const remainingCents = Math.round(parseFloat(String(booking.splitRemainingAmount ?? "0")) * 100);
    if (remainingCents < 50) {
      res.status(400).json({ error: "Remaining balance is too small to charge." }); return;
    }

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

    const [customer] = await db.select().from(customersTable).where(
      eq(customersTable.email, booking.customerEmail.toLowerCase())
    );
    if (!customer?.stripeCustomerId) {
      res.status(400).json({ error: "No saved payment method on file for this customer." }); return;
    }

    const isTestMode = !!tenant.testMode;
    const stripeClient = getStripeForTenant(isTestMode);

    const pms = await stripeClient.paymentMethods.list({
      customer: customer.stripeCustomerId, type: "card",
    });
    if (!pms.data.length) {
      res.status(400).json({ error: "No saved card found for this customer." }); return;
    }
    const pm = pms.data[0];

    const feePercent = tenant.platformFeePercent != null
      ? parseFloat(tenant.platformFeePercent) / 100
      : PLATFORM_FEE_PERCENT;
    // OutdoorShare keeps 100% of the protection fee — allocate the remaining-balance
    // proportion of the total protection fee to the platform, then apply feePercent
    // only to the rental portion of this charge.
    const totalPriceCents2 = Math.round(parseFloat(String(booking.totalPrice ?? "0")) * 100);
    const ppFeeTotalCents2 = Math.round(parseFloat(String(booking.protectionPlanFee ?? "0")) * 100);
    let platformFeeAmount: number;
    if (tenant.isHost && ppFeeTotalCents2 > 0 && totalPriceCents2 > 0) {
      const proportion = Math.min(remainingCents / totalPriceCents2, 1);
      const ppFeeInCharge = Math.round(ppFeeTotalCents2 * proportion);
      const rentalInCharge = remainingCents - ppFeeInCharge;
      platformFeeAmount = Math.round(rentalInCharge * feePercent) + ppFeeInCharge;
    } else {
      platformFeeAmount = Math.round(remainingCents * feePercent);
    }
    const tenantConnected = !isTestMode && !!(tenant.stripeAccountId && tenant.stripeChargesEnabled);

    const intentParams: any = {
      amount: remainingCents,
      currency: "usd",
      customer: customer.stripeCustomerId,
      payment_method: pm.id,
      confirm: true,
      off_session: true,
      description: `Remaining balance — Booking #${booking.id} — ${tenant.name}${isTestMode ? " [TEST]" : ""}`,
      metadata: {
        tenant_id: String(tenantId),
        booking_id: String(booking.id),
        charge_type: "split_payment_remaining",
        test_mode: isTestMode ? "true" : "false",
      },
    };
    if (tenantConnected) {
      intentParams.transfer_data = { destination: tenant.stripeAccountId };
      intentParams.application_fee_amount = platformFeeAmount;
    }

    const pi = await stripeClient.paymentIntents.create(intentParams);

    if (pi.status === "succeeded") {
      await db.update(bookingsTable).set({
        splitRemainingStatus: "charged",
        splitRemainingIntentId: pi.id,
        splitRemainingChargedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(bookingsTable.id, booking.id));

      res.json({
        success: true,
        paymentIntentId: pi.id,
        amountCharged: (remainingCents / 100).toFixed(2),
        brand: pm.card?.brand ?? null,
        last4: pm.card?.last4 ?? null,
      });
    } else {
      await db.update(bookingsTable).set({
        splitRemainingStatus: "failed",
        updatedAt: new Date(),
      }).where(eq(bookingsTable.id, booking.id));

      // Notify renter + admin about split-payment failure — best-effort
      (async () => {
        try {
          const [listingRow] = booking.listingId
            ? await db.select({ title: listingsTable.title }).from(listingsTable).where(eq(listingsTable.id, booking.listingId!))
            : [{ title: "Rental" }];
          const appUrl = process.env.APP_URL ?? "https://myoutdoorshare.com";
          const bookingUrl = `${appUrl}/${tenant.slug}/admin/bookings/${booking.id}`;
          await sendPaymentFailedRenterEmail({
            customerName: booking.customerName, customerEmail: booking.customerEmail,
            bookingId: booking.id, listingTitle: listingRow?.title ?? "Rental",
            startDate: booking.startDate, endDate: booking.endDate,
            totalPrice: parseFloat(String(booking.splitRemainingAmount ?? booking.totalPrice ?? "0")),
            companyName: tenant.name, companyEmail: tenant.email ?? undefined,
          });
          await sendPaymentFailedAdminEmail({
            adminEmail: tenant.email, customerName: booking.customerName, customerEmail: booking.customerEmail,
            bookingId: booking.id, listingTitle: listingRow?.title ?? "Rental",
            startDate: booking.startDate, endDate: booking.endDate,
            totalPrice: parseFloat(String(booking.splitRemainingAmount ?? booking.totalPrice ?? "0")),
            companyName: tenant.name, bookingUrl,
          });
        } catch (emailErr: any) {
          console.warn("[stripe/charge-remaining] failure email send failed:", emailErr.message);
        }
      })();

      res.status(400).json({ error: `Payment not completed (status: ${pi.status}).` });
    }
  } catch (e: any) {
    console.error("[stripe/charge-remaining]", e.message);
    await db.update(bookingsTable).set({
      splitRemainingStatus: "failed", updatedAt: new Date(),
    }).where(eq(bookingsTable.id, Number(req.params.bookingId))).catch(() => {});
    res.status(400).json({ error: e.message || "Charge failed." });
  }
});

export default router;
