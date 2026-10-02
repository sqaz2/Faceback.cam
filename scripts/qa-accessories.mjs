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

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1200);

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
  await clickFirst(/^Crop$/, "Crop");
  await clickFirst(/^Shades$/, "Shades");
  await page.evaluate(() => {
    const shell = document.querySelector(".coke-place-shell");
    if (shell) shell.scrollTop = 0;
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas[aria-label^="Your character"]');
    return canvas instanceof HTMLCanvasElement && canvas.width > 8;
  }, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/qa-create-shades.png` });
  await clickFirst(/^Headphones$/, "Headphones");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/qa-create-headphones.png` });
  await clickFirst(/^Cap$/, "Cap");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/qa-create.png` });
  await clickFirst(/enter room|walk in/i, "enter room");
  await page.waitForTimeout(2000);
}

await clickFirst(/got it/i, "got it");
await page.waitForTimeout(400);

const ready = await page.waitForFunction(() => !!window.__vego?.player?.(), { timeout: 20000 }).then(() => true).catch(() => false);
console.log("ready", ready);
if (!ready) {
  await page.screenshot({ path: `${OUT}/qa-not-ready.png` });
  await browser.close();
  process.exit(1);
}

const freeze = () =>
  page.evaluate(() => {
    const api = window.__vego;
    for (const a of api.world.actors) {
      a.nextAi = 9999;
      a.path = [];
      if (a.action === "walk") a.action = "idle";
    }
  });

async function sitLook(name, look, accessoryLabel) {
  const result = await page.evaluate(({ look }) => {
    const api = window.__vego;
    const p = api.player();
    api.setPlayerLook(look, "V-Ego");
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
    if (npc) api.occupySeat(npc, sofa.id, 0);
    const ok = api.occupySeat(p, sofa.id, 1);
    return { ok, action: p.action, accessory: p.appearance.accessory };
  }, { look });
  console.log(name, JSON.stringify(result));
  await freeze();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

// White clothes + Cap (baseline face visibility)
await sitLook("qa-sit-white", {
  skin: 0, hair: 4, hairColor: 0, top: 0, topColor: 8, bottom: 0, bottomColor: 8,
  shoeColor: 2, accessory: 3, body: 0, shoe: 0,
});

// White + Shades
await sitLook("qa-sit-shades-white", {
  skin: 0, hair: 2, hairColor: 0, top: 0, topColor: 8, bottom: 0, bottomColor: 8,
  shoeColor: 2, accessory: 1, body: 0, shoe: 0,
});

// White + Headphones
await sitLook("qa-sit-headphones-white", {
  skin: 0, hair: 0, hairColor: 1, top: 0, topColor: 8, bottom: 0, bottomColor: 8,
  shoeColor: 2, accessory: 2, body: 0, shoe: 0,
});

// Red hoodie + headphones (legacy sit-red style)
await sitLook("qa-sit-red", {
  skin: 2, hair: 5, hairColor: 0, top: 2, topColor: 0, bottom: 0, bottomColor: 2,
  shoeColor: 2, accessory: 2, body: 0, shoe: 0,
});

const sitChair = await page.evaluate(() => {
  const api = window.__vego;
  const p = api.player();
  for (const a of api.world.actors) {
    if (a.sitId) { a.action = "idle"; a.sitId = undefined; a.sitSlot = undefined; }
  }
  api.setPlayerLook({
    skin: 0, hair: 2, hairColor: 1, top: 0, topColor: 0, bottom: 0, bottomColor: 2,
    shoeColor: 2, accessory: 1, body: 0, shoe: 0,
  }, "V-Ego");
  const chair = api.world.furniture.find((f) => f.catalogId === "chair");
  const ok = chair ? api.occupySeat(p, chair.id, 0) : false;
  return { ok, x: p.x, y: p.y };
});
console.log("SIT_CHAIR", JSON.stringify(sitChair));
await freeze();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/qa-sit-chair.png` });

// Stand with shades
await page.evaluate(() => {
  const p = window.__vego.player();
  p.action = "idle"; p.sitId = undefined; p.sitSlot = undefined;
  p.x = 6.5; p.y = 7.5; p.dir = 1;
  window.__vego.setPlayerLook({
    skin: 0, hair: 2, hairColor: 0, top: 0, topColor: 8, bottom: 0, bottomColor: 8,
    shoeColor: 2, accessory: 1, body: 0, shoe: 0,
  }, "V-Ego");
});
await freeze();
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/qa-stand-shades.png` });

await page.evaluate(() => {
  window.__vego.setPlayerLook({
    skin: 0, hair: 0, hairColor: 1, top: 0, topColor: 8, bottom: 0, bottomColor: 8,
    shoeColor: 2, accessory: 2, body: 0, shoe: 0,
  }, "V-Ego");
});
await freeze();
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/qa-stand-headphones.png` });
await page.screenshot({ path: `${OUT}/qa-stand.png` });

const copies = [
  "qa-create.png", "qa-sit-white.png", "qa-sit-red.png", "qa-sit-chair.png", "qa-stand.png",
  "qa-create-shades.png", "qa-create-headphones.png", "qa-sit-shades-white.png",
  "qa-sit-headphones-white.png", "qa-stand-shades.png", "qa-stand-headphones.png",
];
for (const f of copies) {
  try { copyFileSync(`${OUT}/${f}`, `${SHOTS}/${f}`); } catch {}
}
console.log("done");
await browser.close();
