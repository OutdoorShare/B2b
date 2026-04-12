import { pgTable, serial, integer, text, decimal, timestamp } from "drizzle-orm/pg-core";

export const rentalExtensionsTable = pgTable("rental_extensions", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull(),
  tenantId: integer("tenant_id"),
  originalEndDate: text("original_end_date").notNull(),
  requestedEndDate: text("requested_end_date").notNull(),
  additionalDays: integer("additional_days").notNull(),
  additionalAmount: decimal("additional_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status", { enum: ["pending", "approved", "denied"] }).notNull().default("pending"),
  requestNote: text("request_note"),
  denialReason: text("denial_reason"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripePaymentStatus: text("stripe_payment_status"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type RentalExtension = typeof rentalExtensionsTable.$inferSelect;
export type InsertRentalExtension = typeof rentalExtensionsTable.$inferInsert;
