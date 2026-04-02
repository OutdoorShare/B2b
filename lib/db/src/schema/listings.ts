import { pgTable, serial, text, integer, decimal, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const listingsTable = pgTable("listings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  categoryId: integer("category_id"),
  status: text("status", { enum: ["active", "inactive", "draft"] }).notNull().default("active"),
  pricePerDay: decimal("price_per_day", { precision: 10, scale: 2 }).notNull(),
  pricePerWeek: decimal("price_per_week", { precision: 10, scale: 2 }),
  pricePerHour: decimal("price_per_hour", { precision: 10, scale: 2 }),
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),
  quantity: integer("quantity").notNull().default(1),
  imageUrls: json("image_urls").$type<string[]>().notNull().default([]),
  location: text("location"),
  weight: text("weight"),
  dimensions: text("dimensions"),
  brand: text("brand"),
  model: text("model"),
  condition: text("condition", { enum: ["excellent", "good", "fair"] }),
  includedItems: json("included_items").$type<string[]>().notNull().default([]),
  requirements: text("requirements"),
  ageRestriction: integer("age_restriction"),
  contactCardId: integer("contact_card_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertListingSchema = createInsertSchema(listingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listingsTable.$inferSelect;
