import { pgTable, serial, text, boolean, decimal, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const businessProfileTable = pgTable("business_profile", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  name: text("name").notNull().default("My Rental Company"),
  tagline: text("tagline"),
  description: text("description"),
  logoUrl: text("logo_url"),
  coverImageUrl: text("cover_image_url"),
  primaryColor: text("primary_color").notNull().default("#2d6a4f"),
  accentColor: text("accent_color").notNull().default("#52b788"),
  email: text("email"),
  outboundEmail: text("outbound_email"),
  senderEmail: text("sender_email"),
  senderPassword: text("sender_password"),
  phone: text("phone"),
  website: text("website"),
  location: text("location"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country"),
  socialInstagram: text("social_instagram"),
  socialFacebook: text("social_facebook"),
  socialTwitter: text("social_twitter"),
  bundleDiscountPercent: decimal("bundle_discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  depositRequired: boolean("deposit_required").notNull().default(true),
  depositPercent: decimal("deposit_percent", { precision: 5, scale: 2 }).notNull().default("25"),
  cancellationPolicy: text("cancellation_policy").notNull().default("Full refund if cancelled 48 hours before start date."),
  rentalTerms: text("rental_terms"),
  kioskModeEnabled: boolean("kiosk_mode_enabled").notNull().default(false),
  instantBooking: boolean("instant_booking").notNull().default(false),
  embedCode: text("embed_code"),
  lat: decimal("lat", { precision: 10, scale: 6 }),
  lng: decimal("lng", { precision: 10, scale: 6 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBusinessProfileSchema = createInsertSchema(businessProfileTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBusinessProfile = z.infer<typeof insertBusinessProfileSchema>;
export type BusinessProfile = typeof businessProfileTable.$inferSelect;
