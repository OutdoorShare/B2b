export type FeeMode = "pass_to_customer" | "absorb" | "split";

export interface BookingPricingInput {
  subtotal: number;
  feeMode: FeeMode;
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

export function calculateBookingPricing(input: BookingPricingInput): BookingPricingResult {
  // Coerce all numeric inputs to prevent NaN propagation
  const rawSubtotal = typeof input.subtotal === "number" && isFinite(input.subtotal) ? input.subtotal : 0;
  const subtotal = roundMoney(rawSubtotal);
  const rawFeePercent = typeof input.platformFeePercent === "number" && isFinite(input.platformFeePercent) ? input.platformFeePercent : 10;
  const totalPlatformFee = roundMoney(subtotal * rawFeePercent / 100);

  // Sanitize feeMode — default to "absorb" for any unknown/invalid value
  const validModes: FeeMode[] = ["pass_to_customer", "absorb", "split"];
  const resolvedMode: FeeMode = validModes.includes(input.feeMode as FeeMode) ? input.feeMode : "absorb";

  let customerFee = 0;
  let operatorFee = 0;

  if (resolvedMode === "pass_to_customer") {
    customerFee = totalPlatformFee;
    operatorFee = 0;
  } else if (resolvedMode === "absorb") {
    customerFee = 0;
    operatorFee = totalPlatformFee;
  } else if (resolvedMode === "split") {
    const cPct = typeof input.splitCustomerPercent === "number" && isFinite(input.splitCustomerPercent) ? input.splitCustomerPercent : 50;
    customerFee = roundMoney(totalPlatformFee * cPct / 100);
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
    feeMode: input.feeMode,
    platformFeePercent: input.platformFeePercent,
    ...(input.feeMode === "split" ? {
      splitCustomerPercent: input.splitCustomerPercent ?? 50,
      splitOperatorPercent: input.splitOperatorPercent ?? 50,
    } : {}),
  };
}

export function feeModeFromLegacy(passPlatformFeeToCustomer: boolean): FeeMode {
  return passPlatformFeeToCustomer ? "pass_to_customer" : "absorb";
}

export function feeModeLabel(mode: FeeMode): string {
  switch (mode) {
    case "pass_to_customer": return "Customers pay the platform fee at checkout";
    case "absorb": return "You cover the platform fee";
    case "split": return "Part is paid by customer, part is deducted from your payout";
  }
}
