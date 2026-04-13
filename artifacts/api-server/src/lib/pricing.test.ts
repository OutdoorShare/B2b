import { strict as assert } from "node:assert";
import { test } from "node:test";
import { calculateBookingPricing } from "./pricing.js";

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
  // platformRevenue must equal customerFee + operatorFee
  const sumFees = Math.round((r.customerFee + r.operatorFee) * 100) / 100;
  assert.equal(r.platformRevenue, sumFees, "platformRevenue = customerFee + operatorFee");
  // totalPlatformFee consistency
  assert.ok(Math.abs(r.totalPlatformFee - (r.customerFee + r.operatorFee)) <= 0.01, "fee sum within 1 cent of totalPlatformFee");
});

test("throws on invalid mode", () => {
  assert.throws(() => {
    calculateBookingPricing({ subtotal: 100, feeMode: "invalid" as any, platformFeePercent: 10 });
  }, /Invalid fee mode/);
});
