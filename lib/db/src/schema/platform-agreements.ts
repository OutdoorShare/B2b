import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Platform Agreements ───────────────────────────────────────────────────────
// SuperAdmin-managed documents that are injected into every renter's signing flow.
// Each agreement has a checkboxLabel (what the renter sees) and a full content
// body (what is embedded in the generated PDF).
// Supports {{placeholder}} tokens — see resolveAgreementTokens() in the API.
export const platformAgreementsTable = pgTable("platform_agreements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  checkboxLabel: text("checkbox_label").notNull().default("I agree to the terms and conditions"),
  isRequired: boolean("is_required").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlatformAgreementSchema = createInsertSchema(platformAgreementsTable, {
  title: z.string().min(1),
  content: z.string(),
  checkboxLabel: z.string().min(1),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export type PlatformAgreement = typeof platformAgreementsTable.$inferSelect;
export type NewPlatformAgreement = typeof platformAgreementsTable.$inferInsert;
