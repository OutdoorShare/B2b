import { strict as assert } from "node:assert";
import { test } from "node:test";
import { calculateBookingPricing, normalizeFeeMode } from "./pricing.js";
import { toStripeAmount, validateStripeCents } from "../services/stripe.js";

test("pass_to_customer: subtotal=100, fee=10%", () => {
  const r = calculateBookingPricing({ subtotal: 100, feeMode: "pass_to_customer", platformFeePercent: 10 });
  assert.equal(r.subtotal, 100);
  assert.equal(r.totalPlatformFee, 10);
  assert.equal(r.customerFee, 10);
  assert.equal(r.operatorFee, 0);
  assert.equal(r.customerTotal, 110);
  assert.equal(r.operatorPayout, 100);
  assert.equal(r.platformRevenue, 10);
});

test("absorb: subtotal=100, fee=10%", () => {
  const r = calculateBookingPricing({ subtotal: 100, feeMode: "absorb", platformFeePercent: 10 });
  assert.equal(r.subtotal, 100);
  assert.equal(r.totalPlatformFee, 10);
  assert.equal(r.customerFee, 0);
  assert.equal(r.operatorFee, 10);
  assert.equal(r.customerTotal, 100);
  assert.equal(r.operatorPayout, 90);
  assert.equal(r.platformRevenue, 10);
});

test("split 50/50: subtotal=100, fee=10%", () => {
  const r = calculateBookingPricing({ subtotal: 100, feeMode: "split", platformFeePercent: 10, splitCustomerPercent: 50, splitOperatorPercent: 50 });
  assert.equal(r.subtotal, 100);
  assert.equal(r.totalPlatformFee, 10);
  assert.equal(r.customerFee, 5);
  assert.equal(r.operatorFee, 5);
  assert.equal(r.customerTotal, 105);
  assert.equal(r.operatorPayout, 95);
  assert.equal(r.platformRevenue, 10);
});

test("split 40/60: subtotal=100, fee=10%", () => {
  const r = calculateBookingPricing({ subtotal: 100, feeMode: "split", platformFeePercent: 10, splitCustomerPercent: 40, splitOperatorPercent: 60 });
  assert.equal(r.subtotal, 100);
  assert.equal(r.totalPlatformFee, 10);
  assert.equal(r.customerFee, 4);
  assert.equal(r.operatorFee, 6);
  assert.equal(r.customerTotal, 104);
  assert.equal(r.operatorPayout, 94);
  assert.equal(r.platformRevenue, 10);
});

test("rounding: subtotal=99.99, fee=7.5%", () => {
  const r = calculateBookingPricing({ subtotal: 99.99, feeMode: "split", platformFeePercent: 7.5, splitCustomerPercent: 50, splitOperatorPercent: 50 });
  assert.ok(r.subtotal >= 0, "subtotal non-negative");
  assert.ok(r.customerTotal >= 0, "customerTotal non-negative");
  assert.ok(r.operatorPayout >= 0, "operatorPayout non-negative");
  const sumFees = Math.round((r.customerFee + r.operatorFee) * 100) / 100;
  assert.equal(r.platformRevenue, sumFees, "platformRevenue = customerFee + operatorFee");
  assert.ok(Math.abs(r.totalPlatformFee - (r.customerFee + r.operatorFee)) <= 0.01, "fee sum within 1 cent of totalPlatformFee");
});

test("invalid mode string falls back to pass_to_customer (never throws)", () => {
  const r = calculateBookingPricing({ subtotal: 100, feeMode: "invalid" as any, platformFeePercent: 10 });
  assert.equal(r.feeMode, "pass_to_customer", "falls back to pass_to_customer");
  assert.equal(r.customerFee, 10, "pass_to_customer = customer pays the fee");
  assert.equal(r.operatorFee, 0);
  assert.equal(r.customerTotal, 110);
  assert.equal(r.operatorPayout, 100);
});

test("empty string feeMode falls back to pass_to_customer (the production crash case)", () => {
  const r = calculateBookingPricing({ subtotal: 100, feeMode: "" as any, platformFeePercent: 10 });
  assert.equal(r.feeMode, "pass_to_customer", "empty string falls back to pass_to_customer");
  assert.equal(r.customerFee, 10);
  assert.equal(r.customerTotal, 110);
});

test("null feeMode falls back to pass_to_customer", () => {
  const r = calculateBookingPricing({ subtotal: 100, feeMode: null as any, platformFeePercent: 10 });
  assert.equal(r.feeMode, "pass_to_customer");
});

test("undefined feeMode falls back to pass_to_customer", () => {
  const r = calculateBookingPricing({ subtotal: 100, feeMode: undefined as any, platformFeePercent: 10 });
  assert.equal(r.feeMode, "pass_to_customer");
});

test("NaN subtotal coerces to 0", () => {
  const r = calculateBookingPricing({ subtotal: NaN, feeMode: "absorb", platformFeePercent: 10 });
  assert.equal(r.subtotal, 0);
  assert.equal(r.totalPlatformFee, 0);
  assert.equal(r.customerTotal, 0);
});

test("NaN platformFeePercent uses 10% default", () => {
  const r = calculateBookingPricing({ subtotal: 100, feeMode: "absorb", platformFeePercent: NaN });
  assert.equal(r.totalPlatformFee, 10);
});

test("normalizeFeeMode: valid modes pass through", () => {
  assert.equal(normalizeFeeMode("pass_to_customer"), "pass_to_customer");
  assert.equal(normalizeFeeMode("absorb"), "absorb");
  assert.equal(normalizeFeeMode("split"), "split");
});

test("normalizeFeeMode: empty string, null, undefined all return pass_to_customer", () => {
  assert.equal(normalizeFeeMode(""), "pass_to_customer");
  assert.equal(normalizeFeeMode(null), "pass_to_customer");
  assert.equal(normalizeFeeMode(undefined), "pass_to_customer");
  assert.equal(normalizeFeeMode("anything_else"), "pass_to_customer");
});

// ── toStripeAmount tests ──────────────────────────────────────────────────────

test("toStripeAmount: whole dollar amounts convert to exact cents", () => {
  assert.equal(toStripeAmount(1), 100);
  assert.equal(toStripeAmount(10), 1000);
  assert.equal(toStripeAmount(0), 0);
  assert.equal(toStripeAmount(9.99), 999);
  assert.equal(toStripeAmount(100), 10000);
});

test("toStripeAmount: rounds fractional cents correctly", () => {
  // 1.006 * 100 = 100.6 → rounds to 101
  assert.equal(toStripeAmount(1.006), 101);
  // 1.504 * 100 = 150.4 → rounds to 150
  assert.equal(toStripeAmount(1.504), 150);
  // 99.999 * 100 = 9999.9 → rounds to 10000
  assert.equal(toStripeAmount(99.999), 10000);
});

test("toStripeAmount: throws on negative amount", () => {
  assert.throws(() => toStripeAmount(-1), /invalid input/);
});

test("toStripeAmount: throws on NaN", () => {
  assert.throws(() => toStripeAmount(NaN), /invalid input/);
});

test("toStripeAmount: throws on Infinity", () => {
  assert.throws(() => toStripeAmount(Infinity), /invalid input/);
});

// ── validateStripeCents tests ─────────────────────────────────────────────────

test("validateStripeCents: valid integer passes through", () => {
  assert.equal(validateStripeCents(500), 500);
  assert.equal(validateStripeCents(0), 0);
  assert.equal(validateStripeCents("1000"), 1000);
});

test("validateStripeCents: throws on float", () => {
  assert.throws(() => validateStripeCents(9.5), /non-negative integer/);
});

test("validateStripeCents: throws on negative", () => {
  assert.throws(() => validateStripeCents(-50), /non-negative integer/);
});

test("validateStripeCents: throws on NaN string", () => {
  assert.throws(() => validateStripeCents("abc"), /non-negative integer/);
});
