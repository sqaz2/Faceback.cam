import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = `${dirname(dirname(fileURLToPath(import.meta.url)))}/`;
const base = pathToFileURL(root).href;
const audioStub = `let playing=false;
export const isMixPlaying=()=>playing; export const startMix=()=>{playing=true};
export const stopMix=()=>{playing=false}; export const startLounge=()=>{};
export const unlockAudio=()=>{}; export const sfxCoin=()=>{};
export const sfxFizz=()=>{}; export const sfxThumbs=()=>{};`;
const zustandStub = `export function create(init) { let state;
const get=()=>state; const set=patch=>{state={...state,...(typeof patch==='function'?patch(state):patch)}};
state=init(set,get); const use=selector=>selector(state); use.getState=get; use.setState=set; return use; }`;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "zustand") return { url: "test:zustand", shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith(base)) {
      const url = new URL(specifier, context.parentURL);
      if (!url.pathname.endsWith(".ts") && existsSync(`${fileURLToPath(url)}.ts`)) {
        return { url: `${url.href}.ts`, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === "test:zustand") return { format: "module", source: zustandStub, shortCircuit: true };
    if (url === `${base}src/lib/game/audio.ts`) {
      return { format: "module", source: audioStub, shortCircuit: true };
    }
    if (url.startsWith(base) && url.endsWith(".ts")) {
      return {
        format: "module",
        source: stripTypeScriptTypes(readFileSync(new URL(url), "utf8"), { mode: "strip" }),
        shortCircuit: true,
      };
    }
    return next(url, context);
  },
});

const saved = new Map([["coke-music-v1", JSON.stringify({ version: 1 })]]);
globalThis.localStorage = {
  getItem: (key) => saved.get(key) ?? null,
  setItem: (key, value) => saved.set(key, value),
  removeItem: (key) => saved.delete(key),
};
globalThis.window = { setTimeout: () => 1 };

const worldModule = await import(`${base}src/lib/game/world.ts`);
const { useGame } = await import(`${base}src/lib/game/store.ts`);

function studio(items = []) {
  worldModule.enterRoom("studio", structuredClone(items));
  return worldModule.player();
}

test("malformed saves are rejected instead of hydrating partial state", () => {
  useGame.getState().hydrate();
  assert.equal(useGame.getState().hasSave, false);
  assert.ok(useGame.getState().appearance);
  assert.ok(useGame.getState().inventory);
});

test("a valid backup recovers a damaged primary save", () => {
  const valid = useGame.getState().exportSave();
  saved.set("coke-music-v1", "{damaged");
  saved.set("coke-music-v1-backup", valid);
  useGame.getState().hydrate();
  assert.equal(useGame.getState().hasSave, true);
  assert.deepEqual(JSON.parse(saved.get("coke-music-v1")), JSON.parse(valid));
});

test("storage denial is reported instead of pretending progress saved", () => {
  const setItem = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => { throw new Error("quota"); };
  assert.equal(useGame.getState().persist(), false);
  assert.equal(useGame.getState().toast, "Progress could not be saved on this device.");
  globalThis.localStorage.setItem = setItem;
});

test("one-tile movement arrives across low and high frame rates", () => {
  for (const fps of [60, 30, 20, 15, 10]) {
    const actor = studio();
    actor.x = 0.5;
    actor.y = 0.5;
    actor.path = [{ x: 1, y: 0 }];
    for (let frame = 0; frame < fps * 2; frame += 1) worldModule.tick(1 / fps);
    assert.equal(actor.path.length, 0, `${fps} fps path did not finish`);
    assert.equal(actor.x, 1.5);
    assert.equal(actor.y, 0.5);
  }
});

test("an adjacent chair interaction sits immediately", () => {
  const actor = studio([{ id: "chair", catalogId: "chair", x: 2, y: 2 }]);
  actor.x = 2.5;
  actor.y = 3.5;
  const click = worldModule.tileToScreen(2.5, 2.5);
  worldModule.clickWorld(click.x, click.y);
  assert.equal(actor.action, "sit");
  assert.equal(actor.sitId, "chair");
  assert.equal(worldModule.world.pendingUse, null);
});

test("placing an obstacle cancels a path before entering the blocked tile", () => {
  const actor = studio();
  actor.x = 0.5;
  actor.y = 0.5;
  actor.path = [{ x: 1, y: 0 }, { x: 2, y: 0 }];
  assert.equal(worldModule.placeAt("chair", 1, 0), true);
  worldModule.tick(1 / 60);
  assert.equal(actor.path.length, 0);
  assert.equal(Math.floor(actor.x), 0);
});

test("picking up an occupied chair also stands its occupant", () => {
  const actor = studio([{ id: "chair", catalogId: "chair", x: 2, y: 2 }]);
  assert.equal(worldModule.occupySeat(actor, "chair"), true);
  assert.equal(worldModule.pickupAt(2, 2), "chair");
  assert.equal(actor.action, "idle");
  assert.equal(actor.sitId, undefined);
});

test("owned furniture placement cannot duplicate the last inventory item", () => {
  studio();
  useGame.setState({ inventory: { chair: 1 }, studio: [], placing: "chair" });
  assert.equal(useGame.getState().placeOwnedItem("chair", 1, 1), true);
  assert.equal(useGame.getState().placeOwnedItem("chair", 3, 1), false);
  assert.equal(useGame.getState().inventory.chair, 0);
  assert.equal(worldModule.world.furniture.filter((item) => item.catalogId === "chair").length, 1);
  assert.equal(useGame.getState().placing, null);
});

test("performance requires a disc and stage, then awards only once", () => {
  const actor = studio([{ id: "stage", catalogId: "stage", x: 3, y: 3 }]);
  actor.x = 4;
  actor.y = 4;
  useGame.setState({ discs: [] });
  assert.equal(worldModule.startPerformance(), false);
  useGame.setState({
    discs: [{ id: "disc", name: "Test", genre: "pop", clips: ["four", null, null, null], createdAt: 1 }],
    db: 0,
  });
  assert.equal(worldModule.startPerformance(), true);
  for (let i = 0; i < 600; i += 1) worldModule.tick(0.1);
  assert.equal(useGame.getState().db, 12);
});
