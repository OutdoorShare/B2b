import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const operatorAcknowledgementsTable = pgTable("operator_acknowledgements", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  // null = applies to all contracts for this tenant; set = attached to a specific contract
  contractId: integer("contract_id"),
  text: text("text").notNull(),
  required: boolean("required").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type OperatorAcknowledgement = typeof operatorAcknowledgementsTable.$inferSelect;
export type NewOperatorAcknowledgement = typeof operatorAcknowledgementsTable.$inferInsert;
