import { env } from "cloudflare:workers";
import type { ChatGPTUser } from "../app/chatgpt-auth";

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;
const ROOM_LIFETIME_HOURS = 6;
const ONLINE_WINDOW_SECONDS = 15;

type RoomRow = {
  code: string;
  hostEmail: string;
  status: "lobby" | "live" | "ended";
  maxPlayers: number;
  createdAt: string;
  startedAt: string | null;
};

type PlayerRow = {
  userEmail: string;
  displayName: string;
  handle: string;
  seat: number;
  ready: number;
  online: number;
};

export type PublicRoomPlayer = {
  displayName: string;
  handle: string;
  seat: number;
  ready: boolean;
  online: boolean;
  isHost: boolean;
  isSelf: boolean;
};

export type PublicRoomState = {
  code: string;
  status: "lobby" | "live" | "ended";
  maxPlayers: number;
  createdAt: string;
  startedAt: string | null;
  isHost: boolean;
  canStart: boolean;
  players: PublicRoomPlayer[];
};

export class RoomError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RoomError";
    this.status = status;
  }
}

function database() {
  if (!env.DB) throw new RoomError("Game rooms are not available.", 503);
  return env.DB;
}

export function normalizeRoomCode(value: unknown) {
  return typeof value === "string"
    ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH)
    : "";
}

export function validRoomCode(code: string) {
  return /^[A-HJ-NP-Z2-9]{6}$/.test(code);
}

export async function createRoom(user: ChatGPTUser) {
  const recent = await database()
    .prepare(
      `SELECT COUNT(*) AS total
       FROM game_rooms
       WHERE host_email = ? AND created_at >= datetime('now', '-1 hour')`,
    )
    .bind(user.email)
    .first<{ total: number }>();

  if ((recent?.total ?? 0) >= 10) {
    throw new RoomError("You have created several rooms recently. Reuse an invite or try later.", 429);
  }

  const identity = await creatorIdentity(user);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomRoomCode();
    try {
      await database().batch([
        database()
          .prepare(
            `INSERT INTO game_rooms (code, host_email, status, max_players)
             VALUES (?, ?, 'lobby', 6)`,
          )
          .bind(code, user.email),
        database()
          .prepare(
            `INSERT INTO game_players
              (room_code, user_email, display_name, handle, seat, ready)
             VALUES (?, ?, ?, ?, 1, 0)`,
          )
          .bind(code, user.email, identity.displayName, identity.handle),
      ]);
      return getRoomState(code, user.email, false);
    } catch (error) {
      if (attempt === 5) throw error;
    }
  }

  throw new RoomError("Unable to create a room. Try again.", 500);
}

export async function joinRoom(rawCode: unknown, user: ChatGPTUser) {
  const code = normalizeRoomCode(rawCode);
  if (!validRoomCode(code)) throw new RoomError("Enter a six-character room code.");

  const room = await getRoom(code);
  if (!room || roomExpired(room.createdAt)) {
    throw new RoomError("That room could not be found or has expired.", 404);
  }

  const identity = await creatorIdentity(user);
  const existing = await database()
    .prepare("SELECT id FROM game_players WHERE room_code = ? AND user_email = ? LIMIT 1")
    .bind(code, user.email)
    .first<{ id: number }>();

  if (existing) {
    await database()
      .prepare(
        `UPDATE game_players
         SET display_name = ?, handle = ?, last_seen_at = CURRENT_TIMESTAMP
         WHERE room_code = ? AND user_email = ?`,
      )
      .bind(identity.displayName, identity.handle, code, user.email)
      .run();
    return getRoomState(code, user.email, false);
  }

  if (room.status !== "lobby") {
    throw new RoomError("That performance has already started.", 409);
  }

  const seats = await database()
    .prepare("SELECT seat FROM game_players WHERE room_code = ? ORDER BY seat ASC")
    .bind(code)
    .all<{ seat: number }>();
  const used = new Set(seats.results.map((player) => player.seat));
  const seat = Array.from({ length: room.maxPlayers }, (_, index) => index + 1).find(
    (candidate) => !used.has(candidate),
  );

  if (!seat) throw new RoomError("That room is full.", 409);

  try {
    await database()
      .prepare(
        `INSERT INTO game_players
          (room_code, user_email, display_name, handle, seat, ready)
         VALUES (?, ?, ?, ?, ?, 0)`,
      )
      .bind(code, user.email, identity.displayName, identity.handle, seat)
      .run();
  } catch {
    throw new RoomError("The room changed while you joined. Try the code again.", 409);
  }

  return getRoomState(code, user.email, false);
}

export async function heartbeatRoom(rawCode: unknown, user: ChatGPTUser) {
  const code = checkedCode(rawCode);
  await database()
    .prepare(
      `UPDATE game_players
       SET last_seen_at = CURRENT_TIMESTAMP
       WHERE room_code = ? AND user_email = ?`,
    )
    .bind(code, user.email)
    .run();
  return getRoomState(code, user.email, false);
}

export async function setPlayerReady(rawCode: unknown, user: ChatGPTUser, ready: boolean) {
  const code = checkedCode(rawCode);
  const room = await getRoom(code);
  if (!room) throw new RoomError("Room not found.", 404);
  if (room.status !== "lobby") throw new RoomError("The room has already started.", 409);

  await database()
    .prepare(
      `UPDATE game_players
       SET ready = ?, last_seen_at = CURRENT_TIMESTAMP
       WHERE room_code = ? AND user_email = ?`,
    )
    .bind(ready ? 1 : 0, code, user.email)
    .run();
  return getRoomState(code, user.email, false);
}

export async function startRoom(rawCode: unknown, user: ChatGPTUser) {
  const code = checkedCode(rawCode);
  const room = await getRoom(code);
  if (!room) throw new RoomError("Room not found.", 404);
  if (room.hostEmail !== user.email) throw new RoomError("Only the room host can start.", 403);
  if (room.status !== "lobby") return getRoomState(code, user.email, true);

  await database()
    .prepare(
      `UPDATE game_players
       SET last_seen_at = CURRENT_TIMESTAMP
       WHERE room_code = ? AND user_email = ?`,
    )
    .bind(code, user.email)
    .run();

  const counts = await database()
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN ready = 1 THEN 1 ELSE 0 END) AS readyTotal,
         SUM(CASE WHEN last_seen_at >= datetime('now', '-${ONLINE_WINDOW_SECONDS} seconds') THEN 1 ELSE 0 END) AS onlineTotal
       FROM game_players
       WHERE room_code = ?`,
    )
    .bind(code)
    .first<{ total: number; readyTotal: number; onlineTotal: number }>();

  const total = counts?.total ?? 0;
  if (total < 2) throw new RoomError("At least two creators must join before starting.", 409);
  if ((counts?.onlineTotal ?? 0) !== total) {
    throw new RoomError("Wait for every creator to reconnect before starting.", 409);
  }
  if ((counts?.readyTotal ?? 0) !== total) {
    throw new RoomError("Everyone must ready up before starting.", 409);
  }

  await database()
    .prepare(
      `UPDATE game_rooms
       SET status = 'live', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE code = ? AND status = 'lobby'`,
    )
    .bind(code)
    .run();
  return getRoomState(code, user.email, false);
}

export async function getRoomState(
  rawCode: unknown,
  userEmail: string,
  touchPresence = true,
): Promise<PublicRoomState> {
  const code = checkedCode(rawCode);
  const room = await getRoom(code);
  if (!room || roomExpired(room.createdAt)) throw new RoomError("Room not found or expired.", 404);

  if (touchPresence) {
    await database()
      .prepare(
        `UPDATE game_players
         SET last_seen_at = CURRENT_TIMESTAMP
         WHERE room_code = ? AND user_email = ?`,
      )
      .bind(code, userEmail)
      .run();
  }

  const playersResult = await database()
    .prepare(
      `SELECT user_email AS userEmail, display_name AS displayName, handle, seat, ready,
        CASE WHEN last_seen_at >= datetime('now', '-${ONLINE_WINDOW_SECONDS} seconds') THEN 1 ELSE 0 END AS online
       FROM game_players
       WHERE room_code = ?
       ORDER BY seat ASC`,
    )
    .bind(code)
    .all<PlayerRow>();

  const member = playersResult.results.some((player) => player.userEmail === userEmail);
  if (!member) throw new RoomError("Join this room before viewing it.", 403);

  const players = playersResult.results.map<PublicRoomPlayer>((player) => ({
    displayName: player.displayName,
    handle: player.handle,
    seat: player.seat,
    ready: Boolean(player.ready),
    online: Boolean(player.online),
    isHost: player.userEmail === room.hostEmail,
    isSelf: player.userEmail === userEmail,
  }));
  const allOnline = players.every((player) => player.online);
  const allReady = players.every((player) => player.ready);

  return {
    code: room.code,
    status: room.status,
    maxPlayers: room.maxPlayers,
    createdAt: room.createdAt,
    startedAt: room.startedAt,
    isHost: room.hostEmail === userEmail,
    canStart: room.status === "lobby" && players.length >= 2 && allOnline && allReady,
    players,
  };
}

async function getRoom(code: string) {
  return database()
    .prepare(
      `SELECT code, host_email AS hostEmail, status, max_players AS maxPlayers,
        created_at AS createdAt, started_at AS startedAt
       FROM game_rooms
       WHERE code = ?
       LIMIT 1`,
    )
    .bind(code)
    .first<RoomRow>();
}

async function creatorIdentity(user: ChatGPTUser) {
  const profile = await database()
    .prepare(
      `SELECT display_name AS displayName, handle
       FROM profiles
       WHERE user_email = ?
       LIMIT 1`,
    )
    .bind(user.email)
    .first<{ displayName: string; handle: string }>();

  return {
    displayName: (profile?.displayName || user.displayName || "Creator").slice(0, 70),
    handle: (profile?.handle || "").slice(0, 30),
  };
}

function checkedCode(value: unknown) {
  const code = normalizeRoomCode(value);
  if (!validRoomCode(code)) throw new RoomError("Invalid room code.");
  return code;
}

function randomRoomCode() {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join("");
}

function roomExpired(createdAt: string) {
  const created = new Date(`${createdAt.replace(" ", "T")}Z`).getTime();
  return !Number.isFinite(created) || Date.now() - created > ROOM_LIFETIME_HOURS * 60 * 60 * 1000;
}
