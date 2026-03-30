import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const blockedDatesTable = pgTable("blocked_dates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  listingId: integer("listing_id"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BlockedDate = typeof blockedDatesTable.$inferSelect;
