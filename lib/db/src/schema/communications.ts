import { pgTable, serial, text, boolean, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const messageLogs = pgTable("message_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  bookingId: integer("booking_id"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  channel: text("channel", { enum: ["email", "sms", "both"] }).notNull().default("email"),
  subject: text("subject"),
  body: text("body").notNull(),
  trigger: text("trigger").notNull(),
  status: text("status", { enum: ["sent", "failed", "simulated"] }).notNull().default("simulated"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export const automationSettings = pgTable("automation_settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  trigger: text("trigger").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  smsEnabled: boolean("sms_enabled").notNull().default(false),
  subject: text("subject").notNull(),
  bodyTemplate: text("body_template").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type MessageLog = typeof messageLogs.$inferSelect;
export type AutomationSetting = typeof automationSettings.$inferSelect;
