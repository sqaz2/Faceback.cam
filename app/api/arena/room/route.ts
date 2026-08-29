import { cleanText, db, getOwnedProfile, requireApiUser } from "../../_shared";

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

const PROMPTS = [
  { mode: "PUNCHLINE", prompt: "Finish it: The AI tried to replace me, but it forgot to _____." },
  { mode: "BAR BATTLE", prompt: "Write one line that sounds like the last bar before a ridiculous beat drop." },
  { mode: "HOOK", prompt: "Write a hook using seven words or fewer about humans making something new." },
  { mode: "BAD AD", prompt: "Sell a completely useless futuristic feature in one sentence." },
  { mode: "TWIST", prompt: "Turn “the machine took my job” into the opening line of a love song." },
  { mode: "CAPTION", prompt: "Caption this imaginary scene: a medieval painter discovers Photoshop." },
  { mode: "CONCEPT", prompt: "Invent a creative tool that absolutely should not exist." },
  { mode: "ROAST", prompt: "Roast the idea “real artists never use shortcuts” without attacking a person." },
  { mode: "WORLD BUILD", prompt: "Name a city where every bad idea becomes a tourist attraction, then describe it in one line." },
  { mode: "CHARACTER", prompt: "Create a superhero whose power is extremely useful but deeply embarrassing." },
  { mode: "LYRIC", prompt: "Write one lyric about winning an argument by making something better." },
  { mode: "TITLE", prompt: "Give a dramatic movie title to the moment your phone battery hits 1%." },
  { mode: "PRODUCT", prompt: "Pitch an AI product designed for a problem nobody has." },
  { mode: "SCENE", prompt: "Write the shortest possible scene where a robot gets fired for being too human." },
  { mode: "REMIX", prompt: "Take “do not press the red button” and make it sound inspirational." },
  { mode: "GENRE", prompt: "Invent a music genre name by combining something ancient with something digital." },
];

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
      const prompt = choosePrompt(room.id, roundNumber);
      await db()
        .prepare(
          `INSERT INTO arena_rounds (room_id, round_number, prompt, mode)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(room.id, roundNumber, prompt.prompt, prompt.mode)
        .run();
      await db()
        .prepare(
          `UPDATE arena_rooms
           SET phase = 'answering', round_number = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(roundNumber, room.id)
        .run();
      return Response.json({ ok: true });
    }

    const round = await getCurrentRound(room);
    if (!round) return Response.json({ error: "No active round." }, { status: 409 });

    if (action === "submit") {
      if (room.phase !== "answering") {
        return Response.json({ error: "Submissions are closed." }, { status: 409 });
      }
      const content = cleanText(payload.content, 280);
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
      const top = Math.max(...rows.map((entry) => Number(entry.voteCount || 0)));
      const winners = [...new Set(rows.filter((entry) => Number(entry.voteCount || 0) === top).map((entry) => entry.playerId))];
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
      const top = Math.max(...rows.map((entry) => Number(entry.voteCount || 0)));
      winners = rows
        .filter((entry) => Number(entry.voteCount || 0) === top)
        .map((entry) => ({
          submissionId: entry.id,
          content: entry.content,
          author: entry.authorName,
          profileHandle: entry.profileHandle,
          voteCount: Number(entry.voteCount || 0),
        }));
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
    counts: {
      players: players.length,
      submissions: round ? await submissionCount(round.id) : 0,
      votes: round ? await voteCount(round.id) : 0,
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

function choosePrompt(roomId: number, roundNumber: number) {
  return PROMPTS[(roomId * 7 + roundNumber * 11) % PROMPTS.length];
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
