import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const migrationsDirectory = path.join(root, "drizzle");

async function migrationFiles() {
  return (await readdir(migrationsDirectory))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

async function applyMigration(database, name) {
  const sql = await readFile(path.join(migrationsDirectory, name), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) {
    database.exec(statement);
  }
}

async function migratedDatabase(through) {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const name of await migrationFiles()) {
    await applyMigration(database, name);
    if (name === through) break;
  }
  return database;
}

test("Arena migrations apply cleanly and preserve referential integrity", async () => {
  const database = await migratedDatabase();
  try {
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
    assert.ok(tables.includes("profiles"));
    assert.ok(tables.includes("arena_rooms"));
    assert.ok(tables.includes("arena_round_awards"));
    assert.ok(tables.includes("arena_action_limits"));

    const columns = database.prepare("PRAGMA table_info(arena_players)").all().map((row) => row.name);
    assert.ok(columns.includes("profile_id"));
    assert.ok(columns.includes("active"));
    assert.ok(columns.includes("left_at"));
    assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    database.close();
  }
});

test("integrity migration backfills existing Arena players without losing data", async () => {
  const database = await migratedDatabase("0004_arena_live_public.sql");
  try {
    database.exec(`
      INSERT INTO profiles (user_email, handle, display_name) VALUES
        ('creator@example.test', 'creator', 'Creator'),
        ('voter@example.test', 'voter', 'Voter');
      INSERT INTO arena_rooms (code, host_email) VALUES ('ABCD2345', 'creator@example.test');
      INSERT INTO arena_players (room_id, user_email, display_name, profile_handle) VALUES
        (1, 'creator@example.test', 'Creator', 'creator'),
        (1, 'voter@example.test', 'Voter', 'voter');
      INSERT INTO arena_rounds (room_id, match_number, round_number, prompt, mode, status)
      VALUES (1, 1, 1, 'Prompt', 'RAP', 'results');
      INSERT INTO arena_submissions (round_id, player_id, content) VALUES
        (1, 1, 'Winning entry'),
        (1, 2, 'Other entry');
      INSERT INTO arena_votes (round_id, voter_player_id, submission_id) VALUES (1, 2, 1);
    `);

    await applyMigration(database, "0005_arena_integrity.sql");
    const player = database.prepare("SELECT profile_id AS profileId, active, left_at AS leftAt FROM arena_players").get();
    assert.equal(player.profileId, 1);
    assert.equal(player.active, 1);
    assert.equal(player.leftAt, null);
    assert.deepEqual(
      database.prepare("SELECT round_id AS roundId, player_id AS playerId FROM arena_round_awards").all().map((row) => [row.roundId, row.playerId]),
      [[1, 1]],
    );
    assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    database.close();
  }
});

test("stable profile ids prevent history from moving when handles are reassigned", async () => {
  const database = await migratedDatabase();
  try {
    database.exec(`
      INSERT INTO profiles (user_email, handle, display_name) VALUES
        ('a@example.test', 'nova', 'Creator A'),
        ('b@example.test', 'ember', 'Creator B');
      INSERT INTO arena_rooms (code, host_email) VALUES ('ABCD2345', 'a@example.test');
      INSERT INTO arena_players (room_id, user_email, profile_id, display_name, profile_handle)
      VALUES (1, 'a@example.test', 1, 'Creator A', 'nova');
      UPDATE profiles SET handle = 'nova-new' WHERE id = 1;
      UPDATE profiles SET handle = 'nova' WHERE id = 2;
    `);

    const owner = database.prepare(`
      SELECT p.user_email AS email
      FROM arena_players p
      WHERE p.profile_id = (SELECT id FROM profiles WHERE handle = ? AND published = 1)
    `);
    assert.equal(owner.get("nova-new")?.email, "a@example.test");
    assert.equal(owner.get("nova"), undefined);

    const source = await readFile(path.join(root, "db/profile-queries.ts"), "utf8");
    assert.match(source, /WHERE p\.profile_id = \(/);
    assert.doesNotMatch(source, /WHERE p\.profile_handle = \?/);
  } finally {
    database.close();
  }
});

test("round awards are unique, so retries cannot double-score a winner", async () => {
  const database = await migratedDatabase();
  try {
    database.exec(`
      INSERT INTO profiles (user_email, handle, display_name) VALUES ('winner@example.test', 'winner', 'Winner');
      INSERT INTO arena_rooms (code, host_email, match_status) VALUES ('ABCD2345', 'winner@example.test', 'active');
      INSERT INTO arena_players (room_id, user_email, profile_id, display_name, profile_handle)
      VALUES (1, 'winner@example.test', 1, 'Winner', 'winner');
      INSERT INTO arena_rounds (room_id, match_number, round_number, prompt, mode, status)
      VALUES (1, 1, 1, 'Prompt', 'RAP', 'results');
      INSERT OR IGNORE INTO arena_round_awards (round_id, player_id) VALUES (1, 1);
      INSERT OR IGNORE INTO arena_round_awards (round_id, player_id) VALUES (1, 1);
    `);

    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM arena_round_awards").get().count, 1);
    const liveSource = await readFile(path.join(root, "app/api/arena/_live.ts"), "utf8");
    assert.match(liveSource, /INSERT OR IGNORE INTO arena_round_awards/);
    assert.match(liveSource, /SET score = \(/);
    assert.doesNotMatch(liveSource, /score\s*=\s*score\s*\+\s*1/);
  } finally {
    database.close();
  }
});

test("round status guards reject submissions and votes that arrive after closure", async () => {
  const database = await migratedDatabase();
  try {
    database.exec(`
      INSERT INTO profiles (user_email, handle, display_name) VALUES
        ('a@example.test', 'creator-a', 'Creator A'),
        ('b@example.test', 'creator-b', 'Creator B');
      INSERT INTO arena_rooms (code, host_email, phase, match_status, round_number)
      VALUES ('ABCD2345', 'a@example.test', 'answering', 'active', 1);
      INSERT INTO arena_players (room_id, user_email, profile_id, display_name, profile_handle) VALUES
        (1, 'a@example.test', 1, 'Creator A', 'creator-a'),
        (1, 'b@example.test', 2, 'Creator B', 'creator-b');
      INSERT INTO arena_rounds (room_id, match_number, round_number, prompt, mode, status)
      VALUES (1, 1, 1, 'Prompt', 'RAP', 'answering');
    `);

    const submit = database.prepare(`
      INSERT INTO arena_submissions (round_id, player_id, content)
      SELECT ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM arena_rounds WHERE id = ? AND status = 'answering')
      ON CONFLICT(round_id, player_id)
      DO UPDATE SET content = excluded.content, created_at = CURRENT_TIMESTAMP
    `);
    assert.equal(submit.run(1, 1, "First", 1).changes, 1);
    assert.equal(submit.run(1, 2, "Second", 1).changes, 1);

    database.exec("UPDATE arena_rounds SET status = 'voting' WHERE id = 1");
    assert.equal(submit.run(1, 1, "Too late", 1).changes, 0);
    assert.equal(database.prepare("SELECT content FROM arena_submissions WHERE player_id = 1").get().content, "First");

    const vote = database.prepare(`
      INSERT INTO arena_votes (round_id, voter_player_id, submission_id)
      SELECT ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM arena_rounds WHERE id = ? AND status = 'voting')
      ON CONFLICT(round_id, voter_player_id)
      DO UPDATE SET submission_id = excluded.submission_id, created_at = CURRENT_TIMESTAMP
    `);
    assert.equal(vote.run(1, 1, 2, 1).changes, 1);
    database.exec("UPDATE arena_rounds SET status = 'revealing' WHERE id = 1");
    assert.equal(vote.run(1, 2, 1, 1).changes, 0);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM arena_votes").get().count, 1);
  } finally {
    database.close();
  }
});
