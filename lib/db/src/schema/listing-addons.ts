import { pgTable, serial, integer, text, decimal, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const listingAddonsTable = pgTable("listing_addons", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
  priceType: text("price_type", { enum: ["flat", "per_day"] }).notNull().default("flat"),
  isRequired: boolean("is_required").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertListingAddonSchema = createInsertSchema(listingAddonsTable).omit({
  id: true, createdAt: true
});
export type InsertListingAddon = z.infer<typeof insertListingAddonSchema>;
export type ListingAddon = typeof listingAddonsTable.$inferSelect;
