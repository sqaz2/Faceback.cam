#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const OUT = "/workspace/Faceback.cam/qa-out";
mkdirSync(OUT, { recursive: true });
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
    await page.waitForTimeout(700);
    return true;
  }
  return false;
}

await clickFirst(/enter faceback\.cam|enter the studios/i, "enter");
await clickFirst(/new character|new v-ego/i, "new");
// create screen
if (await page.getByRole("button", { name: /enter room|walk in/i }).count()) {
  await clickFirst(/^Tail$/, "Tail");
  await clickFirst(/^Cap$/, "Cap");
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
  await page.screenshot({ path: `${OUT}/qa-create.png` });
  await clickFirst(/enter room|walk in/i, "enter room");
  await page.waitForTimeout(2000);
}

await clickFirst(/got it/i, "got it");
await page.waitForTimeout(500);

const ready = await page
  .waitForFunction(() => !!window.__vego?.player?.(), { timeout: 20000 })
  .then(() => true)
  .catch(() => false);
console.log("ready", ready);
if (!ready) {
  await page.screenshot({ path: `${OUT}/qa-not-ready.png` });
  console.log("buttons", await page.locator("button").allInnerTexts());
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
      body: 0,
      shoe: 0,
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
  if (npc) api.occupySeat(npc, sofa.id, 0);
  const ok = api.occupySeat(p, sofa.id, 1);
  const scr = (x, y) => ({ x: (x - y) * 32, y: (x + y) * 16 });
  return {
    ok,
    player: { x: p.x, y: p.y, action: p.action, slot: p.sitSlot, scr: scr(p.x, p.y) },
    npc: npc ? { name: npc.name, x: npc.x, y: npc.y, slot: npc.sitSlot, scr: scr(npc.x, npc.y) } : null,
    sofa: { x: sofa.x, y: sofa.y, origin: scr(sofa.x + 0.5, sofa.y) },
    syDelta: npc ? Math.abs(scr(p.x, p.y).y - scr(npc.x, npc.y).y) : null,
    sxDelta: npc ? Math.abs(scr(p.x, p.y).x - scr(npc.x, npc.y).x) : null,
  };
});
console.log("SIT_WHITE", JSON.stringify(sitWhite));
await freeze();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/qa-sit-white.png` });

await page.evaluate(() => {
  window.__vego.setPlayerLook(
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
      body: 0,
      shoe: 0,
    },
    "V-Ego",
  );
});
await freeze();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/qa-sit-red.png` });

const sitChair = await page.evaluate(() => {
  const api = window.__vego;
  const p = api.player();
  for (const a of api.world.actors) {
    if (a.sitId) {
      a.action = "idle";
      a.sitId = undefined;
      a.sitSlot = undefined;
    }
  }
  const chair = api.world.furniture.find((f) => f.catalogId === "chair");
  const ok = chair ? api.occupySeat(p, chair.id, 0) : false;
  return { ok, x: p.x, y: p.y, chair: chair && { x: chair.x, y: chair.y } };
});
console.log("SIT_CHAIR", JSON.stringify(sitChair));
await freeze();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/qa-sit-chair.png` });

await page.evaluate(() => {
  const p = window.__vego.player();
  p.action = "idle";
  p.sitId = undefined;
  p.sitSlot = undefined;
  p.x = 6.5;
  p.y = 7.5;
});
await freeze();
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/qa-stand.png` });

const sitBooth = await page.evaluate(() => {
  const api = window.__vego;
  api.enterRoom("london");
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
      body: 0,
      shoe: 0,
    },
    "V-Ego",
  );
  for (const a of api.world.actors) {
    a.nextAi = 9999;
    a.path = [];
    if (a.sitId) {
      a.action = "idle";
      a.sitId = undefined;
      a.sitSlot = undefined;
    }
  }
  const booth = api.world.furniture.find((f) => f.catalogId === "booth");
  const npc = api.world.actors.find((a) => !a.isPlayer);
  if (npc && booth) api.occupySeat(npc, booth.id, 0);
  const ok = booth ? api.occupySeat(p, booth.id, 1) : false;
  const scr = (x, y) => ({ x: (x - y) * 32, y: (x + y) * 16 });
  return {
    ok,
    room: api.world.room?.id,
    player: booth && { x: p.x, y: p.y, action: p.action, slot: p.sitSlot, scr: scr(p.x, p.y) },
    npc: npc && booth ? { x: npc.x, y: npc.y, slot: npc.sitSlot, scr: scr(npc.x, npc.y) } : null,
    booth: booth && { x: booth.x, y: booth.y },
    lift: booth ? undefined : null,
  };
});
console.log("SIT_BOOTH", JSON.stringify(sitBooth));
await freeze();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/qa-sit-booth.png` });

const sitBean = await page.evaluate(() => {
  const api = window.__vego;
  api.enterRoom("tokyo");
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
      accessory: 1,
      body: 0,
      shoe: 0,
    },
    "V-Ego",
  );
  for (const a of api.world.actors) {
    a.nextAi = 9999;
    a.path = [];
    if (a.sitId) {
      a.action = "idle";
      a.sitId = undefined;
      a.sitSlot = undefined;
    }
  }
  const bean = api.world.furniture.find((f) => f.catalogId === "bean");
  const ok = bean ? api.occupySeat(p, bean.id, 0) : false;
  return {
    ok,
    room: api.world.room?.id,
    x: p.x,
    y: p.y,
    action: p.action,
    bean: bean && { x: bean.x, y: bean.y },
  };
});
console.log("SIT_BEAN", JSON.stringify(sitBean));
await freeze();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/qa-sit-bean.png` });

const block = await page.evaluate(() => {
  const api = window.__vego;
  api.enterRoom("red-room");
  const sofa = api.world.furniture.find((f) => f.catalogId === "sofa");
  if (!sofa) return { sofaBlocked: [], blockedCount: api.world.blocked.size };
  const keys = [...api.world.blocked].filter(
    (k) => k === `${sofa.x},${sofa.y}` || k === `${sofa.x + 1},${sofa.y}`,
  );
  return { sofaBlocked: keys, blockedCount: api.world.blocked.size };
});
console.log("BLOCK", JSON.stringify(block));

await browser.close();
console.log("done");
