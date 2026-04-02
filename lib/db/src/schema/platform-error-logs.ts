import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const platformErrorLogsTable = pgTable("platform_error_logs", {
  id: serial("id").primaryKey(),
  level: text("level").notNull().default("error"),
  method: text("method"),
  path: text("path"),
  statusCode: integer("status_code"),
  message: text("message"),
  stack: text("stack"),
  tenantSlug: text("tenant_slug"),
  userAgent: text("user_agent"),
  ip: text("ip"),
  responseTimeMs: integer("response_time_ms"),
  body: text("body"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlatformErrorLog = typeof platformErrorLogsTable.$inferSelect;
