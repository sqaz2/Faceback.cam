import { db } from "../_shared";
import { chooseCpuVote, cpuTeachback } from "../../arena/bots";
import { isGameModeId, type GameModeId } from "../../arena/game-modes";
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
  prompt: string;
  mode: GameModeId;
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

  if (room.phase === "answering" && round.status === "voting") {
    await db()
      .prepare("UPDATE arena_rooms SET phase = 'voting', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND phase = 'answering'")
      .bind(room.id)
      .run();
    await castCpuVotes(room.id, round);
    return;
  }

  if (room.phase === "answering" && round.status === "answering" && isPast(round.answerDeadlineAt)) {
    const submissions = await countRows("arena_submissions", "round_id", round.id);
    if (submissions >= 2) {
      const voteDeadline = deadlineAfter(room.voteSeconds);
      await db().batch([
        db()
          .prepare(
            `UPDATE arena_rounds
             SET status = 'voting', voting_opened_at = COALESCE(voting_opened_at, CURRENT_TIMESTAMP),
               vote_deadline_at = ?
             WHERE id = ? AND status = 'answering'`,
          )
          .bind(voteDeadline, round.id),
        db()
          .prepare(
            `UPDATE arena_rooms
             SET phase = 'voting', updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND EXISTS (
               SELECT 1 FROM arena_rounds WHERE id = ? AND status = 'voting'
             )`,
          )
          .bind(room.id, round.id),
      ]);
      await castCpuVotes(room.id, round);
    }
    return;
  }

  if (room.phase === "voting" && round.status === "revealing") {
    await revealArenaRound(room.id, round.id);
    return;
  }

  if (room.phase === "voting" && round.status === "voting" && isPast(round.voteDeadlineAt)) {
    await castCpuVotes(room.id, round);
    const votes = await countRows("arena_votes", "round_id", round.id);
    if (votes >= 1) await revealArenaRound(room.id, round.id);
  } else if (room.phase === "voting" && round.status === "voting") {
    await castCpuVotes(room.id, round);
  }
}

export async function revealArenaRound(roomId: number, roundId: number) {
  const room = await getLiveRoom(roomId);
  if (!room || room.phase !== "voting") return { revealed: false, reason: "not-voting" } as const;

  const claim = await db()
    .prepare(
      `UPDATE arena_rounds
       SET status = 'revealing'
       WHERE id = ? AND room_id = ? AND status = 'voting'
         AND EXISTS (SELECT 1 FROM arena_votes WHERE round_id = ?)`,
    )
    .bind(roundId, roomId, roundId)
    .run();
  if (Number(claim.meta?.changes || 0) < 1) {
    const current = await db()
      .prepare("SELECT status FROM arena_rounds WHERE id = ? AND room_id = ? LIMIT 1")
      .bind(roundId, roomId)
      .first<{ status: string }>();
    if (current?.status === "results") {
      return { revealed: false, reason: "already-revealed" } as const;
    }
    if (current?.status !== "revealing") {
      return { revealed: false, reason: current?.status === "voting" ? "no-votes" : "not-voting" } as const;
    }
  }

  const rows = await voteRows(roundId);
  const totalVotes = rows.reduce((sum, entry) => sum + Number(entry.voteCount || 0), 0);
  if (totalVotes < 1) {
    await db()
      .prepare("UPDATE arena_rounds SET status = 'voting' WHERE id = ? AND status = 'revealing'")
      .bind(roundId)
      .run();
    return { revealed: false, reason: "no-votes" } as const;
  }

  const top = Math.max(...rows.map((entry) => Number(entry.voteCount || 0)));
  const winnerRows = rows.filter((entry) => Number(entry.voteCount || 0) === top);
  const winnerIds = [...new Set(winnerRows.map((entry) => entry.playerId))];
  const round = await db()
    .prepare("SELECT mode FROM arena_rounds WHERE id = ? AND room_id = ? LIMIT 1")
    .bind(roundId, roomId)
    .first<{ mode: string }>();
  const mode = round && isGameModeId(round.mode) ? round.mode : "PUNCHLINE";
  const cpuRows = await db()
    .prepare("SELECT id, bot_key AS botKey FROM arena_players WHERE room_id = ? AND is_bot = 1")
    .bind(roomId)
    .all<{ id: number; botKey: string }>();
  const cpuById = new Map(cpuRows.results.map((entry) => [entry.id, entry.botKey]));
  const teams = room.matchFormat === "TEAMS"
    ? [...new Set(winnerRows.map((entry) => entry.team).filter(isTeamId))]
    : [];
  const winningTeam = teams.length === 1 ? teams[0] : teams.length > 1 ? "TIE" : "";
  const isFinalRound = room.roundNumber >= room.matchLength;
  const awardStatements = winnerIds.map((playerId) =>
    db()
      .prepare("INSERT OR IGNORE INTO arena_round_awards (round_id, player_id) VALUES (?, ?)")
      .bind(roundId, playerId),
  );
  const cpuTeachbackStatements = winnerIds.flatMap((playerId) => {
    const botKey = cpuById.get(playerId);
    if (!botKey) return [];
    const teachback = cpuTeachback(mode, botKey);
    return [
      db()
        .prepare(
          `INSERT INTO arena_teachbacks (round_id, player_id, intent, move, lesson)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(round_id, player_id) DO UPDATE SET
             intent = excluded.intent, move = excluded.move,
             lesson = excluded.lesson, updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(roundId, playerId, teachback.intent, teachback.move, teachback.lesson),
    ];
  });

  await db().batch([
    db().prepare("DELETE FROM arena_round_awards WHERE round_id = ?").bind(roundId),
    ...awardStatements,
    ...cpuTeachbackStatements,
    db()
      .prepare(
        `UPDATE arena_rounds
         SET status = 'results', winning_team = ?, revealed_at = COALESCE(revealed_at, CURRENT_TIMESTAMP)
         WHERE id = ? AND status = 'revealing'`,
      )
      .bind(winningTeam, roundId),
    db()
      .prepare(
        `UPDATE arena_players
         SET score = (
           SELECT COUNT(*)
           FROM arena_round_awards awards
           JOIN arena_rounds rounds ON rounds.id = awards.round_id
           WHERE awards.player_id = arena_players.id
             AND rounds.room_id = ? AND rounds.match_number = ?
         )
         WHERE room_id = ?`,
      )
      .bind(room.id, room.matchNumber, room.id),
    db()
      .prepare(
        `UPDATE arena_rooms
         SET phase = 'results',
           signal_score = (
             SELECT COUNT(*) FROM arena_rounds
             WHERE room_id = ? AND match_number = ? AND status = 'results'
               AND winning_team IN ('SIGNAL', 'TIE')
           ),
           static_score = (
             SELECT COUNT(*) FROM arena_rounds
             WHERE room_id = ? AND match_number = ? AND status = 'results'
               AND winning_team IN ('STATIC', 'TIE')
           ),
           match_status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND EXISTS (
           SELECT 1 FROM arena_rounds WHERE id = ? AND status = 'results'
         )`,
      )
      .bind(
        room.id,
        room.matchNumber,
        room.id,
        room.matchNumber,
        isFinalRound ? "finished" : "active",
        room.id,
        roundId,
      ),
  ]);

  return { revealed: true, matchFinished: isFinalRound } as const;
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
      `SELECT id, prompt, mode, status, answer_deadline_at AS answerDeadlineAt,
        vote_deadline_at AS voteDeadlineAt
       FROM arena_rounds
       WHERE room_id = ? AND match_number = ? AND round_number = ? LIMIT 1`,
    )
    .bind(roomId, matchNumber, roundNumber)
    .first<LiveRoundRow>();
}

async function castCpuVotes(roomId: number, round: LiveRoundRow) {
  const [voters, submissions] = await Promise.all([
    db()
      .prepare(
        `SELECT id, bot_key AS botKey FROM arena_players
         WHERE room_id = ? AND active = 1 AND is_bot = 1`,
      )
      .bind(roomId)
      .all<{ id: number; botKey: string }>(),
    db()
      .prepare(
        `SELECT id, player_id AS playerId, content
         FROM arena_submissions WHERE round_id = ? ORDER BY id ASC`,
      )
      .bind(round.id)
      .all<{ id: number; playerId: number; content: string }>(),
  ]);

  const statements = voters.results.flatMap((voter) => {
    const choices = submissions.results.filter((entry) => entry.playerId !== voter.id);
    const submissionId = chooseCpuVote(round.mode, round.prompt, voter.botKey, choices);
    if (!submissionId) return [];
    return [
      db()
        .prepare(
          `INSERT OR IGNORE INTO arena_votes (round_id, voter_player_id, submission_id)
           SELECT ?, ?, ?
           WHERE EXISTS (SELECT 1 FROM arena_rounds WHERE id = ? AND status = 'voting')`,
        )
        .bind(round.id, voter.id, submissionId, round.id),
    ];
  });
  if (statements.length > 0) await db().batch(statements);
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
