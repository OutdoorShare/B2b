import { pgTable, serial, integer, text, boolean, timestamp, json } from "drizzle-orm/pg-core";

export const memoriesTable = pgTable("memories", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  customerName: text("customer_name").notNull(),
  photoUrls: json("photo_urls").$type<string[]>().notNull().default([]),
  caption: text("caption"),
  taggedTenantId: integer("tagged_tenant_id"),
  taggedTenantName: text("tagged_tenant_name"),
  taggedTenantSlug: text("tagged_tenant_slug"),
  isPublic: boolean("is_public").notNull().default(true),
  locationLat: text("location_lat"),
  locationLng: text("location_lng"),
  locationName: text("location_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
