#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const OUT = "/workspace/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text());
});

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const enter = page.getByRole("button", { name: /enter the studios|new v-ego|continue/i });
if (await enter.count()) {
  const label = await enter.first().innerText();
  if (/continue/i.test(label)) {
    await page.getByRole("button", { name: /new v-ego/i }).click();
  } else {
    await enter.first().click();
  }
}
await page.waitForTimeout(500);

const tail = page.getByRole("button", { name: /^Tail$/ });
if (await tail.count()) await tail.click();
const cap = page.getByRole("button", { name: /^Cap$/ });
if (await cap.count()) await cap.click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/qa-create.png` });

const walk = page.getByRole("button", { name: /walk in/i });
if (await walk.count()) await walk.click();
await page.waitForTimeout(2500);

const ready = await page.evaluate(() => !!window.__vego?.player?.());
console.log("ready", ready);

const freeze = () =>
  page.evaluate(() => {
    const api = window.__vego;
    for (const a of api.world.actors) {
      a.nextAi = 9999;
      a.path = [];
      if (a.action === "walk") a.action = "idle";
    }
  });

const sitWhite = await page.evaluate(() => {
  const api = window.__vego;
  const p = api.player();
  api.setPlayerLook(
    {
      skin: 0,
      hair: 4,
      hairColor: 0,
      top: 0,
      topColor: 8,
      bottom: 0,
      bottomColor: 8,
      shoeColor: 2,
      accessory: 3,
    },
    "V-Ego",
  );
  const sofa = api.world.furniture.find((f) => f.catalogId === "sofa");
  for (const a of api.world.actors) {
    a.nextAi = 9999;
    a.path = [];
    if (a.sitId) {
      a.action = "idle";
      a.sitId = undefined;
      a.sitSlot = undefined;
    }
  }
  const npc = api.world.actors.find((a) => !a.isPlayer);
  api.occupySeat(npc, sofa.id, 0);
  const ok = api.occupySeat(p, sofa.id, 1);
  const TILE_W = 64,
    TILE_H = 32;
  const scr = (x, y) => ({ x: (x - y) * (TILE_W / 2), y: (x + y) * (TILE_H / 2) });
  const cx = sofa.x + 0.5;
  const cy = sofa.y;
  return {
    ok,
    player: { x: p.x, y: p.y, action: p.action, slot: p.sitSlot, scr: scr(p.x, p.y) },
    npc: npc ? { name: npc.name, x: npc.x, y: npc.y, slot: npc.sitSlot, scr: scr(npc.x, npc.y) } : null,
    sofa: { x: sofa.x, y: sofa.y, origin: scr(cx, cy) },
  };
});
console.log("SIT_WHITE", JSON.stringify(sitWhite));
await freeze();
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/qa-sit-white.png` });

const sitRed = await page.evaluate(() => {
  const api = window.__vego;
  const p = api.player();
  api.setPlayerLook(
    {
      skin: 2,
      hair: 5,
      hairColor: 0,
      top: 2,
      topColor: 0,
      bottom: 0,
      bottomColor: 2,
      shoeColor: 2,
      accessory: 2,
    },
    "V-Ego",
  );
  return { action: p.action, topColor: p.appearance.topColor, hair: p.appearance.hair };
});
console.log("SIT_RED", JSON.stringify(sitRed));
await freeze();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/qa-sit-red.png` });

const sitChair = await page.evaluate(() => {
  const api = window.__vego;
  const p = api.player();
  const chair = api.world.furniture.find((f) => f.catalogId === "chair");
  api.setPlayerLook(
    {
      skin: 0,
      hair: 2,
      hairColor: 1,
      top: 0,
      topColor: 0,
      bottom: 0,
      bottomColor: 2,
      shoeColor: 2,
      accessory: 1,
    },
    "V-Ego",
  );
  const ok = api.occupySeat(p, chair.id, 0);
  return { ok, x: p.x, y: p.y, chair: { x: chair.x, y: chair.y } };
});
console.log("SIT_CHAIR", JSON.stringify(sitChair));
await freeze();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/qa-sit-chair.png` });

const stand = await page.evaluate(() => {
  const api = window.__vego;
  const p = api.player();
  p.action = "idle";
  p.sitId = undefined;
  p.sitSlot = undefined;
  p.x = 7.5;
  p.y = 9.5;
  p.dir = 1;
  return { x: p.x, y: p.y };
});
console.log("STAND", JSON.stringify(stand));
await freeze();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/qa-stand.png` });

await browser.close();
