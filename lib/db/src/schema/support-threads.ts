import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const supportThreadsTable = pgTable("support_threads", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name").notNull(),
  subject: text("subject"),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  unreadByAdmin: integer("unread_by_admin").notNull().default(0),
  unreadByRenter: integer("unread_by_renter").notNull().default(0),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SupportThread = typeof supportThreadsTable.$inferSelect;
export type InsertSupportThread = typeof supportThreadsTable.$inferInsert;
