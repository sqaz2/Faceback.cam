import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable(
  "profiles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    handle: text("handle").notNull(),
    displayName: text("display_name").notNull(),
    brand: text("brand").notNull().default(""),
    bio: text("bio").notNull().default(""),
    story: text("story").notNull().default(""),
    location: text("location").notNull().default(""),
    websiteUrl: text("website_url").notNull().default(""),
    accent: text("accent").notNull().default("signal"),
    published: integer("published", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("profiles_user_email_unique").on(table.userEmail),
    uniqueIndex("profiles_handle_unique").on(table.handle),
  ],
);

export const works = sqliteTable(
  "works",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    profileId: integer("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    provider: text("provider").notNull().default("Website"),
    category: text("category").notNull().default("Project"),
    note: text("note").notNull().default(""),
    description: text("description").notNull().default(""),
    imageUrl: text("image_url").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("works_profile_sort_idx").on(table.profileId, table.sortOrder)],
);
