export type FeeMode = "pass_to_customer" | "absorb" | "split";

export interface BookingPricingInput {
  subtotal: number;
  feeMode: FeeMode | string | null | undefined;
  platformFeePercent: number;
  splitCustomerPercent?: number;
  splitOperatorPercent?: number;
}

export interface BookingPricingResult {
  subtotal: number;
  totalPlatformFee: number;
  customerFee: number;
  operatorFee: number;
  customerTotal: number;
  operatorPayout: number;
  platformRevenue: number;
  feeMode: FeeMode;
  platformFeePercent: number;
  splitCustomerPercent?: number;
  splitOperatorPercent?: number;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Normalize any incoming fee mode value to a valid FeeMode.
 * Invalid values (empty string, null, undefined, unknown strings) fall back to
 * "pass_to_customer" — the safest visible default for production data issues.
 */
export function normalizeFeeMode(mode: unknown): FeeMode {
  if (
    mode === "pass_to_customer" ||
    mode === "absorb" ||
    mode === "split"
  ) {
    return mode;
  }
  return "pass_to_customer";
}

export function calculateBookingPricing(input: BookingPricingInput): BookingPricingResult {
  const resolvedMode = normalizeFeeMode(input.feeMode);

  const rawSubtotal = typeof input.subtotal === "number" && isFinite(input.subtotal) ? input.subtotal : 0;
  const subtotal = roundMoney(rawSubtotal);

  const rawFeePercent = typeof input.platformFeePercent === "number" && isFinite(input.platformFeePercent) ? input.platformFeePercent : 10;
  const totalPlatformFee = roundMoney(subtotal * rawFeePercent / 100);

  let customerFee = 0;
  let operatorFee = 0;

  if (resolvedMode === "pass_to_customer") {
    customerFee = totalPlatformFee;
    operatorFee = 0;
  } else if (resolvedMode === "absorb") {
    customerFee = 0;
    operatorFee = totalPlatformFee;
  } else if (resolvedMode === "split") {
    const rawCPct = typeof input.splitCustomerPercent === "number" && isFinite(input.splitCustomerPercent) ? input.splitCustomerPercent : 50;
    customerFee = roundMoney(totalPlatformFee * rawCPct / 100);
    operatorFee = roundMoney(totalPlatformFee - customerFee);
  }

  const customerTotal = roundMoney(subtotal + customerFee);
  const operatorPayout = roundMoney(subtotal - operatorFee);
  const platformRevenue = roundMoney(customerFee + operatorFee);

  return {
    subtotal,
    totalPlatformFee,
    customerFee,
    operatorFee,
    customerTotal,
    operatorPayout,
    platformRevenue,
    feeMode: resolvedMode,
    platformFeePercent: rawFeePercent,
    ...(resolvedMode === "split" ? {
      splitCustomerPercent: typeof input.splitCustomerPercent === "number" && isFinite(input.splitCustomerPercent) ? input.splitCustomerPercent : 50,
      splitOperatorPercent: typeof input.splitOperatorPercent === "number" && isFinite(input.splitOperatorPercent) ? input.splitOperatorPercent : 50,
    } : {}),
  };
}

export function feeModeFromLegacy(passPlatformFeeToCustomer: boolean): FeeMode {
  return passPlatformFeeToCustomer ? "pass_to_customer" : "absorb";
}
