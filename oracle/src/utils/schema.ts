import {
  pgTable,
  text,
  numeric,
  integer,
  timestamp,
  serial,
} from "drizzle-orm/pg-core";

export const places = pgTable("places", {
  place_id: text("place_id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  photo_url: text("photo_url"),
  city: text("city").notNull(),
  category: text("category").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const placeSnapshots = pgTable("place_snapshots", {
  id: serial("id").primaryKey(),
  place_id: text("place_id")
    .notNull()
    .references(() => places.place_id),
  rating: numeric("rating", { precision: 3, scale: 2 }).notNull(),
  review_count: integer("review_count").notNull(),
  fetched_at: timestamp("fetched_at", { withTimezone: true }).defaultNow(),
});
