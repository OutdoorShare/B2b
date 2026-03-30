import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tenantsTable = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  email: text("email").notNull().unique(),
  adminPasswordHash: text("admin_password_hash").notNull(),
  plan: text("plan", { enum: ["starter", "professional", "enterprise"] }).notNull().default("starter"),
  status: text("status", { enum: ["active", "inactive", "suspended"] }).notNull().default("active"),
  maxListings: integer("max_listings").notNull().default(10),
  contactName: text("contact_name"),
  phone: text("phone"),
  notes: text("notes"),
  adminToken: text("admin_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTenantSchema = createInsertSchema(tenantsTable).omit({
  id: true, createdAt: true, updatedAt: true, adminPasswordHash: true,
}).extend({ password: z.string().min(6) });

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenantsTable.$inferSelect;
