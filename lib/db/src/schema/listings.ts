import { pgTable, serial, text, integer, decimal, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type HourlySlot = { label: string; hours: number; price: number };
export type TimeSlot = { label: string; startTime: string; endTime: string; rate: "full_day" | "half_day" };

export const listingsTable = pgTable("listings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  categoryId: integer("category_id"),
  status: text("status", { enum: ["active", "inactive", "draft"] }).notNull().default("active"),
  pricePerDay: decimal("price_per_day", { precision: 10, scale: 2 }).notNull(),
  weekendPrice: decimal("weekend_price", { precision: 10, scale: 2 }),
  holidayPrice: decimal("holiday_price", { precision: 10, scale: 2 }),
  pricePerWeek: decimal("price_per_week", { precision: 10, scale: 2 }),
  pricePerHour: decimal("price_per_hour", { precision: 10, scale: 2 }),
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),
  halfDayEnabled: boolean("half_day_enabled").notNull().default(false),
  halfDayDurationHours: integer("half_day_duration_hours"),
  halfDayRate: decimal("half_day_rate", { precision: 10, scale: 2 }),
  hourlyEnabled: boolean("hourly_enabled").notNull().default(false),
  hourlySlots: json("hourly_slots").$type<HourlySlot[]>(),
  hourlyPerHourEnabled: boolean("hourly_per_hour_enabled").notNull().default(false),
  hourlyMinimumHours: integer("hourly_minimum_hours"),
  // Fixed time slots — if any are defined, renter must pick one
  timeSlots: json("time_slots").$type<TimeSlot[]>(),
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
  productId: integer("product_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertListingSchema = createInsertSchema(listingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listingsTable.$inferSelect;
