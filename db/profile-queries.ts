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

export type PublicArenaMoment = {
  roundId: number;
  roomCode: string;
  matchNumber: number;
  roundNumber: number;
  mode: string;
  prompt: string;
  content: string;
  voteCount: number;
  won: number;
  revealedAt: string;
  intent: string;
  move: string;
  lesson: string;
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

export async function getPublicArenaHistory(handle: string): Promise<PublicArenaMoment[]> {
  const normalized = handle.trim().toLowerCase().replace(/^@/, "");
  if (!normalized) return [];

  const result = await env.DB.prepare(
    `SELECT r.id AS roundId, rm.code AS roomCode,
      r.match_number AS matchNumber, r.round_number AS roundNumber,
      r.mode, r.prompt, s.content, COUNT(v.id) AS voteCount,
      CASE WHEN COUNT(v.id) = (
        SELECT COUNT(v3.id)
        FROM arena_submissions s3
        LEFT JOIN arena_votes v3 ON v3.submission_id = s3.id
        WHERE s3.round_id = r.id
        GROUP BY s3.id
        ORDER BY COUNT(v3.id) DESC
        LIMIT 1
      ) THEN 1 ELSE 0 END AS won,
      COALESCE(r.revealed_at, '') AS revealedAt,
      COALESCE(t.intent, '') AS intent,
      COALESCE(t.move, '') AS move,
      COALESCE(t.lesson, '') AS lesson
     FROM arena_submissions s
     JOIN arena_players p ON p.id = s.player_id
     JOIN arena_rounds r ON r.id = s.round_id
     JOIN arena_rooms rm ON rm.id = r.room_id
     LEFT JOIN arena_votes v ON v.submission_id = s.id
     LEFT JOIN arena_teachbacks t ON t.round_id = r.id AND t.player_id = p.id
     WHERE p.profile_id = (
       SELECT id FROM profiles WHERE handle = ? AND published = 1 LIMIT 1
     ) AND r.status = 'results'
     GROUP BY r.id, rm.code, r.match_number, r.round_number, r.mode, r.prompt,
       s.id, s.content, r.revealed_at, t.intent, t.move, t.lesson
     ORDER BY r.revealed_at DESC, r.id DESC
     LIMIT 50`,
  )
    .bind(normalized)
    .all<PublicArenaMoment>();

  return result.results;
}
