import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const superadminUsersTable = pgTable("superadmin_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: text("role", { enum: ["super_admin", "admin"] }).notNull().default("admin"),
  status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
  notes: text("notes"),
  token: text("token"),
  inviteToken: text("invite_token"),
  inviteExpiresAt: timestamp("invite_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSuperadminUserSchema = createInsertSchema(superadminUsersTable).omit({ id: true, createdAt: true, updatedAt: true, token: true, passwordHash: true });
export type InsertSuperadminUser = z.infer<typeof insertSuperadminUserSchema>;
export type SuperadminUser = typeof superadminUsersTable.$inferSelect;
