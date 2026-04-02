import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const contactCardsTable = pgTable("contact_cards", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  specialInstructions: text("special_instructions"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ContactCard = typeof contactCardsTable.$inferSelect;
export type InsertContactCard = typeof contactCardsTable.$inferInsert;
