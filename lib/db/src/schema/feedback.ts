import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const feedbackTable = pgTable("feedback", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  tenantSlug: text("tenant_slug"),
  tenantName: text("tenant_name"),
  submitterType: text("submitter_type", { enum: ["renter", "admin"] }).notNull(),
  submitterName: text("submitter_name").notNull(),
  submitterEmail: text("submitter_email").notNull(),
  subject: text("subject"),
  message: text("message").notNull(),
  rating: integer("rating"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Feedback = typeof feedbackTable.$inferSelect;
export type InsertFeedback = typeof feedbackTable.$inferInsert;
