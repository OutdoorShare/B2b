import { strict as assert } from "node:assert";
import { test } from "node:test";
import { computeListingPricing, validateRentalBase, countRentalDays } from "./listing-pricing.js";

// ── countRentalDays ─────────────────────────────────────────────────────────

test("countRentalDays: same day = 1", () => {
  assert.equal(countRentalDays("2024-06-01", "2024-06-01"), 1);
});

test("countRentalDays: one night = 1 day", () => {
  assert.equal(countRentalDays("2024-06-01", "2024-06-02"), 1);
});

test("countRentalDays: 3-day rental", () => {
  assert.equal(countRentalDays("2024-06-01", "2024-06-04"), 3);
});

test("countRentalDays: 7-day rental (one week)", () => {
  assert.equal(countRentalDays("2024-06-01", "2024-06-08"), 7);
});

// ── computeListingPricing: daily ─────────────────────────────────────────────

test("daily: 3 days × $100/day × qty 1", () => {
  const r = computeListingPricing(
    { pricePerDay: "100" },
    [],
    { startDate: "2024-06-01", endDate: "2024-06-04", quantity: 1, planType: "daily" }
  );
  assert.equal(r.rentalDays, 3);
  assert.equal(r.baseDollars, 300);
  assert.equal(r.addonsDollars, 0);
  assert.equal(r.totalDollars, 300);
  assert.equal(r.baseCents, 30000);
  assert.equal(r.totalCents, 30000);
});

test("daily: 2 days × $75/day × qty 2", () => {
  const r = computeListingPricing(
    { pricePerDay: "75" },
    [],
    { startDate: "2024-06-01", endDate: "2024-06-03", quantity: 2, planType: "daily" }
  );
  assert.equal(r.baseDollars, 300); // 75 × 2 × 2
  assert.equal(r.totalCents, 30000);
});

// ── computeListingPricing: addons ────────────────────────────────────────────

test("flat addon: $20 flat + $100 daily", () => {
  const r = computeListingPricing(
    { pricePerDay: "100" },
    [{ id: 1, price: "20", priceType: "flat", isActive: true }],
    { startDate: "2024-06-01", endDate: "2024-06-04", quantity: 1, planType: "daily", selectedAddonIds: [1] }
  );
  assert.equal(r.rentalDays, 3);
  assert.equal(r.baseDollars, 300);
  assert.equal(r.addonsDollars, 20);
  assert.equal(r.totalDollars, 320);
});

test("per_day addon: $10/day × 3 days × $100 daily", () => {
  const r = computeListingPricing(
    { pricePerDay: "100" },
    [{ id: 2, price: "10", priceType: "per_day", isActive: true }],
    { startDate: "2024-06-01", endDate: "2024-06-04", quantity: 1, planType: "daily", selectedAddonIds: [2] }
  );
  assert.equal(r.addonsDollars, 30); // 10 × 3 days
  assert.equal(r.totalDollars, 330);
});

test("inactive addon is ignored even if selected", () => {
  const r = computeListingPricing(
    { pricePerDay: "100" },
    [{ id: 3, price: "50", priceType: "flat", isActive: false }],
    { startDate: "2024-06-01", endDate: "2024-06-03", quantity: 1, planType: "daily", selectedAddonIds: [3] }
  );
  assert.equal(r.addonsDollars, 0);
  assert.equal(r.totalDollars, 200); // 2 days × $100, addon excluded
});

test("unselected addon is ignored", () => {
  const r = computeListingPricing(
    { pricePerDay: "100" },
    [{ id: 4, price: "50", priceType: "flat", isActive: true }],
    { startDate: "2024-06-01", endDate: "2024-06-03", quantity: 1, planType: "daily", selectedAddonIds: [] }
  );
  assert.equal(r.addonsDollars, 0);
  assert.equal(r.totalDollars, 200); // 2 days × $100, addon excluded
});

// ── computeListingPricing: halfday ─────────────────────────────────────────

test("halfday: $60 half-day rate, 1 effective day", () => {
  const r = computeListingPricing(
    { pricePerDay: "100", halfDayEnabled: true, halfDayRate: "60" },
    [],
    { startDate: "2024-06-01", endDate: "2024-06-01", quantity: 1, planType: "halfday" }
  );
  assert.equal(r.baseDollars, 60);
  assert.equal(r.totalCents, 6000);
});

// ── computeListingPricing: hourly_per_hour ──────────────────────────────────

test("hourly_per_hour: $25/hr × 4 hrs", () => {
  const r = computeListingPricing(
    { pricePerDay: "100", hourlyPerHourEnabled: true, pricePerHour: "25", hourlyMinimumHours: 1 },
    [],
    { startDate: "2024-06-01", endDate: "2024-06-01", quantity: 1, planType: "hourly_per_hour", hours: 4 }
  );
  assert.equal(r.baseDollars, 100); // 25 × 4
  assert.equal(r.totalCents, 10000);
});

test("hourly_per_hour: respects minimum hours", () => {
  const r = computeListingPricing(
    { pricePerDay: "100", hourlyPerHourEnabled: true, pricePerHour: "20", hourlyMinimumHours: 3 },
    [],
    { startDate: "2024-06-01", endDate: "2024-06-01", quantity: 1, planType: "hourly_per_hour", hours: 1 }
  );
  // hours is 1 but minimum is 3 → effectiveDays = 3
  assert.equal(r.baseDollars, 60); // 20 × 3
});

// ── computeListingPricing: hourly_slot ─────────────────────────────────────

test("hourly_slot: $80 slot price", () => {
  const r = computeListingPricing(
    { pricePerDay: "100", hourlyEnabled: true },
    [],
    { startDate: "2024-06-01", endDate: "2024-06-01", quantity: 1, planType: "hourly_slot", hourlySlotPrice: 80 }
  );
  assert.equal(r.baseDollars, 80);
  assert.equal(r.totalCents, 8000);
});

// ── validateRentalBase ────────────────────────────────────────────────────────

test("validateRentalBase: exact match → valid", () => {
  const r = validateRentalBase(10000, 10000);
  assert.equal(r.valid, true);
  assert.equal(r.gapPercent, 0);
});

test("validateRentalBase: 10% below → valid (within 35% tolerance)", () => {
  const r = validateRentalBase(10000, 9000);
  assert.equal(r.valid, true);
  assert.equal(r.gapPercent, 10);
});

test("validateRentalBase: 34% below → valid (just within 35% tolerance)", () => {
  const r = validateRentalBase(10000, 6600);
  assert.equal(r.valid, true);
});

test("validateRentalBase: 40% below → invalid (exceeds 35% tolerance)", () => {
  const r = validateRentalBase(10000, 6000);
  assert.equal(r.valid, false);
  assert.equal(r.gapPercent, 40);
});

test("validateRentalBase: serverBaseCents=0 → always valid (free listing)", () => {
  const r = validateRentalBase(0, 0);
  assert.equal(r.valid, true);
});

test("validateRentalBase: custom maxDiscountPct=10 → strict", () => {
  const r = validateRentalBase(10000, 8500, 10);
  assert.equal(r.valid, false); // 15% gap > 10% max
});

test("validateRentalBase: client amount > server (overpayment) → valid", () => {
  const r = validateRentalBase(10000, 11000);
  assert.equal(r.valid, true);
  assert.equal(r.gapPercent, -10); // negative gap = overpayment
});
