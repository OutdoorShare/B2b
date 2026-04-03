import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const supportMessagesTable = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull(),
  senderType: text("sender_type", { enum: ["admin", "renter"] }).notNull(),
  senderName: text("sender_name").notNull(),
  body: text("body").notNull(),
  isReadByAdmin: boolean("is_read_by_admin").notNull().default(false),
  isReadByRenter: boolean("is_read_by_renter").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SupportMessage = typeof supportMessagesTable.$inferSelect;
export type InsertSupportMessage = typeof supportMessagesTable.$inferInsert;
