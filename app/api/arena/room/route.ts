import { cleanText, db, getOwnedProfile, requireApiUser } from "../../_shared";
import { deadlineAfter, reconcileArenaRoom, revealArenaRound } from "../_live";
import {
  GAME_MODES,
  RANDOM_MODE,
  getGameMode,
  isGameModeId,
  type GameModeId,
} from "../../../arena/game-modes";
import {
  TEAM_SIGNAL,
  TEAM_STATIC,
  getTimerPreset,
  isMatchFormat,
  isMatchLength,
  isRotationMode,
  isTimerPreset,
  type MatchFormat,
  type MatchLength,
  type RotationMode,
  type TeamId,
  type TimerPreset,
} from "../../../arena/match-config";
import {
  arenaParticipantIdentity,
  type ArenaPublicIdentity,
} from "../../../arena/public-identity";
import {
  ARENA_ROOM_CODE_ALPHABET,
  ARENA_ROOM_CODE_LENGTH,
  normalizeArenaRoomCode,
} from "../../../arena/room-code";

type RoomRow = {
  id: number;
  code: string;
  hostEmail: string;
  phase: "lobby" | "answering" | "voting" | "results";
  roundNumber: number;
  maxPlayers: number;
  matchLength: number;
  matchFormat: MatchFormat;
  rotationMode: RotationMode;
  matchStatus: "setup" | "active" | "finished";
  matchNumber: number;
  signalScore: number;
  staticScore: number;
  timerPreset: TimerPreset;
  answerSeconds: number;
  voteSeconds: number;
};

type PlayerRow = {
  id: number;
  displayName: string;
  profileHandle: string;
  score: number;
  team: string;
};

type RoundRow = {
  id: number;
  roundNumber: number;
  matchNumber: number;
  prompt: string;
  mode: string;
  status: string;
  winningTeam: string;
  answerDeadlineAt: string | null;
  voteDeadlineAt: string | null;
};

type SubmissionRow = {
  id: number;
  playerId: number;
  content: string;
  authorName: string;
  profileHandle: string;
  team: string;
  voteCount: number;
};

type TeachbackRow = {
  playerId: number;
  intent: string;
  move: string;
  lesson: string;
};

type RoundHistoryRow = {
  roundNumber: number;
  mode: string;
  winningTeam: string;
};

const PROMPTS: Record<GameModeId, string[]> = {
  RAP: [
    "One or two bars for a gatekeeper who says using new tools means you stopped being creative.",
    "Write the last bar before a ridiculous beat drop about humans and machines making something together.",
    "Flex about turning a half-finished idea into something real before everyone else finished arguing about it.",
    "One or two bars: your opponent says ‘anyone could do that.’ Answer without using the word AI.",
    "Write a battle bar about an artist who keeps declaring creativity dead every time a new tool arrives.",
    "Give FACEBACK.CAM a two-line entrance theme that sounds cocky enough to deserve bass.",
  ],
  PUNCHLINE: [
    "Finish it: The machine tried to replace me, but it forgot to _____.",
    "Finish it: I asked the gatekeeper for permission and they said _____.",
    "Complete the joke: Creativity officially died today after surviving _____.",
    "Finish it: My workflow has no soul, which explains why _____.",
    "Write one punchline for someone who says ‘real artists never use shortcuts.’",
    "Complete the sentence: I finally made art the traditional way by _____.",
  ],
  HOOK: [
    "Write a hook using eight words or fewer about humans making something new.",
    "Write the chant FACEBACK creators yell right before ignoring bad advice.",
    "Make ‘use the tool’ into a hook someone could remember after hearing it once.",
    "Write an eight-word-or-fewer hook about ideas escaping your head.",
    "Create the smallest possible chorus for a song called ‘Proof Over Permission.’",
    "Write a sticky hook about old ideas getting a second life.",
  ],
  PITCH: [
    "Pitch an AI-assisted creative product for a problem nobody realizes they have yet.",
    "Invent a creator platform feature so useful it sounds fake. Pitch it in one tight paragraph.",
    "Pitch a collaboration between a human creator and a machine that would make a terrible press release but a great project.",
    "Invent a creative tool that should absolutely not exist, then make the room want it anyway.",
    "Pitch a museum exhibit called ‘Creativity Died Again.’ What happens inside?",
    "Create a project that turns anti-AI complaints into raw material for something entertaining. Sell the concept.",
  ],
  CAPTION: [
    "Caption this imaginary image: a medieval painter staring at Photoshop for the first time.",
    "Caption this imaginary image: a robot holding a paintbrush while six humans argue behind it.",
    "Caption this imaginary image: an artist carrying 47 tools while someone points angrily at tool number 48.",
    "Caption this imaginary image: a caveman proudly deleting the wheel because it is cheating.",
    "Caption this imaginary image: a museum plaque that reads ‘The Last Real Artist, Again.’",
    "Caption this imaginary image: a laptop and a pencil sitting together in couples therapy.",
  ],
  FLIP: [
    "Flip ‘the machine took my job’ into the opening line of an optimistic song.",
    "Flip ‘anyone could do that’ into a compliment while keeping the core idea recognizable.",
    "Flip ‘this is not real art’ into a slogan for making more art.",
    "Flip ‘do not press the red button’ into something inspirational.",
    "Flip ‘we used to make things ourselves’ into a line celebrating collaboration.",
    "Flip ‘technology ruined creativity’ into a line that means the exact opposite without simply adding ‘not.’",
  ],
};

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const code = normalizeCode(new URL(request.url).searchParams.get("code"));
    if (!code) return Response.json({ error: "Room code required" }, { status: 400 });
    const response = Response.json(await roomState(code, user.email));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const payload = await readPayload(request);
    const action = cleanText(payload.action, 30);
    await enforceRateLimit("action", user.email, 120, 60_000);

    if (action === "create") {
      await enforceRateLimit("create", user.email, 10, 60 * 60_000);
      const identity = arenaParticipantIdentity(
        (await getOwnedProfile(user.email)) ?? null,
        user.displayName,
      );
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const code = makeRoomCode();
        const existing = await getRoom(code);
        if (existing) continue;

        try {
          await db().batch([
            db().prepare("INSERT INTO arena_rooms (code, host_email) VALUES (?, ?)").bind(code, user.email),
            db()
              .prepare(
                `INSERT INTO arena_players
                  (room_id, user_email, profile_id, display_name, profile_handle, team)
                 SELECT id, ?, ?, ?, ?, '' FROM arena_rooms WHERE code = ?`,
              )
              .bind(user.email, identity.profileId, identity.displayName, identity.profileHandle, code),
          ]);
          return Response.json({ code });
        } catch (error) {
          const allocated = await getRoom(code);
          if (allocated?.hostEmail === user.email) return Response.json({ code });
          if (allocated) continue;
          throw error;
        }
      }
      throw new Error("Unable to allocate a room code");
    }

    const code = normalizeCode(payload.code);
    if (!code) return Response.json({ error: "Room code required" }, { status: 400 });
    let room = await getRoom(code);
    if (!room) return Response.json({ error: "Room not found" }, { status: 404 });

    if (action === "join") {
      const existingPlayer = await getPlayer(room.id, user.email);
      if (existingPlayer) return Response.json({ code });
      if (room.phase === "answering" || room.phase === "voting") {
        return Response.json({ error: "A round is in progress. Join between rounds." }, { status: 409 });
      }
      const count = await playerCount(room.id);
      if (count >= room.maxPlayers) return Response.json({ error: "That room is full." }, { status: 409 });
      const identity = arenaParticipantIdentity(
        (await getOwnedProfile(user.email)) ?? null,
        user.displayName,
      );
      const team = room.matchFormat === "TEAMS" ? await smallerTeam(room.id) : "";
      await addPlayer(room.id, user.email, identity, team);
      await ensureActiveHost(room.id);
      return Response.json({ code });
    }

    await reconcileArenaRoom(room.id);
    room = (await getRoom(code)) ?? room;

    const me = await getPlayer(room.id, user.email);
    if (!me) return Response.json({ error: "Join the room first." }, { status: 403 });

    await db()
      .prepare("UPDATE arena_players SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(me.id)
      .run();
    await ensureResponsiveHost(room.id);
    room = (await getRoom(code)) ?? room;

    if (action === "heartbeat") {
      return Response.json({ ok: true });
    }

    if (action === "leave") {
      await db().batch([
        db()
          .prepare(
            `UPDATE arena_players
             SET active = 0, left_at = CURRENT_TIMESTAMP, last_seen_at = CURRENT_TIMESTAMP
             WHERE id = ? AND active = 1`,
          )
          .bind(me.id),
        db()
          .prepare(
            `UPDATE arena_rooms
             SET host_email = COALESCE(
               (SELECT user_email FROM arena_players
                WHERE room_id = ? AND active = 1
                  AND last_seen_at >= datetime('now', '-150 seconds')
                ORDER BY joined_at ASC, id ASC LIMIT 1),
               host_email
             ), updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND host_email = ?`,
          )
          .bind(room.id, room.id, user.email),
      ]);
      return Response.json({ ok: true });
    }

    if (action === "rematch") {
      requireHost(room, user.email);
      if (room.matchStatus !== "finished" || room.phase !== "results") {
        return Response.json({ error: "Finish the current match before starting a rematch." }, { status: 409 });
      }
      const nextMatch = room.matchNumber + 1;
      const teamStatements = await matchTeamStatements(room.id, room.matchFormat, nextMatch);
      await db().batch([
        db()
          .prepare(
          `UPDATE arena_rooms
           SET phase = 'lobby', round_number = 0, match_status = 'setup',
             match_number = ?, signal_score = 0, static_score = 0,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND phase = 'results' AND match_status = 'finished'`,
          )
          .bind(nextMatch, room.id),
        db().prepare("UPDATE arena_players SET score = 0 WHERE room_id = ?").bind(room.id),
        ...teamStatements,
      ]);
      return Response.json({ ok: true, matchNumber: nextMatch });
    }

    if (action === "start") {
      requireHost(room, user.email);
      if (room.phase !== "lobby" && room.phase !== "results") {
        return Response.json({ error: "Finish the current round first." }, { status: 409 });
      }
      if (room.matchStatus === "finished") {
        return Response.json({ error: "That match is complete. Start a rematch first." }, { status: 409 });
      }
      if ((await playerCount(room.id)) < 2) {
        return Response.json({ error: "At least two creators are needed." }, { status: 409 });
      }

      let matchLength = room.matchLength as MatchLength;
      let matchFormat = room.matchFormat;
      let rotationMode = room.rotationMode;
      let answerSeconds = room.answerSeconds;

      if (room.roundNumber === 0) {
        if (room.matchStatus === "setup") {
          const requestedLength = Number(payload.matchLength);
          const requestedFormat = cleanText(payload.matchFormat, 12).toUpperCase();
          const requestedRotation = cleanText(payload.rotationMode, 12).toUpperCase();
          const requestedTimer = cleanText(payload.timerPreset, 12).toUpperCase();
          if (!isMatchLength(requestedLength)) {
            return Response.json({ error: "Choose a 3- or 5-round match." }, { status: 400 });
          }
          if (!isMatchFormat(requestedFormat)) {
            return Response.json({ error: "Choose solo or team format." }, { status: 400 });
          }
          if (!isRotationMode(requestedRotation)) {
            return Response.json({ error: "Choose automatic or host-picked game rotation." }, { status: 400 });
          }
          if (!isTimerPreset(requestedTimer)) {
            return Response.json({ error: "Choose a valid round timer." }, { status: 400 });
          }
          const timer = getTimerPreset(requestedTimer);
          await db()
            .prepare(
              `UPDATE arena_rooms
               SET match_length = ?, match_format = ?, rotation_mode = ?,
                 timer_preset = ?, answer_seconds = ?, vote_seconds = ?,
                 match_status = 'active', signal_score = 0, static_score = 0,
                 updated_at = CURRENT_TIMESTAMP
               WHERE id = ? AND round_number = 0 AND match_status = 'setup'`,
            )
            .bind(
              requestedLength,
              requestedFormat,
              requestedRotation,
              requestedTimer,
              timer.answerSeconds,
              timer.voteSeconds,
              room.id,
            )
            .run();
        }

        const configured = await getRoom(code);
        if (!configured) throw new Error("Unable to load configured room");
        matchLength = configured.matchLength as MatchLength;
        matchFormat = configured.matchFormat;
        rotationMode = configured.rotationMode;
        answerSeconds = configured.answerSeconds;
        if (configured.roundNumber === 0) {
          const teamStatements = await matchTeamStatements(room.id, matchFormat, room.matchNumber);
          await db().batch([
            db().prepare("UPDATE arena_players SET score = 0 WHERE room_id = ?").bind(room.id),
            ...teamStatements,
          ]);
        }
      }

      const roundNumber = room.roundNumber + 1;
      if (roundNumber > matchLength) {
        return Response.json({ error: "That match already reached its final round." }, { status: 409 });
      }

      const requestedMode = cleanText(payload.mode, 20).toUpperCase() || RANDOM_MODE;
      const mode = rotationMode === "AUTO"
        ? automaticMode(room.id, room.matchNumber, roundNumber)
        : resolveMode(requestedMode, room.id, room.matchNumber, roundNumber);
      if (!mode) return Response.json({ error: "Choose a valid game mode." }, { status: 400 });
      const prompt = choosePrompt(mode, room.id, room.matchNumber, roundNumber);
      const answerDeadline = deadlineAfter(answerSeconds);

      await db().batch([
        db()
          .prepare(
          `INSERT OR IGNORE INTO arena_rounds
            (room_id, match_number, round_number, prompt, mode, answer_deadline_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(room.id, room.matchNumber, roundNumber, prompt, mode, answerDeadline),
        db()
          .prepare(
          `UPDATE arena_rooms
           SET phase = 'answering', round_number = ?, match_status = 'active',
             updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND phase IN ('lobby', 'results')
             AND EXISTS (
               SELECT 1 FROM arena_rounds
               WHERE room_id = ? AND match_number = ? AND round_number = ? AND status = 'answering'
             )`,
          )
          .bind(roundNumber, room.id, room.id, room.matchNumber, roundNumber),
      ]);
      return Response.json({ ok: true, mode, answerDeadline });
    }

    const round = await getCurrentRound(room);
    if (!round) return Response.json({ error: "No active round." }, { status: 409 });

    if (action === "submit") {
      if (room.phase !== "answering") {
        return Response.json({ error: "Submissions are closed." }, { status: 409 });
      }
      const mode = getGameMode(round.mode);
      const content = cleanText(payload.content, mode?.maxChars ?? 280);
      if (content.length < 2) return Response.json({ error: "Give the room something to vote on." }, { status: 400 });
      const result = await db()
        .prepare(
          `INSERT INTO arena_submissions (round_id, player_id, content)
           SELECT ?, ?, ?
           WHERE EXISTS (
             SELECT 1 FROM arena_rounds WHERE id = ? AND status = 'answering'
           )
           ON CONFLICT(round_id, player_id)
           DO UPDATE SET content = excluded.content, created_at = CURRENT_TIMESTAMP`,
        )
        .bind(round.id, me.id, content, round.id)
        .run();
      if (Number(result.meta?.changes || 0) < 1) {
        return Response.json({ error: "Submissions are closed." }, { status: 409 });
      }
      return Response.json({ ok: true });
    }

    if (action === "open-voting") {
      requireHost(room, user.email);
      if (room.phase !== "answering") return Response.json({ error: "Voting cannot open yet." }, { status: 409 });
      const submissions = await submissionCount(round.id);
      if (submissions < 2) return Response.json({ error: "Need at least two entries before voting." }, { status: 409 });
      const voteDeadline = deadlineAfter(room.voteSeconds);
      const [opened] = await db().batch([
        db()
          .prepare(
            `UPDATE arena_rounds
             SET status = 'voting', voting_opened_at = CURRENT_TIMESTAMP, vote_deadline_at = ?
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
      if (Number(opened.meta?.changes || 0) < 1) {
        return Response.json({ error: "Voting has already opened." }, { status: 409 });
      }
      return Response.json({ ok: true, voteDeadline });
    }

    if (action === "vote") {
      if (room.phase !== "voting") return Response.json({ error: "Voting is not open." }, { status: 409 });
      const submissionId = Number(payload.submissionId);
      if (!Number.isInteger(submissionId)) return Response.json({ error: "Choose an entry." }, { status: 400 });
      const submission = await db()
        .prepare("SELECT id, player_id AS playerId FROM arena_submissions WHERE id = ? AND round_id = ? LIMIT 1")
        .bind(submissionId, round.id)
        .first<{ id: number; playerId: number }>();
      if (!submission) return Response.json({ error: "Entry not found." }, { status: 404 });
      if (submission.playerId === me.id) return Response.json({ error: "You cannot vote for your own entry." }, { status: 400 });
      const result = await db()
        .prepare(
          `INSERT INTO arena_votes (round_id, voter_player_id, submission_id)
           SELECT ?, ?, ?
           WHERE EXISTS (
             SELECT 1 FROM arena_rounds WHERE id = ? AND status = 'voting'
           )
           ON CONFLICT(round_id, voter_player_id)
           DO UPDATE SET submission_id = excluded.submission_id, created_at = CURRENT_TIMESTAMP`,
        )
        .bind(round.id, me.id, submissionId, round.id)
        .run();
      if (Number(result.meta?.changes || 0) < 1) {
        return Response.json({ error: "Voting has closed." }, { status: 409 });
      }
      return Response.json({ ok: true });
    }

    if (action === "reveal") {
      requireHost(room, user.email);
      if (room.phase !== "voting") return Response.json({ error: "Results have already been revealed." }, { status: 409 });
      const result = await revealArenaRound(room.id, round.id);
      if (!result.revealed && result.reason === "no-votes") {
        return Response.json({ error: "Wait for at least one vote." }, { status: 409 });
      }
      return Response.json({ ok: true, matchFinished: result.revealed ? result.matchFinished : room.matchStatus === "finished" });
    }

    if (action === "teachback") {
      if (room.phase !== "results") {
        return Response.json({ error: "The winner can explain the move after the reveal." }, { status: 409 });
      }
      const rows = await submissionRows(round.id);
      const winners = winnerPlayerIds(rows);
      if (!winners.includes(me.id)) {
        return Response.json({ error: "Only a winning creator can school the room for this round." }, { status: 403 });
      }

      const intent = cleanText(payload.intent, 260);
      const move = cleanText(payload.move, 420);
      const lesson = cleanText(payload.lesson, 260);
      if (intent.length < 3 || move.length < 3 || lesson.length < 3) {
        return Response.json({ error: "Answer all three winner breakdown prompts." }, { status: 400 });
      }

      await db()
        .prepare(
          `INSERT INTO arena_teachbacks (round_id, player_id, intent, move, lesson)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(round_id, player_id)
           DO UPDATE SET intent = excluded.intent, move = excluded.move,
             lesson = excluded.lesson, updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(round.id, me.id, intent, move, lesson)
        .run();
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown arena action." }, { status: 400 });
  } catch (error) {
    return jsonError(error);
  }
}

async function roomState(code: string, email: string) {
  let room = await getRoom(code);
  if (!room) throw new HttpError("Room not found", 404);
  await reconcileArenaRoom(room.id);
  room = (await getRoom(code)) ?? room;

  const me = await getPlayer(room.id, email);

  const playersResult = await db()
    .prepare(
      `SELECT p.id, p.display_name AS displayName,
        CASE WHEN pr.published = 1 THEN pr.handle ELSE '' END AS profileHandle,
        p.score, p.team
       FROM arena_players p
       LEFT JOIN profiles pr ON pr.id = p.profile_id
       WHERE p.room_id = ? AND p.active = 1
       ORDER BY p.score DESC, p.joined_at ASC`,
    )
    .bind(room.id)
    .all<PlayerRow>();
  const players = playersResult.results;
  const round = await getCurrentRound(room);
  const history = await roundHistory(room.id, room.matchNumber);

  let submissions: Array<Record<string, unknown>> = [];
  let mySubmissionId: number | null = null;
  let mySubmission = "";
  let myVoteId: number | null = null;
  let winners: Array<Record<string, unknown>> = [];
  let meIsWinner = false;
  let teachbackCount = 0;

  if (round) {
    const rows = await submissionRows(round.id);
    const mine = rows.find((entry) => entry.playerId === me?.id);
    mySubmissionId = mine?.id ?? null;
    mySubmission = mine?.content ?? "";
    if (me) {
      const vote = await db()
        .prepare("SELECT submission_id AS submissionId FROM arena_votes WHERE round_id = ? AND voter_player_id = ? LIMIT 1")
        .bind(round.id, me.id)
        .first<{ submissionId: number }>();
      myVoteId = vote?.submissionId ?? null;
    }

    if (room.phase === "voting" || room.phase === "results") {
      submissions = rows.map((entry) => ({
        id: entry.id,
        content: entry.content,
        isMine: entry.playerId === me?.id,
        ...(room.phase === "results"
          ? {
              voteCount: Number(entry.voteCount || 0),
              author: entry.authorName,
              profileHandle: entry.profileHandle,
              team: entry.team,
            }
          : {}),
      }));
    }

    if (room.phase === "results" && rows.length > 0) {
      const winnerIds = winnerPlayerIds(rows);
      meIsWinner = me ? winnerIds.includes(me.id) : false;
      const teachbacks = await teachbackRows(round.id);
      teachbackCount = teachbacks.length;
      const teachbackByPlayer = new Map(teachbacks.map((entry) => [entry.playerId, entry]));
      winners = rows
        .filter((entry) => winnerIds.includes(entry.playerId))
        .map((entry) => {
          const teachback = teachbackByPlayer.get(entry.playerId);
          return {
            submissionId: entry.id,
            playerId: entry.playerId,
            content: entry.content,
            author: entry.authorName,
            profileHandle: entry.profileHandle,
            team: entry.team,
            voteCount: Number(entry.voteCount || 0),
            teachback: teachback
              ? { intent: teachback.intent, move: teachback.move, lesson: teachback.lesson }
              : null,
          };
        });
    }
  }

  return {
    serverNow: new Date().toISOString(),
    room: {
      code: room.code,
      phase: room.phase,
      roundNumber: room.roundNumber,
      maxPlayers: room.maxPlayers,
      isHost: room.hostEmail === email,
      matchLength: room.matchLength,
      matchFormat: room.matchFormat,
      rotationMode: room.rotationMode,
      matchStatus: room.matchStatus,
      matchNumber: room.matchNumber,
      matchFinished: room.matchStatus === "finished",
      timerPreset: room.timerPreset,
      answerSeconds: room.answerSeconds,
      voteSeconds: room.voteSeconds,
      teamScores: {
        signal: room.signalScore,
        static: room.staticScore,
      },
    },
    me: me ? { id: me.id, team: me.team } : null,
    players,
    round: round
      ? {
          id: round.id,
          prompt: round.prompt,
          mode: round.mode,
          roundNumber: round.roundNumber,
          matchNumber: round.matchNumber,
          winningTeam: round.winningTeam,
          answerDeadlineAt: round.answerDeadlineAt,
          voteDeadlineAt: round.voteDeadlineAt,
        }
      : null,
    roundHistory: history,
    submissions,
    mySubmissionId,
    mySubmission,
    myVoteId,
    winners,
    meIsWinner,
    counts: {
      players: players.length,
      submissions: round ? await submissionCount(round.id) : 0,
      votes: round ? await voteCount(round.id) : 0,
      teachbacks: teachbackCount,
    },
  };
}

async function getRoom(code: string) {
  return db()
    .prepare(
      `SELECT id, code, host_email AS hostEmail, phase,
        round_number AS roundNumber, max_players AS maxPlayers,
        match_length AS matchLength, match_format AS matchFormat,
        rotation_mode AS rotationMode, match_status AS matchStatus,
        match_number AS matchNumber, signal_score AS signalScore,
        static_score AS staticScore, timer_preset AS timerPreset,
        answer_seconds AS answerSeconds, vote_seconds AS voteSeconds
       FROM arena_rooms WHERE code = ? LIMIT 1`,
    )
    .bind(code)
    .first<RoomRow>();
}

async function getPlayer(roomId: number, email: string) {
  return db()
    .prepare(
      `SELECT p.id, p.display_name AS displayName,
        CASE WHEN pr.published = 1 THEN pr.handle ELSE '' END AS profileHandle,
        p.score, p.team
       FROM arena_players p
       LEFT JOIN profiles pr ON pr.id = p.profile_id
       WHERE p.room_id = ? AND p.user_email = ? AND p.active = 1 LIMIT 1`,
    )
    .bind(roomId, email)
    .first<PlayerRow>();
}

async function addPlayer(roomId: number, email: string, identity: ArenaPublicIdentity, team: string) {
  await db()
    .prepare(
      `INSERT INTO arena_players
        (room_id, user_email, profile_id, display_name, profile_handle, team, active, left_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, NULL)
       ON CONFLICT(room_id, user_email) DO UPDATE SET
         profile_id = excluded.profile_id,
         display_name = excluded.display_name,
         profile_handle = excluded.profile_handle,
         team = excluded.team,
         active = 1,
         left_at = NULL,
         last_seen_at = CURRENT_TIMESTAMP`,
    )
    .bind(roomId, email, identity.profileId, identity.displayName, identity.profileHandle, team)
    .run();
}

async function ensureActiveHost(roomId: number) {
  await db()
    .prepare(
      `UPDATE arena_rooms
       SET host_email = (
         SELECT user_email FROM arena_players
         WHERE room_id = ? AND active = 1
           AND last_seen_at >= datetime('now', '-150 seconds')
         ORDER BY joined_at ASC, id ASC LIMIT 1
       ), updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND NOT EXISTS (
         SELECT 1 FROM arena_players
         WHERE room_id = ? AND user_email = arena_rooms.host_email AND active = 1
       )`,
    )
    .bind(roomId, roomId, roomId)
    .run();
}

async function ensureResponsiveHost(roomId: number) {
  await db()
    .prepare(
      `UPDATE arena_rooms
       SET host_email = (
         SELECT user_email FROM arena_players
         WHERE room_id = ? AND active = 1
           AND last_seen_at >= datetime('now', '-150 seconds')
         ORDER BY joined_at ASC, id ASC LIMIT 1
       ), updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND EXISTS (
           SELECT 1 FROM arena_players
           WHERE room_id = ? AND active = 1
             AND last_seen_at >= datetime('now', '-150 seconds')
         )
         AND NOT EXISTS (
           SELECT 1 FROM arena_players
           WHERE room_id = ? AND user_email = arena_rooms.host_email AND active = 1
             AND last_seen_at >= datetime('now', '-150 seconds')
         )`,
    )
    .bind(roomId, roomId, roomId, roomId)
    .run();
}

async function getCurrentRound(room: RoomRow) {
  if (room.roundNumber < 1) return null;
  return db()
    .prepare(
      `SELECT id, round_number AS roundNumber, match_number AS matchNumber,
        prompt, mode, status, winning_team AS winningTeam,
        answer_deadline_at AS answerDeadlineAt, vote_deadline_at AS voteDeadlineAt
       FROM arena_rounds
       WHERE room_id = ? AND match_number = ? AND round_number = ? LIMIT 1`,
    )
    .bind(room.id, room.matchNumber, room.roundNumber)
    .first<RoundRow>();
}

async function submissionRows(roundId: number) {
  const result = await db()
    .prepare(
      `SELECT s.id, s.player_id AS playerId, s.content,
        COALESCE(NULLIF(p.display_name, ''), 'FACEBACK Guest') AS authorName,
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
    .all<SubmissionRow>();
  return result.results;
}

async function teachbackRows(roundId: number) {
  const result = await db()
    .prepare(
      `SELECT player_id AS playerId, intent, move, lesson
       FROM arena_teachbacks WHERE round_id = ? ORDER BY id ASC`,
    )
    .bind(roundId)
    .all<TeachbackRow>();
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
    .all<RoundHistoryRow>();
  return result.results;
}

async function playerCount(roomId: number) {
  const row = await db()
    .prepare(
      `SELECT COUNT(*) AS count
       FROM arena_players p
       WHERE p.room_id = ? AND p.active = 1`,
    )
    .bind(roomId)
    .first<{ count: number }>();
  return Number(row?.count || 0);
}

async function submissionCount(roundId: number) {
  const row = await db()
    .prepare("SELECT COUNT(*) AS count FROM arena_submissions WHERE round_id = ?")
    .bind(roundId)
    .first<{ count: number }>();
  return Number(row?.count || 0);
}

async function voteCount(roundId: number) {
  const row = await db()
    .prepare("SELECT COUNT(*) AS count FROM arena_votes WHERE round_id = ?")
    .bind(roundId)
    .first<{ count: number }>();
  return Number(row?.count || 0);
}

async function smallerTeam(roomId: number): Promise<TeamId> {
  const rows = await db()
    .prepare(
      `SELECT team, COUNT(*) AS count FROM arena_players
       WHERE room_id = ? AND active = 1 AND team IN (?, ?)
       GROUP BY team`,
    )
    .bind(roomId, TEAM_SIGNAL, TEAM_STATIC)
    .all<{ team: string; count: number }>();
  const signal = Number(rows.results.find((row) => row.team === TEAM_SIGNAL)?.count || 0);
  const statik = Number(rows.results.find((row) => row.team === TEAM_STATIC)?.count || 0);
  return signal <= statik ? TEAM_SIGNAL : TEAM_STATIC;
}

async function matchTeamStatements(roomId: number, matchFormat: MatchFormat, matchNumber: number) {
  const clear = db().prepare("UPDATE arena_players SET team = '' WHERE room_id = ?").bind(roomId);
  if (matchFormat !== "TEAMS") return [clear];

  const players = await db()
    .prepare(
      `SELECT id FROM arena_players
       WHERE room_id = ? AND active = 1
       ORDER BY joined_at ASC, id ASC`,
    )
    .bind(roomId)
    .all<{ id: number }>();
  return [clear, ...players.results.map((player, index) => {
    const team = (index + matchNumber - 1) % 2 === 0 ? TEAM_SIGNAL : TEAM_STATIC;
    return db().prepare("UPDATE arena_players SET team = ? WHERE id = ?").bind(team, player.id);
  })];
}

function winnerPlayerIds(rows: SubmissionRow[]) {
  if (rows.length === 0) return [];
  const top = Math.max(...rows.map((entry) => Number(entry.voteCount || 0)));
  return [...new Set(rows.filter((entry) => Number(entry.voteCount || 0) === top).map((entry) => entry.playerId))];
}

function requireHost(room: RoomRow, email: string) {
  if (room.hostEmail !== email) throw new HttpError("Only the room host can do that.", 403);
}

function normalizeCode(value: unknown) {
  return normalizeArenaRoomCode(value);
}

function makeRoomCode() {
  const bytes = new Uint8Array(ARENA_ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (value) => ARENA_ROOM_CODE_ALPHABET[value % ARENA_ROOM_CODE_ALPHABET.length],
  ).join("");
}

function resolveMode(value: string, roomId: number, matchNumber: number, roundNumber: number): GameModeId | null {
  if (value === RANDOM_MODE) {
    return GAME_MODES[(roomId * 5 + matchNumber * 3 + roundNumber * 7) % GAME_MODES.length].id;
  }
  return isGameModeId(value) ? value : null;
}

function automaticMode(roomId: number, matchNumber: number, roundNumber: number): GameModeId {
  const offset = (roomId * 3 + matchNumber * 5) % GAME_MODES.length;
  return GAME_MODES[(offset + roundNumber - 1) % GAME_MODES.length].id;
}

function choosePrompt(mode: GameModeId, roomId: number, matchNumber: number, roundNumber: number) {
  const bank = PROMPTS[mode];
  return bank[(roomId * 11 + matchNumber * 5 + roundNumber * 13) % bank.length];
}

async function readPayload(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > 16_384) throw new HttpError("Arena request is too large.", 413);

  const text = await request.text();
  if (text.length > 16_384) throw new HttpError("Arena request is too large.", 413);

  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("not an object");
    }
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError("Send a valid JSON request.", 400);
  }
}

async function enforceRateLimit(
  scope: string,
  actorKey: string,
  limit: number,
  windowMs: number,
) {
  const bucket = Math.floor(Date.now() / windowMs);
  await db().batch([
    db()
      .prepare(
        `INSERT INTO arena_action_limits (scope, actor_key, bucket, request_count)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(scope, actor_key, bucket) DO UPDATE SET
           request_count = request_count + 1,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(scope, actorKey, bucket),
    db()
      .prepare("DELETE FROM arena_action_limits WHERE scope = ? AND actor_key = ? AND bucket < ?")
      .bind(scope, actorKey, bucket - 1440),
  ]);
  const row = await db()
    .prepare(
      `SELECT request_count AS requestCount
       FROM arena_action_limits
       WHERE scope = ? AND actor_key = ? AND bucket = ? LIMIT 1`,
    )
    .bind(scope, actorKey, bucket)
    .first<{ requestCount: number }>();
  if (Number(row?.requestCount || 0) > limit) {
    throw new HttpError("Too many Arena requests. Take a breath and try again shortly.", 429);
  }
}

class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function jsonError(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  console.error("Arena request failed", error);
  return Response.json({ error: "Arena request failed. Please try again." }, { status: 500 });
}
