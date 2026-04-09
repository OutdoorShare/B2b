import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { tenantsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { stripe } from "../services/stripe";
import { createGHLSubAccount } from "../services/ghl";

const PAID_PLANS = new Set(["professional", "enterprise"]);

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response, next: any) {
  if (!req.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
  next();
}

const PLAN_CONFIG: Record<string, { label: string; amount: number; interval: "month" | "year" } | null> = {
  starter: { label: "Half Throttle", amount: 2500, interval: "month" },
  professional: { label: "Full Throttle", amount: 89500, interval: "year" },
  enterprise: null,
};

// ── GET /billing/status ───────────────────────────────────────────────────────
router.get("/billing/status", requireAdmin, async (req, res) => {
  try {
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, req.tenantId!)).limit(1);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

    const now = Date.now();
    const trialMs = tenant.trialEndsAt ? tenant.trialEndsAt.getTime() : null;
    const subscriptionActive = ["active", "trialing"].includes(tenant.subscriptionStatus ?? "");
    const trialActive = trialMs !== null && trialMs > now && !subscriptionActive;
    const trialExpired = trialMs !== null && trialMs <= now && !subscriptionActive;
    const daysLeft = trialMs ? Math.max(0, Math.ceil((trialMs - now) / (1000 * 60 * 60 * 24))) : null;
    const isBlocked = trialExpired;

    res.json({
      plan: tenant.plan,
      status: tenant.status,
      trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      trialActive,
      trialExpired,
      daysLeft,
      subscriptionStatus: tenant.subscriptionStatus ?? null,
      subscriptionId: tenant.subscriptionId ?? null,
      currentPeriodEnd: tenant.currentPeriodEnd?.toISOString() ?? null,
      stripeCustomerId: tenant.stripeCustomerId ?? null,
      isBlocked,
    });
  } catch (e: any) {
    console.error("[billing/status]", e.message);
    res.status(500).json({ error: "Failed to fetch billing status" });
  }
});

// ── POST /billing/checkout-session ───────────────────────────────────────────
router.post("/billing/checkout-session", requireAdmin, async (req, res) => {
  try {
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, req.tenantId!)).limit(1);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

    const planConfig = PLAN_CONFIG[tenant.plan];
    if (!planConfig) {
      res.status(400).json({ error: "This plan requires manual setup. Please contact us." });
      return;
    }

    const protocol = req.headers["x-forwarded-proto"] ?? "https";
    const host = req.get("host");
    const baseUrl = `${protocol}://${host}`;

    let customerId = tenant.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: tenant.email,
        name: tenant.name,
        metadata: { tenant_id: String(tenant.id), tenant_slug: tenant.slug },
      });
      customerId = customer.id;
      await db.update(tenantsTable).set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(tenantsTable.id, tenant.id));
    }

    const trialDaysLeft = tenant.trialEndsAt
      ? Math.max(0, Math.ceil((tenant.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `OutdoorShare — ${planConfig.label}` },
          unit_amount: planConfig.amount,
          recurring: { interval: planConfig.interval },
        },
        quantity: 1,
      }],
      subscription_data: trialDaysLeft > 0 ? { trial_period_days: trialDaysLeft } : undefined,
      success_url: `${baseUrl}/${tenant.slug}/admin/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/${tenant.slug}/admin/billing?canceled=true`,
      metadata: { tenant_id: String(tenant.id), tenant_slug: tenant.slug },
    });

    res.json({ url: session.url });
  } catch (e: any) {
    console.error("[billing/checkout-session]", e.message);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// ── POST /billing/portal ──────────────────────────────────────────────────────
router.post("/billing/portal", requireAdmin, async (req, res) => {
  try {
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, req.tenantId!)).limit(1);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    if (!tenant.stripeCustomerId) { res.status(400).json({ error: "No billing account found. Subscribe first." }); return; }

    const protocol = req.headers["x-forwarded-proto"] ?? "https";
    const host = req.get("host");
    const baseUrl = `${protocol}://${host}`;

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${baseUrl}/${tenant.slug}/admin/billing`,
    });

    res.json({ url: session.url });
  } catch (e: any) {
    console.error("[billing/portal]", e.message);
    res.status(500).json({ error: "Failed to open billing portal" });
  }
});

// ── POST /billing/webhook ─────────────────────────────────────────────────────
// Registered with express.raw() in app.ts before express.json()
router.post("/billing/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: any;
  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig as string, webhookSecret);
    } else {
      event = JSON.parse((req.body as Buffer).toString());
    }
  } catch (e: any) {
    console.error("[billing/webhook] signature error:", e.message);
    res.status(400).json({ error: "Webhook signature verification failed" });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const tenantId = Number(session.metadata?.tenant_id);
        if (tenantId && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          await db.update(tenantsTable).set({
            subscriptionId: sub.id,
            subscriptionStatus: sub.status,
            currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
            status: "active",
            updatedAt: new Date(),
          }).where(eq(tenantsTable.id, tenantId));
          // Provision GHL sub-account for paid plan (non-blocking)
          provisionGHLIfNeeded(tenantId).catch(e => console.error("[GHL] background provision error:", e.message));
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object;
        const tenantId = await getTenantByCustomer(sub.customer);
        if (tenantId) {
          await db.update(tenantsTable).set({
            subscriptionId: sub.id,
            subscriptionStatus: sub.status,
            currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
            status: ["active", "trialing"].includes(sub.status) ? "active" : "suspended",
            updatedAt: new Date(),
          }).where(eq(tenantsTable.id, tenantId));
          if (["active", "trialing"].includes(sub.status)) {
            provisionGHLIfNeeded(tenantId).catch(e => console.error("[GHL] background provision error:", e.message));
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const tenantId = await getTenantByCustomer(sub.customer);
        if (tenantId) {
          await db.update(tenantsTable).set({
            subscriptionStatus: "canceled",
            status: "suspended",
            updatedAt: new Date(),
          }).where(eq(tenantsTable.id, tenantId));
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const tenantId = await getTenantByCustomer(invoice.customer);
        if (tenantId) {
          await db.update(tenantsTable).set({
            subscriptionStatus: "past_due",
            updatedAt: new Date(),
          }).where(eq(tenantsTable.id, tenantId));
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const tenantId = await getTenantByCustomer(invoice.customer);
        if (tenantId) {
          await db.update(tenantsTable).set({
            subscriptionStatus: "active",
            status: "active",
            updatedAt: new Date(),
          }).where(eq(tenantsTable.id, tenantId));
        }
        break;
      }
    }
    res.json({ received: true });
  } catch (e: any) {
    console.error("[billing/webhook] handler error:", e.message);
    res.status(500).json({ error: "Webhook handler failed" });
  }
});

async function getTenantByCustomer(customerId: string): Promise<number | null> {
  const [tenant] = await db.select({ id: tenantsTable.id })
    .from(tenantsTable).where(eq(tenantsTable.stripeCustomerId, customerId)).limit(1);
  return tenant?.id ?? null;
}

/**
 * Provision a GHL sub-account for a tenant on a paid plan, if one doesn't exist yet.
 * Fetches the tenant's business profile to get contact details.
 */
async function provisionGHLIfNeeded(tenantId: number): Promise<void> {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  if (!tenant) return;

  // Only provision for paid plans
  if (!PAID_PLANS.has(tenant.plan)) return;

  // Already has a GHL location
  if (tenant.ghlLocationId) {
    console.log(`[GHL] Tenant ${tenant.slug} already has location ${tenant.ghlLocationId} — skipping`);
    return;
  }

  const result = await createGHLSubAccount({
    companyName: tenant.name,
    email: tenant.email,
    phone: tenant.phone,
    slug: tenant.slug,
  });

  if (result.success) {
    await db.update(tenantsTable)
      .set({ ghlLocationId: result.locationId, updatedAt: new Date() })
      .where(eq(tenantsTable.id, tenantId));
    console.log(`[GHL] Location ID ${result.locationId} saved for tenant ${tenant.slug}`);
  }
}

export { provisionGHLIfNeeded };
export default router;
