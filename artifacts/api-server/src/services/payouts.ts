import { db } from "@workspace/db";
import { bookingsTable, tenantsTable } from "@workspace/db/schema";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { getStripeForTenant, PLATFORM_FEE_PERCENT } from "./stripe";

/**
 * Trigger an immediate standard payout of the connected account's available balance.
 * Silently no-ops when the balance is zero, funds are still pending, or the account
 * doesn't have a bank account attached yet.
 */
export async function triggerAvailablePayout(stripeClient: any, accountId: string): Promise<void> {
  try {
    const balance = await stripeClient.balance.retrieve({ stripeAccount: accountId });
    const avail = (balance.available ?? []).find((b: any) => b.currency === "usd");
    const amount = avail?.amount ?? 0;
    if (amount < 100) return;

    await stripeClient.payouts.create(
      { amount, currency: "usd", method: "standard" },
      { stripeAccount: accountId },
    );
    console.log(`[payout] Triggered $${(amount / 100).toFixed(2)} standard payout for ${accountId}`);
  } catch (e: any) {
    console.log(`[payout] Could not trigger immediate payout for ${accountId}: ${e.message}`);
  }
}

/**
 * Sweep any paid bookings whose funds are still held on the platform over to the
 * tenant's connected Stripe account, then trigger an immediate payout.
 */
export async function sweepPendingPayouts(tenantId: number): Promise<{ swept: number; totalCents: number }> {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant?.stripeAccountId || !tenant.stripeChargesEnabled) return { swept: 0, totalCents: 0 };
  const sweepStripe = getStripeForTenant(!!tenant.testMode);

  const pending = await db.select().from(bookingsTable).where(
    and(
      eq(bookingsTable.tenantId, tenantId),
      eq(bookingsTable.stripePaymentStatus, "paid"),
      isNotNull(bookingsTable.stripePaymentIntentId),
      isNull(bookingsTable.stripeTransferId),
    )
  );

  const feePercent = tenant.platformFeePercent != null
    ? parseFloat(tenant.platformFeePercent) / 100
    : PLATFORM_FEE_PERCENT;

  let swept = 0;
  let totalCents = 0;

  for (const booking of pending) {
    try {
      const pi = await sweepStripe.paymentIntents.retrieve(booking.stripePaymentIntentId!);
      if ((pi as any).transfer_data?.destination) {
        await db.update(bookingsTable).set({
          stripeTransferId: "via_destination",
          stripeTransferredAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(bookingsTable.id, booking.id));
        continue;
      }

      const totalCentsForBooking = Math.round(parseFloat(booking.totalPrice) * 100);
      const ppCentsForBooking = booking.protectionPlanFee ? Math.round(parseFloat(booking.protectionPlanFee) * 100) : 0;
      const rentalBaseCents = totalCentsForBooking - ppCentsForBooking;
      const platformFee = Math.round(rentalBaseCents * feePercent) + ppCentsForBooking;
      const transferAmt = totalCentsForBooking - platformFee;
      if (transferAmt < 50) continue;

      const transfer = await sweepStripe.transfers.create({
        amount: transferAmt,
        currency: "usd",
        destination: tenant.stripeAccountId,
        source_transaction: (pi.latest_charge as string) || undefined,
        metadata: {
          booking_id: String(booking.id),
          tenant_id: String(tenantId),
          type: "platform_payout",
        },
        description: `Payout for booking #${booking.id} — ${tenant.name}`,
      });

      await db.update(bookingsTable).set({
        stripeTransferId: transfer.id,
        stripeTransferredAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(bookingsTable.id, booking.id));

      swept++;
      totalCents += transferAmt;
    } catch (err: any) {
      console.error(`[sweep] booking ${booking.id} failed:`, err.message);
    }
  }

  if (swept > 0) {
    triggerAvailablePayout(sweepStripe, tenant.stripeAccountId).catch(() => {});
  }

  return { swept, totalCents };
}
