import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const customerFavoritesTable = pgTable(
  "customer_favorites",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").notNull(),
    listingId: integer("listing_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.customerId, t.listingId)],
);

export type CustomerFavorite = typeof customerFavoritesTable.$inferSelect;
