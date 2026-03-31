import { pgTable, serial, integer, text, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const listingRulesTable = pgTable("listing_rules", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  tenantId: integer("tenant_id"),
  title: text("title").notNull(),
  description: text("description"),
  fee: decimal("fee", { precision: 10, scale: 2 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertListingRuleSchema = createInsertSchema(listingRulesTable).omit({
  id: true, createdAt: true
});
export type InsertListingRule = z.infer<typeof insertListingRuleSchema>;
export type ListingRule = typeof listingRulesTable.$inferSelect;
