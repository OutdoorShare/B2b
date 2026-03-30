import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const listingUnitsTable = pgTable("listing_units", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  unitIdentifier: text("unit_identifier").notNull(),
  identifierType: text("identifier_type", { enum: ["vin", "hin", "serial"] }).notNull().default("serial"),
  label: text("label"),
  status: text("status", { enum: ["available", "rented", "maintenance", "retired"] }).notNull().default("available"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertListingUnitSchema = createInsertSchema(listingUnitsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertListingUnit = z.infer<typeof insertListingUnitSchema>;
export type ListingUnit = typeof listingUnitsTable.$inferSelect;
