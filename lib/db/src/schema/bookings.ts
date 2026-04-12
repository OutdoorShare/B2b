import { pgTable, serial, text, integer, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  listingId: integer("listing_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  quantity: integer("quantity").notNull().default(1),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  depositPaid: decimal("deposit_paid", { precision: 10, scale: 2 }),
  status: text("status", { enum: ["pending", "confirmed", "active", "completed", "cancelled"] }).notNull().default("pending"),
  notes: text("notes"),
  adminNotes: text("admin_notes"),
  source: text("source", { enum: ["online", "kiosk", "phone", "walkin"] }).notNull().default("online"),
  addonsData: text("addons_data"),
  bundleItems: text("bundle_items"),       // JSON: [{listingId, title, qty, pricePerDay, days, subtotal}]
  bundleDiscountPct: text("bundle_discount_pct"), // snapshot of the discount % at time of booking
  assignedUnitIds: text("assigned_unit_ids"),
  agreementSignerName: text("agreement_signer_name"),
  agreementSignedAt: timestamp("agreement_signed_at"),
  agreementText: text("agreement_text"),
  agreementSignature: text("agreement_signature"),
  agreementPdfPath: text("agreement_pdf_path"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripePaymentStatus: text("stripe_payment_status"),
  stripePlatformFee: decimal("stripe_platform_fee", { precision: 10, scale: 2 }),
  pickupTime: text("pickup_time"),
  dropoffTime: text("dropoff_time"),
  pickupToken: text("pickup_token"),
  pickupPhotos: text("pickup_photos"),
  pickupCompletedAt: timestamp("pickup_completed_at"),
  // Payout tracking — funds held on platform until tenant connects Stripe
  stripeTransferId: text("stripe_transfer_id"),
  stripeTransferredAt: timestamp("stripe_transferred_at"),
  // Security deposit authorized hold
  depositHoldIntentId: text("deposit_hold_intent_id"),
  depositHoldStatus: text("deposit_hold_status", { enum: ["authorized", "captured", "released"] }),
  depositAutoAttemptedAt: timestamp("deposit_auto_attempted_at"),
  // Platform protection plan fee applied at booking time (from platformProtectionPlansTable)
  protectionPlanFee: decimal("protection_plan_fee", { precision: 10, scale: 2 }),
  // True when the renter explicitly opted out of the protection plan at checkout.
  // Bookings with this flag cannot have claims submitted against them.
  protectionPlanDeclined: boolean("protection_plan_declined").notNull().default(false),
  // Per-rule initials: JSON array of {ruleId, title, initials, initialedAt}
  ruleInitials: text("rule_initials"),
  // Return documentation
  returnToken: text("return_token"),
  returnPhotos: text("return_photos"),
  returnCompletedAt: timestamp("return_completed_at"),
  // AI inspection result (JSON from vision API)
  inspectionResult: text("inspection_result"),
  // Scheduled reminder flags — set true once the timed email is sent
  pickupReminderSent: boolean("pickup_reminder_sent").default(false),
  returnReminderSent: boolean("return_reminder_sent").default(false),
  // Incomplete-steps alert flags — set true once the timed alert is sent
  incompleteStepsAlertSent: boolean("incomplete_steps_alert_sent").default(false),
  overdueIncompleteAlertSent: boolean("overdue_incomplete_alert_sent").default(false),
  // 36-hour claim window — set true once the "window closing" warning is sent to admin
  claimWindowAlertSent: boolean("claim_window_alert_sent").default(false),
  // ── Split / delayed payment plan ────────────────────────────────────────────
  // When a tenant offers split-payment, the customer pays a deposit at booking
  // time and the remaining balance is automatically charged later.
  paymentPlanEnabled: boolean("payment_plan_enabled").default(false),
  splitDepositAmount: decimal("split_deposit_amount", { precision: 10, scale: 2 }),
  splitRemainingAmount: decimal("split_remaining_amount", { precision: 10, scale: 2 }),
  splitRemainingDueDate: text("split_remaining_due_date"),  // YYYY-MM-DD
  splitRemainingStatus: text("split_remaining_status", {
    enum: ["pending", "charged", "failed", "waived"],
  }),
  splitRemainingIntentId: text("split_remaining_intent_id"),
  splitRemainingChargedAt: timestamp("split_remaining_charged_at"),
  // Email activity log — JSON array of {type, sentAt, toEmail?}
  emailEvents: text("email_events"),
  // Renter-triggered admin review reminder — timestamp of last nudge sent
  lastAdminReminderSentAt: timestamp("last_admin_reminder_sent_at"),
  // Seen/read tracking — false means the viewer has not yet looked at this booking/update
  seenByAdmin: boolean("seen_by_admin").notNull().default(true),
  seenByRenter: boolean("seen_by_renter").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
