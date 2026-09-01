import { db } from "../../_shared";
import { reconcileArenaRoom } from "../_live";
import { normalizeArenaRoomCode } from "../../../arena/room-code";

type PublicRoom = {
  id: number;
  code: string;
  phase: "lobby" | "answering" | "voting" | "results";
  roundNumber: number;
  matchLength: number;
  matchFormat: string;
  rotationMode: string;
  matchStatus: string;
  matchNumber: number;
  signalScore: number;
  staticScore: number;
  timerPreset: string;
};

type PublicRound = {
  id: number;
  roundNumber: number;
  mode: string;
  prompt: string;
  winningTeam: string;
  answerDeadlineAt: string | null;
  voteDeadlineAt: string | null;
};

type PublicPlayer = {
  id: number;
  displayName: string;
  profileHandle: string;
  score: number;
  team: string;
};

type PublicSubmission = {
  id: number;
  playerId: number;
  content: string;
  author: string;
  profileHandle: string;
  team: string;
  voteCount: number;
};

type PublicTeachback = {
  playerId: number;
  intent: string;
  move: string;
  lesson: string;
};

export async function GET(request: Request) {
  try {
    const code = normalizeCode(new URL(request.url).searchParams.get("code"));
    if (!code) return Response.json({ error: "Room code required" }, { status: 400 });

    let room = await getRoom(code);
    if (!room) return Response.json({ error: "Live room not found" }, { status: 404 });
    await reconcileArenaRoom(room.id);
    room = (await getRoom(code)) ?? room;

    const players = await playerRows(room.id);
    const round = await currentRound(room);
    const history = await roundHistory(room.id, room.matchNumber);
    let submissions: Array<Record<string, unknown>> = [];
    let winners: Array<Record<string, unknown>> = [];
    let counts = { submissions: 0, votes: 0 };

    if (round) {
      const rows = await submissionRows(round.id);
      counts = {
        submissions: rows.length,
        votes: rows.reduce((sum, row) => sum + Number(row.voteCount || 0), 0),
      };

      if (room.phase === "voting") {
        submissions = rows.map((row) => ({ id: row.id, content: row.content }));
      }

      if (room.phase === "results") {
        submissions = rows.map((row) => ({
          id: row.id,
          content: row.content,
          author: row.author,
          profileHandle: row.profileHandle,
          team: row.team,
          voteCount: Number(row.voteCount || 0),
        }));
        if (rows.length > 0) {
          const top = Math.max(...rows.map((row) => Number(row.voteCount || 0)));
          const teachbacks = await teachbackRows(round.id);
          const byPlayer = new Map(teachbacks.map((row) => [row.playerId, row]));
          winners = rows
            .filter((row) => Number(row.voteCount || 0) === top)
            .map((row) => {
              const teachback = byPlayer.get(row.playerId);
              return {
                id: row.id,
                content: row.content,
                author: row.author,
                profileHandle: row.profileHandle,
                team: row.team,
                voteCount: Number(row.voteCount || 0),
                teachback: teachback
                  ? { intent: teachback.intent, move: teachback.move, lesson: teachback.lesson }
                  : null,
              };
            });
        }
      }
    }

    const response = Response.json({
      serverNow: new Date().toISOString(),
      room: {
        code: room.code,
        phase: room.phase,
        roundNumber: room.roundNumber,
        matchLength: room.matchLength,
        matchFormat: room.matchFormat,
        rotationMode: room.rotationMode,
        matchStatus: room.matchStatus,
        matchNumber: room.matchNumber,
        matchFinished: room.matchStatus === "finished",
        timerPreset: room.timerPreset,
        teamScores: { signal: room.signalScore, static: room.staticScore },
      },
      players: players.map((player) => ({
        id: player.id,
        displayName: player.displayName,
        profileHandle: player.profileHandle,
        score: player.score,
        team: player.team,
      })),
      round,
      roundHistory: history,
      submissions,
      winners,
      counts: { players: players.length, ...counts },
    });
    response.headers.set("Cache-Control", "public, max-age=0, no-store");
    return response;
  } catch (error) {
    console.error("Unable to load live Arena room", error);
    return Response.json({ error: "Unable to load live Arena room" }, { status: 500 });
  }
}

async function getRoom(code: string) {
  return db()
    .prepare(
      `SELECT id, code, phase, round_number AS roundNumber,
        match_length AS matchLength, match_format AS matchFormat,
        rotation_mode AS rotationMode, match_status AS matchStatus,
        match_number AS matchNumber, signal_score AS signalScore,
        static_score AS staticScore, timer_preset AS timerPreset
       FROM arena_rooms WHERE code = ? LIMIT 1`,
    )
    .bind(code)
    .first<PublicRoom>();
}

async function currentRound(room: PublicRoom) {
  if (room.roundNumber < 1) return null;
  return db()
    .prepare(
      `SELECT id, round_number AS roundNumber, mode, prompt,
        winning_team AS winningTeam, answer_deadline_at AS answerDeadlineAt,
        vote_deadline_at AS voteDeadlineAt
       FROM arena_rounds
       WHERE room_id = ? AND match_number = ? AND round_number = ? LIMIT 1`,
    )
    .bind(room.id, room.matchNumber, room.roundNumber)
    .first<PublicRound>();
}

async function playerRows(roomId: number) {
  const result = await db()
    .prepare(
      `SELECT p.id, p.display_name AS displayName,
        CASE WHEN pr.published = 1 THEN pr.handle ELSE '' END AS profileHandle,
        p.score, p.team
       FROM arena_players p
       LEFT JOIN profiles pr ON pr.id = p.profile_id
       WHERE p.room_id = ? AND p.active = 1
       ORDER BY p.score DESC, p.joined_at ASC`,
    )
    .bind(roomId)
    .all<PublicPlayer>();
  return result.results;
}

async function submissionRows(roundId: number) {
  const result = await db()
    .prepare(
      `SELECT s.id, s.player_id AS playerId, s.content,
        COALESCE(NULLIF(p.display_name, ''), 'FACEBACK Guest') AS author,
        CASE WHEN pr.published = 1 THEN pr.handle ELSE '' END AS profileHandle,
        p.team AS team, COUNT(v.id) AS voteCount
       FROM arena_submissions s
       JOIN arena_players p ON p.id = s.player_id
       LEFT JOIN profiles pr ON pr.id = p.profile_id
       LEFT JOIN arena_votes v ON v.submission_id = s.id
       WHERE s.round_id = ?
       GROUP BY s.id, s.player_id, s.content, p.display_name, pr.handle, pr.published, p.team
       ORDER BY s.id ASC`,
    )
    .bind(roundId)
    .all<PublicSubmission>();
  return result.results;
}

async function teachbackRows(roundId: number) {
  const result = await db()
    .prepare(
      `SELECT player_id AS playerId, intent, move, lesson
       FROM arena_teachbacks WHERE round_id = ? ORDER BY id ASC`,
    )
    .bind(roundId)
    .all<PublicTeachback>();
  return result.results;
}

async function roundHistory(roomId: number, matchNumber: number) {
  const result = await db()
    .prepare(
      `SELECT round_number AS roundNumber, mode, winning_team AS winningTeam
       FROM arena_rounds
       WHERE room_id = ? AND match_number = ? AND status = 'results'
       ORDER BY round_number ASC`,
    )
    .bind(roomId, matchNumber)
    .all<{ roundNumber: number; mode: string; winningTeam: string }>();
  return result.results;
}

function normalizeCode(value: string | null) {
  return normalizeArenaRoomCode(value);
}
