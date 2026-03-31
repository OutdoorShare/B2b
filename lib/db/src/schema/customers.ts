import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  tenantSlug: text("tenant_slug").notNull().default(""),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  billingAddress: text("billing_address"),
  billingCity: text("billing_city"),
  billingState: text("billing_state"),
  billingZip: text("billing_zip"),
  cardLastFour: text("card_last_four"),
  cardBrand: text("card_brand"),
  stripeCustomerId: text("stripe_customer_id"),
  identityVerificationStatus: text("identity_verification_status", { enum: ["unverified", "pending", "verified", "failed"] }).default("unverified"),
  identityVerificationSessionId: text("identity_verification_session_id"),
  identityVerifiedAt: timestamp("identity_verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
