import { pgTable, serial, text, boolean, decimal, timestamp } from "drizzle-orm/pg-core";

export const platformProtectionPlansTable = pgTable("platform_protection_plans", {
  id: serial("id").primaryKey(),
  categorySlug: text("category_slug").notNull().unique(),
  categoryName: text("category_name").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  feeAmount: decimal("fee_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PlatformProtectionPlan = typeof platformProtectionPlansTable.$inferSelect;
