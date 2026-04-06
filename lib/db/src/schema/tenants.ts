import { pgTable, serial, text, integer, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tenantsTable = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  email: text("email").notNull().unique(),
  adminPasswordHash: text("admin_password_hash").notNull(),
  plan: text("plan", { enum: ["starter", "professional", "enterprise"] }).notNull().default("starter"),
  status: text("status", { enum: ["active", "inactive", "suspended"] }).notNull().default("active"),
  maxListings: integer("max_listings").notNull().default(10),
  contactName: text("contact_name"),
  phone: text("phone"),
  notes: text("notes"),
  adminToken: text("admin_token"),
  trialEndsAt: timestamp("trial_ends_at"),
  stripeAccountId: text("stripe_account_id"),
  stripeAccountStatus: text("stripe_account_status", { enum: ["pending", "onboarding", "active", "restricted"] }),
  stripeChargesEnabled: boolean("stripe_charges_enabled").default(false),
  stripePayoutsEnabled: boolean("stripe_payouts_enabled").default(false),
  platformFeePercent: numeric("platform_fee_percent", { precision: 5, scale: 2 }).default("5.00"),
  testMode: boolean("test_mode").default(false),
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionId: text("subscription_id"),
  subscriptionStatus: text("subscription_status"),
  currentPeriodEnd: timestamp("current_period_end"),
  stripeRestrictedAlertSentAt: timestamp("stripe_restricted_alert_sent_at"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpiresAt: timestamp("email_verification_expires_at"),
  isHost: boolean("is_host").default(false).notNull(),
  hostCustomerId: integer("host_customer_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTenantSchema = createInsertSchema(tenantsTable).omit({
  id: true, createdAt: true, updatedAt: true, adminPasswordHash: true,
}).extend({ password: z.string().min(6) });

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenantsTable.$inferSelect;
