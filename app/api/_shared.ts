import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../chatgpt-auth";

export const RESERVED_HANDLES = new Set([
  "api",
  "join",
  "play",
  "studio",
  "signin-with-chatgpt",
  "signout-with-chatgpt",
  "callback",
  "admin",
  "support",
  "faceback",
]);

export async function requireApiUser() {
  const user = await getChatGPTUser();
  if (!user) return null;
  return user;
}

export function db() {
  if (!env.DB) throw new Error("Creator storage is not available.");
  return env.DB;
}

export function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function normalizeHandle(value: unknown) {
  return cleanText(value, 32).toLowerCase().replace(/^@/, "");
}

export function validHandle(handle: string) {
  return /^[a-z0-9][a-z0-9-]{2,29}$/.test(handle) && !RESERVED_HANDLES.has(handle);
}

export function validPublicUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export type OwnedProfile = {
  id: number;
  handle: string;
  displayName: string;
  brand: string;
  bio: string;
  story: string;
  location: string;
  websiteUrl: string;
  accent: string;
  published: number;
};

export async function getOwnedProfile(email: string) {
  return db()
    .prepare(
      `SELECT id, handle, display_name AS displayName, brand, bio, story,
        location, website_url AS websiteUrl, accent, published
       FROM profiles
       WHERE user_email = ?
       LIMIT 1`,
    )
    .bind(email)
    .first<OwnedProfile>();
}

export async function getOwnedWorks(profileId: number) {
  return db()
    .prepare(
      `SELECT id, title, url, provider, category, note, description,
        image_url AS imageUrl, sort_order AS sortOrder
       FROM works
       WHERE profile_id = ?
       ORDER BY sort_order ASC, id ASC`,
    )
    .bind(profileId)
    .all();
}
