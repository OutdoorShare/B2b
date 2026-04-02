import { pgTable, serial, text, integer, decimal, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  categoryId: integer("category_id"),
  name: text("name").notNull(),
  sku: text("sku"),
  description: text("description"),
  status: text("status", {
    enum: ["available", "maintenance", "damaged", "reserved", "out_of_service"],
  }).notNull().default("available"),
  quantity: integer("quantity").notNull().default(1),
  imageUrls: json("image_urls").$type<string[]>().notNull().default([]),
  brand: text("brand"),
  model: text("model"),
  specs: text("specs"),
  notes: text("notes"),
  nextMaintenanceDate: text("next_maintenance_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
