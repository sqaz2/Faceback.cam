#!/usr/bin/env node
import { mkdirSync, copyFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = "/workspace/Faceback.cam/qa-out";
const SHOTS = "/workspace/Faceback.cam/coke-music/screenshots";
mkdirSync(OUT, { recursive: true });
mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.QA_BASE || "http://127.0.0.1:5173/world";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 200));
});

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1500);

async function clickFirst(re, label) {
  const btn = page.getByRole("button", { name: re }).first();
  if (await btn.count()) {
    console.log("click", label || (await btn.innerText()).trim());
    await btn.click();
    await page.waitForTimeout(600);
    return true;
  }
  return false;
}

await clickFirst(/enter faceback\.cam|enter the studios/i, "enter");
await clickFirst(/new character|new v-ego/i, "new");
if (await page.getByRole("button", { name: /enter room|walk in/i }).count()) {
  await clickFirst(/^Tail$/, "Tail");
  await clickFirst(/^Cap$/, "Cap");
  await clickFirst(/enter room|walk in/i, "enter room");
  await page.waitForTimeout(2000);
}
await clickFirst(/got it/i, "got it");
await page.waitForTimeout(400);

const ready = await page
  .waitForFunction(() => !!window.__vego?.player?.(), { timeout: 20000 })
  .then(() => true)
  .catch(() => false);
console.log("ready", ready);
if (!ready) {
  await page.screenshot({ path: `${OUT}/qa-walk-not-ready.png` });
  await browser.close();
  process.exit(1);
}

const phases = [
  { name: "plant", deg: 0, phase: 0 },
  { name: "push", deg: 90, phase: Math.PI * 0.5 },
  { name: "mid", deg: 180, phase: Math.PI },
  { name: "recover", deg: 270, phase: Math.PI * 1.5 },
];

for (const p of phases) {
  const info = await page.evaluate((phase) => {
    const api = window.__vego;
    const player = api.player();
    api.setPlayerLook(
      {
        skin: 0,
        hair: 4,
        hairColor: 0,
        top: 1,
        topColor: 0,
        bottom: 0,
        bottomColor: 2,
        shoeColor: 2,
        accessory: 0,
        body: 0,
        shoe: 0,
      },
      "Walker",
    );
    for (const a of api.world.actors) {
      a.nextAi = 9999;
      a.path = [];
      if (a.sitId) {
        a.action = "idle";
        a.sitId = undefined;
        a.sitSlot = undefined;
      }
      if (!a.isPlayer && a.action === "walk") a.action = "idle";
    }
    player.action = "walk";
    player.path = [];
    player.sitId = undefined;
    player.sitSlot = undefined;
    player.x = 6.2;
    player.y = 7.4;
    player.dir = 0;
    player.walkPhase = phase;
    return { x: player.x, y: player.y, walkPhase: player.walkPhase, action: player.action };
  }, p.phase);
  console.log("PHASE", p.name, info);
  // Freeze time briefly so render uses the locked walkPhase (loop still ticks).
  await page.evaluate((phase) => {
    const api = window.__vego;
    const player = api.player();
    // Re-assert each frame for a short window via rAF hooks is heavy; just stamp a few times.
    player.walkPhase = phase;
    player.action = "walk";
  }, p.phase);
  await page.waitForTimeout(200);
  await page.evaluate((phase) => {
    const player = window.__vego.player();
    player.walkPhase = phase;
    player.action = "walk";
  }, p.phase);
  await page.waitForTimeout(350);
  const file = `qa-walk-phase-${p.deg}.png`;
  await page.screenshot({ path: `${OUT}/${file}` });
  copyFileSync(`${OUT}/${file}`, `${SHOTS}/${file}`);
  console.log("wrote", file);
}

await browser.close();
console.log("walk QA done");
