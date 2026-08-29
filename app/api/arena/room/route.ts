import { cleanText, db, getOwnedProfile, requireApiUser } from "../../_shared";
import {
  GAME_MODES,
  RANDOM_MODE,
  getGameMode,
  isGameModeId,
  type GameModeId,
} from "../../../arena/game-modes";

type RoomRow = {
  id: number;
  code: string;
  hostEmail: string;
  phase: "lobby" | "answering" | "voting" | "results";
  roundNumber: number;
  maxPlayers: number;
};

type PlayerRow = {
  id: number;
  displayName: string;
  profileHandle: string;
  score: number;
};

type RoundRow = {
  id: number;
  roundNumber: number;
  prompt: string;
  mode: string;
  status: string;
};

type SubmissionRow = {
  id: number;
  playerId: number;
  content: string;
  authorName: string;
  profileHandle: string;
  voteCount: number;
};

type TeachbackRow = {
  playerId: number;
  intent: string;
  move: string;
  lesson: string;
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
    return Response.json(await roomState(code, user.email));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const action = cleanText(payload.action, 30);

    if (action === "create") {
      const profile = await getOwnedProfile(user.email);
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const code = makeRoomCode();
        const existing = await getRoom(code);
        if (existing) continue;

        await db()
          .prepare("INSERT INTO arena_rooms (code, host_email) VALUES (?, ?)")
          .bind(code, user.email)
          .run();
        const room = await getRoom(code);
        if (!room) throw new Error("Unable to create room");
        await addPlayer(room.id, user.email, profile?.displayName || user.displayName, profile?.handle || "");
        return Response.json({ code });
      }
      throw new Error("Unable to allocate a room code");
    }

    const code = normalizeCode(payload.code);
    if (!code) return Response.json({ error: "Room code required" }, { status: 400 });
    const room = await getRoom(code);
    if (!room) return Response.json({ error: "Room not found" }, { status: 404 });

    if (action === "join") {
      const existingPlayer = await getPlayer(room.id, user.email);
      if (existingPlayer) return Response.json({ code });
      if (room.phase === "answering" || room.phase === "voting") {
        return Response.json({ error: "A round is in progress. Join between rounds." }, { status: 409 });
      }
      const count = await playerCount(room.id);
      if (count >= room.maxPlayers) return Response.json({ error: "That room is full." }, { status: 409 });
      const profile = await getOwnedProfile(user.email);
      await addPlayer(room.id, user.email, profile?.displayName || user.displayName, profile?.handle || "");
      return Response.json({ code });
    }

    const me = await getPlayer(room.id, user.email);
    if (!me) return Response.json({ error: "Join the room first." }, { status: 403 });

    await db()
      .prepare("UPDATE arena_players SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(me.id)
      .run();

    if (action === "start") {
      requireHost(room, user.email);
      if (room.phase !== "lobby" && room.phase !== "results") {
        return Response.json({ error: "Finish the current round first." }, { status: 409 });
      }
      if ((await playerCount(room.id)) < 2) {
        return Response.json({ error: "At least two creators are needed." }, { status: 409 });
      }

      const roundNumber = room.roundNumber + 1;
      const requestedMode = cleanText(payload.mode, 20).toUpperCase() || RANDOM_MODE;
      const mode = resolveMode(requestedMode, room.id, roundNumber);
      if (!mode) return Response.json({ error: "Choose a valid game mode." }, { status: 400 });
      const prompt = choosePrompt(mode, room.id, roundNumber);

      await db()
        .prepare(
          `INSERT INTO arena_rounds (room_id, round_number, prompt, mode)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(room.id, roundNumber, prompt, mode)
        .run();
      await db()
        .prepare(
          `UPDATE arena_rooms
           SET phase = 'answering', round_number = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(roundNumber, room.id)
        .run();
      return Response.json({ ok: true, mode });
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
      await db()
        .prepare(
          `INSERT INTO arena_submissions (round_id, player_id, content)
           VALUES (?, ?, ?)
           ON CONFLICT(round_id, player_id)
           DO UPDATE SET content = excluded.content, created_at = CURRENT_TIMESTAMP`,
        )
        .bind(round.id, me.id, content)
        .run();
      return Response.json({ ok: true });
    }

    if (action === "open-voting") {
      requireHost(room, user.email);
      if (room.phase !== "answering") return Response.json({ error: "Voting cannot open yet." }, { status: 409 });
      const submissions = await submissionCount(round.id);
      if (submissions < 2) return Response.json({ error: "Need at least two entries before voting." }, { status: 409 });
      await db()
        .prepare("UPDATE arena_rounds SET status = 'voting', voting_opened_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(round.id)
        .run();
      await db()
        .prepare("UPDATE arena_rooms SET phase = 'voting', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(room.id)
        .run();
      return Response.json({ ok: true });
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
      await db()
        .prepare(
          `INSERT INTO arena_votes (round_id, voter_player_id, submission_id)
           VALUES (?, ?, ?)
           ON CONFLICT(round_id, voter_player_id)
           DO UPDATE SET submission_id = excluded.submission_id, created_at = CURRENT_TIMESTAMP`,
        )
        .bind(round.id, me.id, submissionId)
        .run();
      return Response.json({ ok: true });
    }

    if (action === "reveal") {
      requireHost(room, user.email);
      if (room.phase !== "voting") return Response.json({ error: "Results have already been revealed." }, { status: 409 });
      const rows = await submissionRows(round.id);
      const totalVotes = rows.reduce((sum, entry) => sum + Number(entry.voteCount || 0), 0);
      if (totalVotes < 1) return Response.json({ error: "Wait for at least one vote." }, { status: 409 });
      const winners = winnerPlayerIds(rows);
      for (const playerId of winners) {
        await db().prepare("UPDATE arena_players SET score = score + 1 WHERE id = ?").bind(playerId).run();
      }
      await db()
        .prepare("UPDATE arena_rounds SET status = 'results', revealed_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(round.id)
        .run();
      await db()
        .prepare("UPDATE arena_rooms SET phase = 'results', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(room.id)
        .run();
      return Response.json({ ok: true });
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
  const room = await getRoom(code);
  if (!room) throw new HttpError("Room not found", 404);
  const me = await getPlayer(room.id, email);
  if (me) {
    await db().prepare("UPDATE arena_players SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").bind(me.id).run();
  }

  const playersResult = await db()
    .prepare(
      `SELECT id, display_name AS displayName, profile_handle AS profileHandle, score
       FROM arena_players WHERE room_id = ? ORDER BY score DESC, joined_at ASC`,
    )
    .bind(room.id)
    .all<PlayerRow>();
  const players = playersResult.results;
  const round = await getCurrentRound(room);

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
            voteCount: Number(entry.voteCount || 0),
            teachback: teachback
              ? { intent: teachback.intent, move: teachback.move, lesson: teachback.lesson }
              : null,
          };
        });
    }
  }

  return {
    room: {
      code: room.code,
      phase: room.phase,
      roundNumber: room.roundNumber,
      maxPlayers: room.maxPlayers,
      isHost: room.hostEmail === email,
    },
    me: me ? { id: me.id } : null,
    players,
    round: round ? { id: round.id, prompt: round.prompt, mode: round.mode, roundNumber: round.roundNumber } : null,
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
      `SELECT id, code, host_email AS hostEmail, phase, round_number AS roundNumber,
        max_players AS maxPlayers
       FROM arena_rooms WHERE code = ? LIMIT 1`,
    )
    .bind(code)
    .first<RoomRow>();
}

async function getPlayer(roomId: number, email: string) {
  return db()
    .prepare(
      `SELECT id, display_name AS displayName, profile_handle AS profileHandle, score
       FROM arena_players WHERE room_id = ? AND user_email = ? LIMIT 1`,
    )
    .bind(roomId, email)
    .first<PlayerRow>();
}

async function addPlayer(roomId: number, email: string, displayName: string, handle: string) {
  await db()
    .prepare(
      `INSERT INTO arena_players (room_id, user_email, display_name, profile_handle)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(roomId, email, displayName.slice(0, 70), handle.slice(0, 30))
    .run();
}

async function getCurrentRound(room: RoomRow) {
  if (room.roundNumber < 1) return null;
  return db()
    .prepare(
      `SELECT id, round_number AS roundNumber, prompt, mode, status
       FROM arena_rounds WHERE room_id = ? AND round_number = ? LIMIT 1`,
    )
    .bind(room.id, room.roundNumber)
    .first<RoundRow>();
}

async function submissionRows(roundId: number) {
  const result = await db()
    .prepare(
      `SELECT s.id, s.player_id AS playerId, s.content,
        p.display_name AS authorName, p.profile_handle AS profileHandle,
        COUNT(v.id) AS voteCount
       FROM arena_submissions s
       JOIN arena_players p ON p.id = s.player_id
       LEFT JOIN arena_votes v ON v.submission_id = s.id
       WHERE s.round_id = ?
       GROUP BY s.id, s.player_id, s.content, p.display_name, p.profile_handle
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

async function playerCount(roomId: number) {
  const row = await db()
    .prepare("SELECT COUNT(*) AS count FROM arena_players WHERE room_id = ?")
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

function winnerPlayerIds(rows: SubmissionRow[]) {
  if (rows.length === 0) return [];
  const top = Math.max(...rows.map((entry) => Number(entry.voteCount || 0)));
  return [...new Set(rows.filter((entry) => Number(entry.voteCount || 0) === top).map((entry) => entry.playerId))];
}

function requireHost(room: RoomRow, email: string) {
  if (room.hostEmail !== email) throw new HttpError("Only the room host can do that.", 403);
}

function normalizeCode(value: unknown) {
  const code = cleanText(value, 8).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z0-9]{5}$/.test(code) ? code : "";
}

function makeRoomCode() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function resolveMode(value: string, roomId: number, roundNumber: number): GameModeId | null {
  if (value === RANDOM_MODE) {
    return GAME_MODES[(roomId * 5 + roundNumber * 7) % GAME_MODES.length].id;
  }
  return isGameModeId(value) ? value : null;
}

function choosePrompt(mode: GameModeId, roomId: number, roundNumber: number) {
  const bank = PROMPTS[mode];
  return bank[(roomId * 11 + roundNumber * 13) % bank.length];
}

class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function jsonError(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json(
    { error: error instanceof Error ? error.message : "Arena request failed" },
    { status: 500 },
  );
}
