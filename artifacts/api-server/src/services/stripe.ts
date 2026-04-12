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

export const PLATFORM_FEE_PERCENT = 0.10; // 10% platform fee (default)

export function getStripe() {
  return stripe;
}
