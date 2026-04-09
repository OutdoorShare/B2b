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

export const activityBookingsTable = pgTable("activity_bookings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  activityId: integer("activity_id").notNull(),
  activityTitle: text("activity_title").notNull().default(""),
  activityPricePerPerson: decimal("activity_price_per_person", { precision: 10, scale: 2 }).notNull().default("0"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  selectedDate: text("selected_date"),
  selectedTime: text("selected_time"),
  guestCount: integer("guest_count").notNull().default(1),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status", { enum: ["pending", "confirmed", "active", "completed", "cancelled"] })
    .notNull()
    .default("pending"),
  notes: text("notes"),
  adminNotes: text("admin_notes"),
  seenByAdmin: boolean("seen_by_admin").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ActivityBooking = typeof activityBookingsTable.$inferSelect;
export type NewActivityBooking = typeof activityBookingsTable.$inferInsert;
