import { pgTable, serial, text, integer, decimal, boolean, timestamp, json } from "drizzle-orm/pg-core";

export const activitiesTable = pgTable("activities", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("adventure"),
  pricePerPerson: decimal("price_per_person", { precision: 10, scale: 2 }).notNull().default("0"),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  maxCapacity: integer("max_capacity").notNull().default(10),
  location: text("location").notNull().default(""),
  imageUrls: json("image_urls").$type<string[]>().notNull().default([]),
  highlights: json("highlights").$type<string[]>().notNull().default([]),
  whatToBring: text("what_to_bring").notNull().default(""),
  minAge: integer("min_age"),
  isActive: boolean("is_active").notNull().default(true),
  listingId: integer("listing_id"),
  requiresRental: boolean("requires_rental").notNull().default(false),
  scheduleMode: text("schedule_mode").notNull().default("open"),
  recurringSlots: json("recurring_slots").$type<Array<{ dayOfWeek: number; times: string[] }>>().notNull().default([]),
  specificSlots: json("specific_slots").$type<Array<{ date: string; times: string[] }>>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Activity = typeof activitiesTable.$inferSelect;
export type NewActivity = typeof activitiesTable.$inferInsert;
