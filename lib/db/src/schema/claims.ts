import { pgTable, serial, integer, text, decimal, timestamp } from "drizzle-orm/pg-core";

export const claimsTable = pgTable("claims", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  bookingId: integer("booking_id"),
  listingId: integer("listing_id"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  type: text("type", { enum: ["damage", "theft", "overage", "dispute", "other"] })
    .notNull()
    .default("damage"),
  description: text("description").notNull(),
  claimedAmount: decimal("claimed_amount", { precision: 10, scale: 2 }),
  settledAmount: decimal("settled_amount", { precision: 10, scale: 2 }),
  status: text("status", { enum: ["open", "reviewing", "resolved", "denied"] })
    .notNull()
    .default("open"),
  adminNotes: text("admin_notes"),
  evidenceUrls: text("evidence_urls"),
  chargeMode: text("charge_mode"),
  chargeStatus: text("charge_status"),
  chargedAmount: decimal("charged_amount", { precision: 10, scale: 2 }),
  stripeChargeRefs: text("stripe_charge_refs"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Claim = typeof claimsTable.$inferSelect;
export type InsertClaim = typeof claimsTable.$inferInsert;
