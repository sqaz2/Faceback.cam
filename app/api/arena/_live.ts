import { db } from "../_shared";
import { TEAM_SIGNAL, TEAM_STATIC, type MatchFormat, type TeamId } from "../../arena/match-config";

type LiveRoomRow = {
  id: number;
  phase: "lobby" | "answering" | "voting" | "results";
  roundNumber: number;
  matchNumber: number;
  matchLength: number;
  matchFormat: MatchFormat;
  matchStatus: "setup" | "active" | "finished";
  signalScore: number;
  staticScore: number;
  voteSeconds: number;
};

type LiveRoundRow = {
  id: number;
  status: string;
  answerDeadlineAt: string | null;
  voteDeadlineAt: string | null;
};

type VoteRow = {
  playerId: number;
  team: string;
  voteCount: number;
};

export function deadlineAfter(seconds: number) {
  return new Date(Date.now() + Math.max(1, seconds) * 1000).toISOString();
}

export async function reconcileArenaRoom(roomId: number) {
  const room = await getLiveRoom(roomId);
  if (!room || room.roundNumber < 1) return;
  const round = await getLiveRound(room.id, room.matchNumber, room.roundNumber);
  if (!round) return;

  if (room.phase === "answering" && round.status === "answering" && isPast(round.answerDeadlineAt)) {
    const submissions = await countRows("arena_submissions", "round_id", round.id);
    if (submissions >= 2) {
      const voteDeadline = deadlineAfter(room.voteSeconds);
      const result = await db()
        .prepare(
          `UPDATE arena_rounds
           SET status = 'voting', voting_opened_at = COALESCE(voting_opened_at, CURRENT_TIMESTAMP),
             vote_deadline_at = ?
           WHERE id = ? AND status = 'answering'`,
        )
        .bind(voteDeadline, round.id)
        .run();
      if (Number(result.meta?.changes || 0) > 0) {
        await db()
          .prepare("UPDATE arena_rooms SET phase = 'voting', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(room.id)
          .run();
      }
    }
    return;
  }

  if (room.phase === "voting" && round.status === "voting" && isPast(round.voteDeadlineAt)) {
    const votes = await countRows("arena_votes", "round_id", round.id);
    if (votes >= 1) await revealArenaRound(room.id, round.id);
  }
}

export async function revealArenaRound(roomId: number, roundId: number) {
  const room = await getLiveRoom(roomId);
  if (!room || room.phase !== "voting") return { revealed: false, reason: "not-voting" } as const;

  const rows = await voteRows(roundId);
  const totalVotes = rows.reduce((sum, entry) => sum + Number(entry.voteCount || 0), 0);
  if (totalVotes < 1) return { revealed: false, reason: "no-votes" } as const;

  const claim = await db()
    .prepare("UPDATE arena_rounds SET status = 'revealing' WHERE id = ? AND status = 'voting'")
    .bind(roundId)
    .run();
  if (Number(claim.meta?.changes || 0) < 1) {
    return { revealed: false, reason: "already-revealing" } as const;
  }

  try {
    const top = Math.max(...rows.map((entry) => Number(entry.voteCount || 0)));
    const winnerRows = rows.filter((entry) => Number(entry.voteCount || 0) === top);
    const winnerIds = [...new Set(winnerRows.map((entry) => entry.playerId))];
    for (const playerId of winnerIds) {
      await db().prepare("UPDATE arena_players SET score = score + 1 WHERE id = ?").bind(playerId).run();
    }

    const teams = room.matchFormat === "TEAMS"
      ? [...new Set(winnerRows.map((entry) => entry.team).filter(isTeamId))]
      : [];
    const signalGain = teams.includes(TEAM_SIGNAL) ? 1 : 0;
    const staticGain = teams.includes(TEAM_STATIC) ? 1 : 0;
    const winningTeam = teams.length === 1 ? teams[0] : teams.length > 1 ? "TIE" : "";
    const isFinalRound = room.roundNumber >= room.matchLength;

    await db()
      .prepare(
        `UPDATE arena_rounds
         SET status = 'results', winning_team = ?, revealed_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'revealing'`,
      )
      .bind(winningTeam, roundId)
      .run();
    await db()
      .prepare(
        `UPDATE arena_rooms
         SET phase = 'results', signal_score = signal_score + ?,
           static_score = static_score + ?, match_status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(signalGain, staticGain, isFinalRound ? "finished" : "active", room.id)
      .run();

    return { revealed: true, matchFinished: isFinalRound } as const;
  } catch (error) {
    await db()
      .prepare("UPDATE arena_rounds SET status = 'voting' WHERE id = ? AND status = 'revealing'")
      .bind(roundId)
      .run();
    throw error;
  }
}

async function getLiveRoom(roomId: number) {
  return db()
    .prepare(
      `SELECT id, phase, round_number AS roundNumber, match_number AS matchNumber,
        match_length AS matchLength, match_format AS matchFormat,
        match_status AS matchStatus, signal_score AS signalScore,
        static_score AS staticScore, vote_seconds AS voteSeconds
       FROM arena_rooms WHERE id = ? LIMIT 1`,
    )
    .bind(roomId)
    .first<LiveRoomRow>();
}

async function getLiveRound(roomId: number, matchNumber: number, roundNumber: number) {
  return db()
    .prepare(
      `SELECT id, status, answer_deadline_at AS answerDeadlineAt,
        vote_deadline_at AS voteDeadlineAt
       FROM arena_rounds
       WHERE room_id = ? AND match_number = ? AND round_number = ? LIMIT 1`,
    )
    .bind(roomId, matchNumber, roundNumber)
    .first<LiveRoundRow>();
}

async function voteRows(roundId: number) {
  const result = await db()
    .prepare(
      `SELECT s.player_id AS playerId, p.team AS team, COUNT(v.id) AS voteCount
       FROM arena_submissions s
       JOIN arena_players p ON p.id = s.player_id
       LEFT JOIN arena_votes v ON v.submission_id = s.id
       WHERE s.round_id = ?
       GROUP BY s.id, s.player_id, p.team`,
    )
    .bind(roundId)
    .all<VoteRow>();
  return result.results;
}

async function countRows(table: "arena_submissions" | "arena_votes", column: "round_id", id: number) {
  const row = await db()
    .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = ?`)
    .bind(id)
    .first<{ count: number }>();
  return Number(row?.count || 0);
}

function isPast(value: string | null) {
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && time <= Date.now();
}

function isTeamId(value: string): value is TeamId {
  return value === TEAM_SIGNAL || value === TEAM_STATIC;
}
