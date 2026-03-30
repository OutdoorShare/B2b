import { pgTable, serial, text, boolean, decimal, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const businessProfileTable = pgTable("business_profile", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  name: text("name").notNull().default("My Rental Company"),
  tagline: text("tagline").notNull().default("Quality gear for your next adventure"),
  description: text("description").notNull().default("We provide top-quality rental gear for outdoor adventures."),
  logoUrl: text("logo_url"),
  coverImageUrl: text("cover_image_url"),
  primaryColor: text("primary_color").notNull().default("#2d6a4f"),
  accentColor: text("accent_color").notNull().default("#52b788"),
  email: text("email").notNull().default("hello@myrental.com"),
  phone: text("phone").notNull().default("(555) 000-0000"),
  website: text("website"),
  location: text("location").notNull().default("Your City, State"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country"),
  socialInstagram: text("social_instagram"),
  socialFacebook: text("social_facebook"),
  socialTwitter: text("social_twitter"),
  depositRequired: boolean("deposit_required").notNull().default(true),
  depositPercent: decimal("deposit_percent", { precision: 5, scale: 2 }).notNull().default("25"),
  cancellationPolicy: text("cancellation_policy").notNull().default("Full refund if cancelled 48 hours before start date."),
  rentalTerms: text("rental_terms"),
  kioskModeEnabled: boolean("kiosk_mode_enabled").notNull().default(false),
  embedCode: text("embed_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBusinessProfileSchema = createInsertSchema(businessProfileTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBusinessProfile = z.infer<typeof insertBusinessProfileSchema>;
export type BusinessProfile = typeof businessProfileTable.$inferSelect;
