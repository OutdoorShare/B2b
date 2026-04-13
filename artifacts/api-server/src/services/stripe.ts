import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is required");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
});

let _testStripe: Stripe | null = null;
export function getTestStripe(): Stripe {
  if (!_testStripe) {
    const key = process.env.STRIPE_TEST_SECRET_KEY;
    if (!key) throw new Error("STRIPE_TEST_SECRET_KEY is not configured");
    _testStripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  }
  return _testStripe;
}

export function getStripeForTenant(testMode: boolean): Stripe {
  return testMode ? getTestStripe() : stripe;
}

export const PLATFORM_FEE_PERCENT = 0.10;

export function getStripe() {
  return stripe;
}

/**
 * Convert a dollar amount to Stripe's integer cents format.
 * - Rounds to the nearest cent before converting.
 * - Throws if the result is not a non-negative integer (Stripe requires this).
 * - Use this everywhere we send an `amount` to Stripe.
 */
export function toStripeAmount(dollars: number): number {
  if (typeof dollars !== "number" || !isFinite(dollars) || dollars < 0) {
    throw new Error(`toStripeAmount: invalid input ${dollars}`);
  }
  const cents = Math.round(dollars * 100);
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`toStripeAmount: could not convert ${dollars} to valid integer cents`);
  }
  return cents;
}

/**
 * Validate that a raw cents value received from the client is a safe integer
 * suitable for Stripe. Returns the integer or throws.
 */
export function validateStripeCents(cents: unknown, label = "amount"): number {
  const n = Number(cents);
  if (!isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new Error(`${label} must be a non-negative integer (cents), got: ${cents}`);
  }
  return n;
}

/**
 * Validate required Stripe environment variables at startup.
 * Throws on hard requirements; warns on optional-but-recommended ones.
 */
export function validateStripeEnv(): void {
  const required: Record<string, string | undefined> = {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  };
  const recommended: Record<string, string | undefined> = {
    STRIPE_TEST_SECRET_KEY: process.env.STRIPE_TEST_SECRET_KEY,
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    STRIPE_TEST_PUBLISHABLE_KEY: process.env.STRIPE_TEST_PUBLISHABLE_KEY,
  };

  for (const [key, val] of Object.entries(required)) {
    if (!val) throw new Error(`[stripe] Required env var ${key} is missing`);
  }
  for (const [key, val] of Object.entries(recommended)) {
    if (!val) console.warn(`[stripe] Warning: ${key} is not set — some Stripe features may be unavailable`);
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn("[stripe] STRIPE_WEBHOOK_SECRET is not set — webhook signature verification is DISABLED. Set this in production.");
  }
}
