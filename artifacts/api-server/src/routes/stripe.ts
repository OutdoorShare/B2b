import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tenantsTable, bookingsTable, customersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { stripe, PLATFORM_FEE_PERCENT } from "../services/stripe";
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

    let accountId = tenant.stripeAccountId;

    // Create a new Express account if one doesn't exist yet
    if (!accountId) {
      const account = await stripe.accounts.create({
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

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/admin/settings?stripe=refresh`,
      return_url: `${baseUrl}/admin/settings?stripe=success`,
      type: "account_onboarding",
    });

    res.json({ url: link.url });
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
      res.json({ connected: false });
      return;
    }

    const account = await stripe.accounts.retrieve(tenant.stripeAccountId);
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
    const link = await stripe.accounts.createLoginLink(tenant.stripeAccountId);
    res.json({ url: link.url });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Connect: public readiness check (no auth required — called from booking page) ──
router.get("/stripe/connect/check/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug));
    if (!tenant) { res.status(404).json({ ready: false, reason: "tenant_not_found" }); return; }
    const ready = !!(tenant.stripeAccountId && tenant.stripeChargesEnabled);
    res.json({ ready, reason: ready ? "ok" : "connect_not_configured" });
  } catch (e: any) {
    res.status(500).json({ ready: false, reason: "error" });
  }
});

// ── Payment Intent: create for a booking ─────────────────────────────────────
// Called from booking page before submitting, returns clientSecret to frontend
router.post("/stripe/payment-intent", async (req, res) => {
  try {
    const { tenantSlug, amountCents, customerEmail, customerName, bookingMeta } = req.body;
    if (!tenantSlug || !amountCents || amountCents < 50) {
      res.status(400).json({ error: "tenantSlug and amountCents (min 50) required" });
      return;
    }

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

    // Require Stripe Connect to be fully set up before accepting payments
    if (!tenant.stripeAccountId || !tenant.stripeChargesEnabled) {
      res.status(402).json({
        error: "payments_not_configured",
        message: "This business has not yet set up their payment account. Please contact them directly.",
      });
      return;
    }

    const platformFeeAmount = Math.round(amountCents * PLATFORM_FEE_PERCENT);
    const transferAmount = amountCents - platformFeeAmount;

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      receipt_email: customerEmail,
      description: `Rental booking — ${tenant.name}`,
      metadata: {
        tenant_slug: tenantSlug,
        customer_name: customerName ?? "",
        ...(bookingMeta ?? {}),
      },
      transfer_data: {
        destination: tenant.stripeAccountId,
        amount: transferAmount,
      },
      application_fee_amount: platformFeeAmount,
    });

    res.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      platformFee: (platformFeeAmount / 100).toFixed(2),
    });
  } catch (e: any) {
    console.error("[stripe/payment-intent]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Identity: create verification session ────────────────────────────────────
router.post("/stripe/identity/session", async (req, res) => {
  try {
    const { tenantSlug, customerId, returnUrl } = req.body;
    if (!tenantSlug) { res.status(400).json({ error: "tenantSlug required" }); return; }

    const session = await (stripe as any).identity.verificationSessions.create({
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
    const session = await (stripe as any).identity.verificationSessions.retrieve(sessionId);
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
          await db.update(tenantsTable).set({
            stripeChargesEnabled: account.charges_enabled,
            stripePayoutsEnabled: account.payouts_enabled,
            stripeAccountStatus: account.charges_enabled ? "active" : "onboarding",
            updatedAt: new Date(),
          }).where(eq(tenantsTable.id, parseInt(meta.tenant_id)));
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

export default router;
