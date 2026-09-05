#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [
  process.env.COKE_MUSIC_ART_ZIP,
  join(root, "../../coke-music-art.zip"),
  join(root, "../coke-music-art.zip"),
  join(root, "coke-music-art.zip"),
  "/workspace/faceback-coke/coke-music-art.zip",
].filter(Boolean);

const zip = candidates.find((c) => existsSync(c));
if (!zip) {
  console.error("Could not find coke-music-art.zip. Set COKE_MUSIC_ART_ZIP or place it at the Faceback.cam repo root.");
  process.exit(1);
}
console.log(`Extracting ${zip} -> ${root}/`);
const r = spawnSync("unzip", ["-o", zip, "-d", root], { stdio: "inherit" });
if (r.status !== 0) process.exit(r.status ?? 1);
if (existsSync(join(root, "public/art"))) {
  console.log(`Art ready at ${join(root, "public/art")}`);
} else if (existsSync(join(root, "art"))) {
  mkdirSync(join(root, "public"), { recursive: true });
  cpSync(join(root, "art"), join(root, "public/art"), { recursive: true });
  console.log(`Art copied to ${join(root, "public/art")}`);
} else {
  console.warn(`Warning: unzipped but public/art not found. Inspect ${root}`);
}
