/**
 * Server-side listing price calculator.
 *
 * This is the authoritative pricing implementation. It MUST stay in sync with
 * the frontend pricing logic in book.tsx. Whenever the frontend pricing changes,
 * this file must be updated to match.
 *
 * Used for:
 *   1. Returning authoritative price quotes via GET /api/price-quote
 *   2. Validating amountCents in POST /stripe/payment-intent (floor check)
 *   3. Computing immutable pricing snapshots stored on booking creation
 */

export type PlanType =
  | "daily"
  | "weekly"
  | "halfday"
  | "hourly_slot"
  | "hourly_per_hour";

export interface ListingPricingInput {
  pricePerDay: string | number;
  weekendPrice?: string | number | null;
  pricePerWeek?: string | number | null;
  halfDayEnabled?: boolean;
  halfDayRate?: string | number | null;
  hourlyEnabled?: boolean;
  hourlyPerHourEnabled?: boolean;
  pricePerHour?: string | number | null;
  hourlyMinimumHours?: number | null;
  depositAmount?: string | number | null;
}

export interface AddonInput {
  id: number;
  price: string | number;
  priceType: "flat" | "per_day";
  isActive: boolean;
}

export interface PricingOptions {
  startDate: string;
  endDate: string;
  quantity?: number;
  planType?: PlanType | string | null;
  selectedAddonIds?: number[];
  hours?: number;
  hourlySlotPrice?: number;
}

export interface PricingResult {
  rentalDays: number;
  baseRateDollars: number;
  baseDollars: number;
  addonsDollars: number;
  totalDollars: number;
  baseCents: number;
  addonsCents: number;
  totalCents: number;
  planType: string;
  breakdown: {
    days: number;
    dailyRate: number;
    qty: number;
    addons: { id: number; price: number; priceType: string; days: number; subtotal: number }[];
  };
}

function toNum(v: string | number | null | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isFinite(n) ? n : fallback;
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * Count the number of rental days between two YYYY-MM-DD strings.
 * e.g., 2024-06-01 → 2024-06-03 = 2 days (not counting the return day)
 * Minimum: 1 day.
 */
export function countRentalDays(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

/**
 * Compute the authoritative booking price from listing data.
 *
 * Returns full breakdown including base price, addons, and totals.
 * Does NOT include platform fee, protection plan, or custom fees —
 * those are computed separately and passed to Stripe.
 */
export function computeListingPricing(
  listing: ListingPricingInput,
  addons: AddonInput[],
  opts: PricingOptions
): PricingResult {
  const qty = Math.max(1, Math.round(opts.quantity ?? 1));
  const days = countRentalDays(opts.startDate, opts.endDate);
  const planType = opts.planType ?? "daily";
  const selectedAddonIds = new Set(opts.selectedAddonIds ?? []);

  const pricePerDay = toNum(listing.pricePerDay);

  // ── Base price by plan type ──────────────────────────────────────────────
  let baseRateDollars = pricePerDay;
  let effectiveDays = days;

  if (planType === "weekly" && listing.pricePerWeek) {
    const weeklyRate = toNum(listing.pricePerWeek);
    if (weeklyRate > 0) {
      const weeks = Math.floor(days / 7);
      const remainDays = days % 7;
      baseRateDollars = weeks > 0
        ? (weeks * weeklyRate + remainDays * pricePerDay) / days
        : pricePerDay;
    }
  } else if (planType === "halfday" && listing.halfDayEnabled && listing.halfDayRate) {
    baseRateDollars = toNum(listing.halfDayRate);
    effectiveDays = 1;
  } else if (planType === "hourly_per_hour") {
    const hourRate = toNum(listing.pricePerHour ?? listing.pricePerDay);
    const hours = Math.max(toNum(listing.hourlyMinimumHours, 1), opts.hours ?? 1);
    baseRateDollars = hourRate;
    effectiveDays = hours;
  } else if (planType === "hourly_slot") {
    const slotPrice = toNum(opts.hourlySlotPrice, pricePerDay);
    baseRateDollars = slotPrice;
    effectiveDays = 1;
  }

  const baseDollars = round2(baseRateDollars * effectiveDays * qty);

  // ── Add-ons ─────────────────────────────────────────────────────────────
  const activeAddons = addons.filter(a => a.isActive && selectedAddonIds.has(a.id));
  let addonsDollars = 0;
  const addonBreakdown: PricingResult["breakdown"]["addons"] = [];

  for (const addon of activeAddons) {
    const addonPrice = toNum(addon.price);
    const addonDays = addon.priceType === "per_day" ? effectiveDays : 1;
    const addonSubtotal = round2(addonPrice * addonDays * qty);
    addonsDollars += addonSubtotal;
    addonBreakdown.push({
      id: addon.id,
      price: addonPrice,
      priceType: addon.priceType,
      days: addonDays,
      subtotal: addonSubtotal,
    });
  }
  addonsDollars = round2(addonsDollars);

  const totalDollars = round2(baseDollars + addonsDollars);
  const baseCents = Math.round(baseDollars * 100);
  const addonsCents = Math.round(addonsDollars * 100);
  const totalCents = Math.round(totalDollars * 100);

  return {
    rentalDays: days,
    baseRateDollars,
    baseDollars,
    addonsDollars,
    totalDollars,
    baseCents,
    addonsCents,
    totalCents,
    planType: String(planType),
    breakdown: {
      days: effectiveDays,
      dailyRate: baseRateDollars,
      qty,
      addons: addonBreakdown,
    },
  };
}

/**
 * Floor validation: is the client-provided rental base within an acceptable range?
 *
 * We allow the client to be up to MAX_DISCOUNT_PCT% below the server-computed base
 * to accommodate: promo codes, bundle discounts, and minor rounding differences.
 *
 * Returns { valid, serverBaseCents, clientBaseCents, gapPercent }
 */
export function validateRentalBase(
  serverBaseCents: number,
  clientBaseCents: number,
  maxDiscountPct = 35
): { valid: boolean; serverBaseCents: number; clientBaseCents: number; gapPercent: number } {
  if (serverBaseCents <= 0) {
    return { valid: true, serverBaseCents, clientBaseCents, gapPercent: 0 };
  }
  const floor = Math.round(serverBaseCents * (1 - maxDiscountPct / 100));
  const gapPercent = Math.round(((serverBaseCents - clientBaseCents) / serverBaseCents) * 100);
  return {
    valid: clientBaseCents >= floor,
    serverBaseCents,
    clientBaseCents,
    gapPercent,
  };
}
