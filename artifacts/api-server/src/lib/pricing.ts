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
  const subtotal = roundMoney(input.subtotal);
  const totalPlatformFee = roundMoney(subtotal * input.platformFeePercent / 100);

  let customerFee = 0;
  let operatorFee = 0;

  if (input.feeMode === "pass_to_customer") {
    customerFee = totalPlatformFee;
    operatorFee = 0;
  } else if (input.feeMode === "absorb") {
    customerFee = 0;
    operatorFee = totalPlatformFee;
  } else if (input.feeMode === "split") {
    const cPct = input.splitCustomerPercent ?? 50;
    customerFee = roundMoney(totalPlatformFee * cPct / 100);
    operatorFee = roundMoney(totalPlatformFee - customerFee);
  } else {
    throw new Error(`Invalid fee mode: ${input.feeMode}`);
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
