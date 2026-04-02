import { pgTable, serial, text, integer, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const maintenanceLogsTable = pgTable("maintenance_logs", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  tenantId: integer("tenant_id"),
  type: text("type", {
    enum: ["scheduled", "repair", "inspection", "cleaning", "other"],
  }).notNull().default("other"),
  performedBy: text("performed_by"),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  description: text("description").notNull(),
  dateCompleted: text("date_completed"),
  nextDue: text("next_due"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMaintenanceLogSchema = createInsertSchema(maintenanceLogsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMaintenanceLog = z.infer<typeof insertMaintenanceLogSchema>;
export type MaintenanceLog = typeof maintenanceLogsTable.$inferSelect;
