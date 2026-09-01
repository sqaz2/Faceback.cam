import { db } from "../../_shared";

type PublicLobbyRow = {
  code: string;
  phase: "lobby" | "results";
  maxPlayers: number;
  matchFormat: string;
  matchNumber: number;
  hostName: string;
  playerCount: number;
  botCount: number;
  updatedAt: string;
};

export async function GET() {
  try {
    const result = await db()
      .prepare(
        `SELECT r.code, r.phase, r.max_players AS maxPlayers,
          r.match_format AS matchFormat, r.match_number AS matchNumber,
          COALESCE(
            MAX(CASE WHEN p.user_email = r.host_email AND p.active = 1 THEN p.display_name END),
            'FACEBACK Host'
          ) AS hostName,
          COUNT(CASE WHEN p.active = 1 THEN 1 END) AS playerCount,
          COUNT(CASE WHEN p.active = 1 AND p.is_bot = 1 THEN 1 END) AS botCount,
          r.updated_at AS updatedAt
         FROM arena_rooms r
         LEFT JOIN arena_players p ON p.room_id = r.id
         WHERE r.visibility = 'public'
           AND r.phase IN ('lobby', 'results')
           AND r.updated_at >= datetime('now', '-8 hours')
           AND EXISTS (
             SELECT 1 FROM arena_players host
             WHERE host.room_id = r.id AND host.user_email = r.host_email
               AND host.active = 1 AND host.is_bot = 0
               AND host.last_seen_at >= datetime('now', '-150 seconds')
           )
         GROUP BY r.id, r.code, r.phase, r.max_players, r.match_format,
           r.match_number, r.updated_at
         HAVING COUNT(CASE WHEN p.active = 1 THEN 1 END) < r.max_players
         ORDER BY CASE WHEN r.phase = 'lobby' THEN 0 ELSE 1 END,
           r.updated_at DESC
         LIMIT 12`,
      )
      .all<PublicLobbyRow>();

    const response = Response.json({
      rooms: result.results.map((room) => ({
        ...room,
        playerCount: Number(room.playerCount || 0),
        botCount: Number(room.botCount || 0),
        joinUrl: `/arena/${room.code}`,
      })),
    });
    response.headers.set("Cache-Control", "public, max-age=2, stale-while-revalidate=3");
    return response;
  } catch (error) {
    console.error("Unable to list public Arena rooms", error);
    return Response.json({ error: "Unable to load public rooms." }, { status: 500 });
  }
}
