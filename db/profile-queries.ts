import { env } from "cloudflare:workers";

export type PublicProfile = {
  id: number;
  handle: string;
  displayName: string;
  brand: string;
  bio: string;
  story: string;
  location: string;
  websiteUrl: string;
  accent: string;
  works: PublicWork[];
};

export type PublicWork = {
  id: number;
  title: string;
  url: string;
  provider: string;
  category: string;
  note: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
};

export async function getPublicProfile(handle: string): Promise<PublicProfile | null> {
  const normalized = handle.trim().toLowerCase().replace(/^@/, "");
  const profile = await env.DB.prepare(
    `SELECT id, handle, display_name AS displayName, brand, bio, story,
      location, website_url AS websiteUrl, accent
     FROM profiles
     WHERE handle = ? AND published = 1
     LIMIT 1`,
  )
    .bind(normalized)
    .first<Omit<PublicProfile, "works">>();

  if (!profile) return null;

  const result = await env.DB.prepare(
    `SELECT id, title, url, provider, category, note, description,
      image_url AS imageUrl, sort_order AS sortOrder
     FROM works
     WHERE profile_id = ?
     ORDER BY sort_order ASC, id ASC`,
  )
    .bind(profile.id)
    .all<PublicWork>();

  return { ...profile, works: result.results };
}
