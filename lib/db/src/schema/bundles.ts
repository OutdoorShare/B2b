import { pgTable, serial, text, boolean, decimal, timestamp, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hostBundlesTable = pgTable("host_bundles", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  pricePerDay: decimal("price_per_day", { precision: 10, scale: 2 }).notNull().default("0"),
  listingIds: json("listing_ids").$type<number[]>().notNull().default([]),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertHostBundleSchema = createInsertSchema(hostBundlesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHostBundle = z.infer<typeof insertHostBundleSchema>;
export type HostBundle = typeof hostBundlesTable.$inferSelect;
