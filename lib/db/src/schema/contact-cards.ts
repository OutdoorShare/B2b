import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const contactCardsTable = pgTable("contact_cards", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  specialInstructions: text("special_instructions"),
  // Rental Preparation Guide
  prepWhatToWear: text("prep_what_to_wear"),
  prepWhatToBring: text("prep_what_to_bring"),
  prepVehicleTowRating: text("prep_vehicle_tow_rating"),
  prepAdditionalTips: text("prep_additional_tips"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ContactCard = typeof contactCardsTable.$inferSelect;
export type InsertContactCard = typeof contactCardsTable.$inferInsert;
