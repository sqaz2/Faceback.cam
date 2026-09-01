import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("build emits the Cloudflare worker, client manifest, and D1 binding", async () => {
  await Promise.all([
    access(path.join(root, "dist/server/index.js")),
    access(path.join(root, "dist/client/.vite/manifest.json")),
    access(path.join(root, "dist/.openai/hosting.json")),
  ]);

  const worker = await readFile(path.join(root, "dist/server/index.js"), "utf8");
  const wrangler = JSON.parse(await readFile(path.join(root, "dist/server/wrangler.json"), "utf8"));
  const hosting = JSON.parse(await readFile(path.join(root, "dist/.openai/hosting.json"), "utf8"));

  assert.ok(worker.length > 100_000, "compiled worker should not be empty");
  assert.match(worker, /X-Content-Type-Options/);
  assert.match(worker, /strict-origin-when-cross-origin/);
  assert.equal(hosting.d1, "DB");
  assert.ok(wrangler.d1_databases.some((binding) => binding.binding === "DB"));
});

test("build packages every migration byte-for-byte", async () => {
  const sourceDirectory = path.join(root, "drizzle");
  const outputDirectory = path.join(root, "dist/.openai/drizzle");
  const migrations = (await readdir(sourceDirectory)).filter((name) => name.endsWith(".sql")).sort();

  assert.ok(migrations.includes("0005_arena_integrity.sql"));
  for (const migration of migrations) {
    const [source, output] = await Promise.all([
      readFile(path.join(sourceDirectory, migration), "utf8"),
      readFile(path.join(outputDirectory, migration), "utf8"),
    ]);
    assert.equal(output, source, `${migration} differs from its packaged copy`);
  }
});
