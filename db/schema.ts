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

export const gameRooms = sqliteTable(
  "game_rooms",
  {
    code: text("code").primaryKey(),
    hostEmail: text("host_email").notNull(),
    status: text("status").notNull().default("lobby"),
    maxPlayers: integer("max_players").notNull().default(6),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    startedAt: text("started_at"),
  },
  (table) => [index("game_rooms_host_created_idx").on(table.hostEmail, table.createdAt)],
);

export const gamePlayers = sqliteTable(
  "game_players",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    roomCode: text("room_code")
      .notNull()
      .references(() => gameRooms.code, { onDelete: "cascade" }),
    userEmail: text("user_email").notNull(),
    displayName: text("display_name").notNull(),
    handle: text("handle").notNull().default(""),
    seat: integer("seat").notNull(),
    ready: integer("ready", { mode: "boolean" }).notNull().default(false),
    joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("game_players_room_user_unique").on(table.roomCode, table.userEmail),
    uniqueIndex("game_players_room_seat_unique").on(table.roomCode, table.seat),
    index("game_players_room_seen_idx").on(table.roomCode, table.lastSeenAt),
  ],
);
