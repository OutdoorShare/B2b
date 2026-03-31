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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
