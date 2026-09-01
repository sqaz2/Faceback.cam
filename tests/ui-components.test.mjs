import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

test("Arena identity only accepts a published profile and never needs an email", async () => {
  const { arenaParticipantIdentity, publicArenaIdentity } = await vite.ssrLoadModule("/app/arena/public-identity.ts");

  assert.equal(publicArenaIdentity(null), null);
  assert.equal(
    publicArenaIdentity({ id: 1, handle: "hidden", displayName: "Hidden", published: 0 }),
    null,
  );
  assert.deepEqual(
    publicArenaIdentity({ id: 7, handle: "@Nova", displayName: "  Nova  ", published: 1 }),
    { profileId: 7, profileHandle: "nova", displayName: "Nova" },
  );
  assert.deepEqual(
    arenaParticipantIdentity(null, "  Invited Player  "),
    { profileId: null, profileHandle: "", displayName: "Invited Player" },
  );
  assert.deepEqual(
    arenaParticipantIdentity(
      { id: 8, handle: "private", displayName: "Private", published: 0 },
      "Guest Name",
    ),
    { profileId: null, profileHandle: "", displayName: "Guest Name" },
  );

  const authSource = await readFile(path.join(root, "app/chatgpt-auth.ts"), "utf8");
  assert.doesNotMatch(authSource, /displayName:\s*fullName\s*\?\?\s*email/);
  assert.match(authSource, /displayName:\s*fullName\s*\?\?\s*["']FACEBACK Creator["']/);
});

test("Arena room creation and joining both support profile-free players", async () => {
  const roomSource = await readFile(path.join(root, "app/api/arena/room/route.ts"), "utf8");
  const spectatorSource = await readFile(path.join(root, "app/api/arena/spectate/route.ts"), "utf8");

  assert.match(roomSource, /arenaParticipantIdentity\([\s\S]*user\.displayName/);
  assert.equal(roomSource.match(/arenaParticipantIdentity\(/g)?.length, 2);
  assert.doesNotMatch(roomSource, /requireArenaIdentity/);
  assert.doesNotMatch(roomSource, /Create and publish your FACEBACK profile/);
  assert.doesNotMatch(roomSource, /JOIN profiles pr ON pr\.id = p\.profile_id AND pr\.published = 1/);
  assert.doesNotMatch(roomSource, /EXISTS \(SELECT 1 FROM profiles WHERE id = arena_players\.profile_id/);
  assert.doesNotMatch(spectatorSource, /JOIN profiles pr ON pr\.id = p\.profile_id AND pr\.published = 1/);
});

test("the public mobile call to action opens the Arena instead of profile creation", async () => {
  const homeSource = await readFile(path.join(root, "app/page.tsx"), "utf8");
  assert.match(homeSource, /className="mini-cta" href="\/arena"/);
  assert.match(homeSource, />\s*Play\s*</);
});

test("all game modes and timer presets have valid, unique contracts", async () => {
  const { GAME_MODES, getGameMode } = await vite.ssrLoadModule("/app/arena/game-modes.ts");
  const { MATCH_LENGTHS, TIMER_PRESETS, getTimerPreset } = await vite.ssrLoadModule("/app/arena/match-config.ts");

  assert.deepEqual(MATCH_LENGTHS, [3, 5]);
  assert.equal(new Set(GAME_MODES.map((mode) => mode.id)).size, GAME_MODES.length);
  assert.ok(GAME_MODES.every((mode) => mode.maxChars >= 100 && mode.maxChars <= 280));
  assert.ok(GAME_MODES.every((mode) => mode.criteria.length === 3));
  assert.equal(getGameMode("RAP")?.name, "Rap Battle");

  assert.equal(new Set(TIMER_PRESETS.map((preset) => preset.id)).size, TIMER_PRESETS.length);
  assert.ok(TIMER_PRESETS.every((preset) => preset.answerSeconds > preset.voteSeconds));
  assert.equal(getTimerPreset("invalid").id, "STANDARD");
});

test("room codes are long enough for public spectator links and omit ambiguous characters", async () => {
  const { ARENA_ROOM_CODE_LENGTH, normalizeArenaRoomCode } = await vite.ssrLoadModule("/app/arena/room-code.ts");

  assert.equal(ARENA_ROOM_CODE_LENGTH, 8);
  assert.equal(normalizeArenaRoomCode(" abcd2345 "), "ABCD2345");
  assert.equal(normalizeArenaRoomCode("ABCDE"), "");
  assert.equal(normalizeArenaRoomCode("ABCD0OIL"), "");
});
