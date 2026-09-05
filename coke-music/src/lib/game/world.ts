import { CATALOG_MAP, CHAT_LINES, NPC_NAMES, REPLIES, randomAppearance, ROOM_MAP } from "./data";
import { astar, nearestWalkable } from "./pathfind";
import type { Actor, Appearance, Particle, PlacedItem, RoomDef } from "./types";
import { isMixPlaying, sfxCoin, sfxFizz, sfxThumbs, startMix, stopMix } from "./audio";

export const TILE_W = 64;
export const TILE_H = 32;

export interface World {
  room: RoomDef;
  furniture: PlacedItem[];
  actors: Actor[];
  particles: Particle[];
  hover: { x: number; y: number } | null;
  camX: number;
  camY: number;
  time: number;
  performing: boolean;
  performUntil: number;
  drinkCd: number;
  pendingUse: { kind: "sit" | "drink" | "music" | "stage"; id: string; slot?: number } | null;
  selectedFurnId: string | null;
  blocked: Set<string>;
}

export const world: World = {
  room: ROOM_MAP["red-room"]!,
  furniture: [],
  actors: [],
  particles: [],
  hover: null,
  camX: 0,
  camY: 0,
  time: 0,
  performing: false,
  performUntil: 0,
  drinkCd: 0,
  pendingUse: null,
  selectedFurnId: null,
  blocked: new Set(),
};

let onDb: ((n: number, why: string) => void) | null = null;
let onChat: ((name: string, text: string, self?: boolean) => void) | null = null;
let onToast: ((t: string) => void) | null = null;
let hasBurnedDisc: (() => boolean) | null = null;
let doubleDb = false;
let playerAppearance: Appearance = randomAppearance();
let playerName = "Guest";

export function bindWorld(handlers: {
  onDb: (n: number, why: string) => void;
  onChat: (name: string, text: string, self?: boolean) => void;
  onToast: (t: string) => void;
  hasBurnedDisc: () => boolean;
}) {
  onDb = handlers.onDb;
  onChat = handlers.onChat;
  onToast = handlers.onToast;
  hasBurnedDisc = handlers.hasBurnedDisc;
}

export function setPlayerLook(a: Appearance, name: string) {
  playerAppearance = a;
  playerName = name;
  const p = player();
  if (p) {
    p.appearance = a;
    p.name = name;
  }
}

export function player(): Actor | undefined {
  return world.actors.find((a) => a.isPlayer);
}

export function seatCount(cat: { sit?: boolean; seats?: number } | undefined): number {
  if (!cat?.sit) return 0;
  return Math.max(1, cat.seats ?? 1);
}

export function seatWorldPos(f: PlacedItem, slot: number): { x: number; y: number } {
  const cat = CATALOG_MAP[f.catalogId];
  const n = Math.max(1, seatCount(cat));
  const { w, d } = cat ? effectiveFootprint(cat, f.rot ?? 0) : { w: 1, d: 1 };
  const q = footprintQuarter(cat, f.rot ?? 0);
  // Same origin the furniture sprite is drawn from, so seats line up with cushions.
  const cx = f.x + (w - 1) * 0.5;
  const cy = f.y + (d - 1) * 0.5;
  // depth: add to both axes → moves down-screen, sx unchanged (stays on the cushion).
  const depth = cat?.sitY ?? 0.12;
  const spreadAmt = cat?.sitSpread ?? (n <= 1 ? 0 : w * 0.5);
  const spread = n <= 1 ? 0 : ((slot - (n - 1) / 2) / Math.max(1, n - 1)) * spreadAmt;
  // When footprint is swapped (90° / 270°), seat spread follows the long axis.
  if (q % 2 === 1) {
    return {
      x: cx + depth - spread * 0.5,
      y: cy + depth + spread * 0.5,
    };
  }
  return {
    x: cx + depth + spread * 0.5,
    y: cy + depth - spread * 0.5,
  };
}

export function seatLiftPx(f: PlacedItem | undefined): number {
  if (!f) return 0;
  return CATALOG_MAP[f.catalogId]?.sitLift ?? 8;
}

export function rotSteps(cat: { rotate?: "90" | "360" } | undefined): number {
  return cat?.rotate === "360" ? 8 : 4;
}

/** Nearest 90° quarter-turn used for footprint / blocking. */
export function footprintQuarter(cat: { rotate?: "90" | "360" } | undefined, rot = 0): number {
  if (cat?.rotate === "360") return Math.round(rot / 2) % 4;
  return ((rot % 4) + 4) % 4;
}

export function effectiveFootprint(
  cat: { w: number; d: number; rotate?: "90" | "360" },
  rot = 0,
): { w: number; d: number } {
  const q = footprintQuarter(cat, rot);
  if (q % 2 === 1) return { w: cat.d, d: cat.w };
  return { w: cat.w, d: cat.d };
}

export function itemFootprint(f: PlacedItem): { w: number; d: number } {
  const cat = CATALOG_MAP[f.catalogId];
  if (!cat) return { w: 1, d: 1 };
  return effectiveFootprint(cat, f.rot ?? 0);
}

export function rotDegrees(cat: { rotate?: "90" | "360" } | undefined, rot = 0): number {
  if (!cat?.rotate && !rot) return 0;
  const steps = rotSteps(cat?.rotate ? cat : { rotate: "90" });
  return (((rot % steps) + steps) % steps) * (360 / steps);
}

function occupiedSlots(furnId: string, ignoreId?: string): Set<number> {
  const s = new Set<number>();
  for (const a of world.actors) {
    if (a.id === ignoreId) continue;
    if (a.action === "sit" && a.sitId === furnId && a.sitSlot != null) s.add(a.sitSlot);
  }
  return s;
}

function freeSlot(f: PlacedItem, prefer?: number, ignoreId?: string): number | null {
  const n = seatCount(CATALOG_MAP[f.catalogId]);
  const taken = occupiedSlots(f.id, ignoreId);
  if (prefer != null && prefer >= 0 && prefer < n && !taken.has(prefer)) return prefer;
  for (let i = 0; i < n; i++) if (!taken.has(i)) return i;
  return null;
}

function slotFromTile(f: PlacedItem, tx: number): number {
  const cat = CATALOG_MAP[f.catalogId];
  const n = seatCount(cat);
  if (n <= 1) return 0;
  const w = cat ? effectiveFootprint(cat, f.rot ?? 0).w : 1;
  return Math.min(n - 1, Math.max(0, Math.floor(((tx - f.x) / w) * n)));
}

function sitFacing(_f: PlacedItem): Actor["dir"] {
  // Face out from the seat toward the room (camera / +y).
  return 1;
}

export function occupySeat(actor: Actor, furnId: string, prefer?: number): boolean {
  const f = world.furniture.find((it) => it.id === furnId);
  if (!f) return false;
  const slot = freeSlot(f, prefer, actor.id);
  if (slot == null) {
    if (actor.isPlayer) onToast?.("No room — try another seat.");
    return false;
  }
  const pos = seatWorldPos(f, slot);
  const taken = occupiedSlots(f.id, actor.id);
  actor.x = pos.x;
  actor.y = pos.y;
  actor.action = "sit";
  actor.sitId = f.id;
  actor.sitSlot = slot;
  actor.dir = sitFacing(f);
  actor.path = [];
  actor.pendingSit = undefined;
  if (actor.isPlayer) {
    onToast?.(taken.size > 0 ? "Scooted in next to them." : "Have a seat.");
  }
  return true;
}

function k(x: number, y: number) {
  return `${x},${y}`;
}

function rebuildBlocked() {
  const set = new Set<string>();
  for (const f of world.furniture) {
    const cat = CATALOG_MAP[f.catalogId];
    if (!cat || cat.floor || cat.hang || cat.block === false) continue;
    const { w, d } = effectiveFootprint(cat, f.rot ?? 0);
    for (let x = f.x; x < f.x + w; x++) {
      for (let y = f.y; y < f.y + d; y++) set.add(k(x, y));
    }
  }
  world.blocked = set;
}

export function walkable(x: number, y: number) {
  const { w, h } = world.room;
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  return !world.blocked.has(k(x, y));
}

/** Standing/walking actors block their floor tile; sitters use furniture blocked set. */
function tileTakenByActor(tx: number, ty: number, exceptId?: string): boolean {
  for (const a of world.actors) {
    if (exceptId && a.id === exceptId) continue;
    if (a.action === "sit") continue;
    if (Math.floor(a.x) === tx && Math.floor(a.y) === ty) return true;
  }
  return false;
}

function walkableFor(actorId: string) {
  return (x: number, y: number) => walkable(x, y) && !tileTakenByActor(x, y, actorId);
}

function shuffleDirs(): { x: number; y: number }[] {
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  for (let i = dirs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = dirs[i]!;
    dirs[i] = dirs[j]!;
    dirs[j] = tmp;
  }
  return dirs;
}

function deflectActor(a: Actor) {
  a.path = [];
  const cx = Math.floor(a.x);
  const cy = Math.floor(a.y);
  const can = walkableFor(a.id);
  for (const d of shuffleDirs()) {
    const nx = cx + d.x;
    const ny = cy + d.y;
    if (can(nx, ny)) {
      a.path = [{ x: nx, y: ny }];
      a.action = "walk";
      if (a.isPlayer) {
        world.pendingUse = null;
        onToast?.("Path busy — stepping aside.");
      } else {
        a.pendingSit = undefined;
      }
      return;
    }
  }
  a.action = "idle";
  if (a.isPlayer) {
    world.pendingUse = null;
    onToast?.("That way is blocked.");
  } else {
    a.pendingSit = undefined;
  }
}

function furnitureAt(x: number, y: number): PlacedItem | undefined {
  return world.furniture.find((f) => {
    const cat = CATALOG_MAP[f.catalogId];
    if (!cat) return false;
    const { w, d } = effectiveFootprint(cat, f.rot ?? 0);
    return x >= f.x && x < f.x + w && y >= f.y && y < f.y + d;
  });
}

function sitFurnitureNear(tx: number, ty: number): PlacedItem | undefined {
  // Prefer the tile itself, then tiles behind the click (sofa sprites overhang the front), then neighbors.
  const deltas: [number, number][] = [
    [0, 0],
    [0, -1],
    [1, -1],
    [-1, -1],
    [1, 0],
    [-1, 0],
    [0, 1],
    [1, 1],
    [-1, 1],
    [0, -2],
    [2, 0],
    [-2, 0],
    [2, -1],
    [-2, -1],
  ];
  for (const [dx, dy] of deltas) {
    const f = furnitureAt(tx + dx, ty + dy);
    if (f && seatCount(CATALOG_MAP[f.catalogId]) > 0) return f;
  }
  return undefined;
}

function standFromSeat(actor: Actor) {
  const f = actor.sitId ? world.furniture.find((it) => it.id === actor.sitId) : undefined;
  actor.sitId = undefined;
  actor.sitSlot = undefined;
  actor.pendingSit = undefined;
  if (actor.action === "sit") actor.action = "idle";
  const fp = f ? itemFootprint(f) : { w: 1, d: 1 };
  const gx = f ? f.x + Math.floor(fp.w / 2) : Math.floor(actor.x);
  const gy = f ? f.y + fp.d : Math.floor(actor.y) + 1;
  const n = nearestWalkable(gx, gy, walkable, world.room.w, world.room.h);
  if (n) {
    actor.x = n.x + 0.5;
    actor.y = n.y + 0.5;
  }
}

export function enterRoom(roomId: string, studioItems?: PlacedItem[]) {
  const def = ROOM_MAP[roomId];
  if (!def) return;
  stopMix();
  world.room = def;
  world.performing = false;
  world.pendingUse = null;
  world.selectedFurnId = null;
  world.particles = [];
  doubleDb = def.doubleDb;
  const base: PlacedItem[] = def.private
    ? (studioItems ?? def.furniture.map((f, i) => ({ id: `s${i}`, ...f })))
    : def.furniture.map((f, i) => ({ id: `${def.id}-${i}`, ...f }));
  world.furniture = base;
  rebuildBlocked();

  const spawn = nearestWalkable(Math.floor(def.w / 2), Math.floor(def.h * 0.7), walkable, def.w, def.h) ?? {
    x: 1,
    y: 1,
  };
  const p: Actor = {
    id: "player",
    name: playerName,
    isPlayer: true,
    appearance: playerAppearance,
    x: spawn.x + 0.5,
    y: spawn.y + 0.5,
    dir: 0,
    action: "idle",
    path: [],
    nextAi: 0,
    walkPhase: 0,
    actionT: 0,
  };
  const npcs: Actor[] = [];
  if (!def.private) {
    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const sp = def.spawns[i % def.spawns.length]!;
      const tile = nearestWalkable(sp.x + (i % 2), sp.y + (i % 3), walkable, def.w, def.h);
      if (!tile) continue;
      npcs.push({
        id: `npc-${i}`,
        name: NPC_NAMES[i % NPC_NAMES.length]!,
        isPlayer: false,
        appearance: randomAppearance(0.13 + i * 0.17),
        x: tile.x + 0.5,
        y: tile.y + 0.5,
        dir: (i % 4) as 0 | 1 | 2 | 3,
        action: Math.random() > 0.6 ? "dance" : "idle",
        path: [],
        nextAi: 1 + Math.random() * 3,
        walkPhase: 0,
        actionT: 0,
      });
    }
  }
  world.actors = [p, ...npcs];
  if (!def.private) {
    const seats = world.furniture.filter((f) => seatCount(CATALOG_MAP[f.catalogId]) > 0);
    let si = 0;
    for (const f of seats) {
      const npc = npcs[si];
      if (!npc) break;
      occupySeat(npc, f.id, 0);
      si += 1;
      if (si >= 2) break;
    }
  }
  const scr = tileToScreen(p.x, p.y);
  world.camX = scr.x;
  world.camY = scr.y;
}

export function tileToScreen(tx: number, ty: number) {
  return {
    x: (tx - ty) * (TILE_W / 2),
    y: (tx + ty) * (TILE_H / 2),
  };
}

export function screenToTile(sx: number, sy: number) {
  const tx = sx / TILE_W + sy / TILE_H;
  const ty = sy / TILE_H - sx / TILE_W;
  return { x: Math.floor(tx), y: Math.floor(ty) };
}

function dirFrom(dx: number, dy: number): Actor["dir"] {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 0 : 2;
  return dy > 0 ? 1 : 3;
}

function popText(x: number, y: number, text: string, color: string) {
  world.particles.push({
    x,
    y,
    vx: 0,
    vy: -28,
    life: 0.9,
    max: 0.9,
    color,
    text,
    size: 12,
  });
}

function spark(x: number, y: number, color: string) {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    world.particles.push({
      x,
      y,
      vx: Math.cos(a) * 40,
      vy: Math.sin(a) * 24 - 10,
      life: 0.45,
      max: 0.45,
      color,
      size: 3,
    });
  }
}

export function say(actor: Actor, text: string) {
  actor.bubble = { text, until: world.time + 3.2 };
  onChat?.(actor.name, text, actor.isPlayer);
}

export function playerSay(text: string) {
  const p = player();
  if (!p || !text.trim()) return;
  say(p, text.trim().slice(0, 80));
  const nearby = world.actors.find((a) => !a.isPlayer && Math.hypot(a.x - p.x, a.y - p.y) < 4);
  if (nearby && Math.random() > 0.4) {
    window.setTimeout(() => {
      if (world.actors.includes(nearby)) say(nearby, REPLIES[Math.floor(Math.random() * REPLIES.length)]!);
    }, 700);
  }
}

function walkTo(actor: Actor, tx: number, ty: number) {
  if (actor.action === "sit" || actor.sitId) standFromSeat(actor);
  const can = walkableFor(actor.id);
  let start = { x: Math.floor(actor.x), y: Math.floor(actor.y) };
  if (!can(start.x, start.y)) {
    const n = nearestWalkable(start.x, start.y, can, world.room.w, world.room.h);
    if (n) start = n;
  }
  const goal = nearestWalkable(tx, ty, can, world.room.w, world.room.h);
  if (!goal) return false;
  const path = astar(start, goal, can, world.room.w, world.room.h);
  if (!path) return false;
  actor.path = path;
  actor.sitId = undefined;
  actor.sitSlot = undefined;
  if (actor.action === "sit") actor.action = "walk";
  return true;
}

export function movePlayerBy(dx: number, dy: number): boolean {
  const p = player();
  if (!p) return false;
  world.pendingUse = null;
  world.selectedFurnId = null;
  return walkTo(p, Math.floor(p.x) + dx, Math.floor(p.y) + dy);
}

export function setHover(sx: number, sy: number) {
  const t = screenToTile(sx, sy);
  if (t.x >= 0 && t.y >= 0 && t.x < world.room.w && t.y < world.room.h) world.hover = t;
  else world.hover = null;
}

export function clickWorld(sx: number, sy: number, placing?: string | null) {
  const t = screenToTile(sx, sy);
  if (t.x < 0 || t.y < 0 || t.x >= world.room.w || t.y >= world.room.h) return { placed: false };
  const p = player();
  if (!p) return { placed: false };

  if (placing && world.room.private) {
    return { placed: false, tile: t };
  }

  const sitF = sitFurnitureNear(t.x, t.y);
  const furn = furnitureAt(t.x, t.y);
  const furnCat = furn ? CATALOG_MAP[furn.catalogId] : undefined;

  // Click furniture → select + walk adjacent. Use button performs the action.
  if (furn || sitF) {
    let target = furn ?? sitF!;
    if (furn && furnCat && !furnCat.sit && (furnCat.drink || furnCat.music || furnCat.stage)) {
      target = furn;
    } else if (sitF) {
      target = sitF;
    }
    world.selectedFurnId = target.id;
    world.pendingUse = null;
    const cat = CATALOG_MAP[target.catalogId];
    const can = walkableFor(p.id);
    let adj: { x: number; y: number } | null = null;
    if (cat?.sit) {
      const prefer = slotFromTile(target, t.x);
      const slot = freeSlot(target, prefer, p.id);
      const pos = slot != null ? seatWorldPos(target, slot) : { x: target.x + 0.5, y: target.y + 0.5 };
      adj =
        nearestWalkable(Math.floor(pos.x), Math.floor(pos.y) + 1, can, world.room.w, world.room.h) ??
        nearestWalkable(Math.floor(pos.x), Math.floor(pos.y), can, world.room.w, world.room.h);
    } else {
      adj = nearestWalkable(t.x, t.y, can, world.room.w, world.room.h);
    }
    if (adj) walkTo(p, adj.x, adj.y);
    return { placed: false };
  }

  world.selectedFurnId = null;
  world.pendingUse = null;
  walkTo(p, t.x, t.y);
  return { placed: false };
}

export function selectedFurniture(): PlacedItem | undefined {
  if (!world.selectedFurnId) return undefined;
  return world.furniture.find((f) => f.id === world.selectedFurnId);
}

/** Walk to selected furniture and perform sit/drink/music/stage on arrival. */
export function useSelectedFurniture(): boolean {
  const p = player();
  const f = selectedFurniture();
  if (!p || !f) return false;
  const cat = CATALOG_MAP[f.catalogId];
  if (!cat) return false;
  const can = walkableFor(p.id);

  if (cat.sit) {
    const slot = freeSlot(f, undefined, p.id);
    if (slot == null) {
      onToast?.("No room — both seats are taken.");
      return false;
    }
    world.pendingUse = { kind: "sit", id: f.id, slot };
    const pos = seatWorldPos(f, slot);
    const adj =
      nearestWalkable(Math.floor(pos.x), Math.floor(pos.y) + 1, can, world.room.w, world.room.h) ??
      nearestWalkable(Math.floor(pos.x), Math.floor(pos.y), can, world.room.w, world.room.h);
    if (adj && walkTo(p, adj.x, adj.y) && !p.path.length) doUse(p);
    return true;
  }
  if (cat.drink) {
    world.pendingUse = { kind: "drink", id: f.id };
    const adj = nearestWalkable(f.x, f.y, can, world.room.w, world.room.h);
    if (adj && walkTo(p, adj.x, adj.y) && !p.path.length) doUse(p);
    return true;
  }
  if (cat.music) {
    world.pendingUse = { kind: "music", id: f.id };
    const adj = nearestWalkable(f.x, f.y, can, world.room.w, world.room.h);
    if (adj && walkTo(p, adj.x, adj.y) && !p.path.length) doUse(p);
    return true;
  }
  if (cat.stage) {
    world.pendingUse = { kind: "stage", id: f.id };
    const adj = nearestWalkable(f.x, f.y, can, world.room.w, world.room.h);
    if (adj && walkTo(p, adj.x, adj.y) && !p.path.length) doUse(p);
    return true;
  }
  onToast?.("Nothing to use here.");
  return false;
}

export function placeAt(catalogId: string, x: number, y: number, rot?: number): boolean {
  const cat = CATALOG_MAP[catalogId];
  if (!cat || !world.room.private) return false;
  const r = rot ?? 0;
  const { w, d } = effectiveFootprint(cat, r);
  if (x < 0 || y < 0 || x + w > world.room.w || y + d > world.room.h) return false;
  for (let ix = x; ix < x + w; ix++) {
    for (let iy = y; iy < y + d; iy++) {
      if (!cat.floor && !walkable(ix, iy)) return false;
    }
  }
  const item: PlacedItem = { id: `p-${Date.now()}`, catalogId, x, y };
  if (r) {
    const steps = rotSteps(cat);
    item.rot = ((r % steps) + steps) % steps;
  }
  world.furniture.push(item);
  rebuildBlocked();
  return true;
}

export function pickupAt(x: number, y: number): string | null {
  if (!world.room.private) return null;
  const f = furnitureAt(x, y);
  if (!f) return null;
  for (const actor of world.actors) {
    if (actor.sitId === f.id) standFromSeat(actor);
    if (actor.pendingSit?.id === f.id) actor.pendingSit = undefined;
  }
  if (world.pendingUse?.id === f.id) world.pendingUse = null;
  if (world.selectedFurnId === f.id) world.selectedFurnId = null;
  world.furniture = world.furniture.filter((it) => it.id !== f.id);
  rebuildBlocked();
  return f.catalogId;
}

export function setPlayerAction(action: Actor["action"]) {
  const p = player();
  if (!p) return;
  if (action === "dance" && p.action === "dance") {
    p.action = "idle";
    return;
  }
  if (p.action === "sit" || p.sitId) standFromSeat(p);
  p.sitId = undefined;
  p.sitSlot = undefined;
  p.pendingSit = undefined;
  p.path = [];
  p.action = action;
  p.actionT = 0;
}

function doUse(p: Actor) {
  const use = world.pendingUse;
  if (!use) return;
  const f = world.furniture.find((it) => it.id === use.id);
  world.pendingUse = null;
  if (!f) return;
  if (use.kind === "sit") {
    occupySeat(p, f.id, use.slot);
  } else if (use.kind === "drink") {
    if (world.drinkCd > 0) {
      onToast?.("Let that one settle.");
      return;
    }
    p.action = "drink";
    p.actionT = 0;
    world.drinkCd = 8;
    const amt = doubleDb ? 10 : 5;
    onDb?.(amt, "cola");
    sfxFizz();
    sfxCoin();
    const s = tileToScreen(p.x, p.y);
    popText(s.x, s.y - 40, `+${amt} dB`, "#F4E8DC");
    spark(s.x, s.y - 20, "#E61A27");
  } else if (use.kind === "music") {
    if (isMixPlaying()) {
      stopMix();
      onToast?.("Jukebox off.");
    } else {
      startMix();
      onToast?.("Jukebox on.");
      world.actors.forEach((a) => {
        if (!a.isPlayer && Math.random() > 0.4) a.action = "dance";
      });
    }
  } else if (use.kind === "stage") {
    startPerformance();
  }
}

export function startPerformance(): boolean {
  const p = player();
  if (!p) return false;
  if (world.performing) {
    onToast?.("Your set is already playing.");
    return false;
  }
  const stage = world.furniture.find((f) => CATALOG_MAP[f.catalogId]?.stage);
  if (!stage) {
    onToast?.("This room does not have a stage.");
    return false;
  }
  if (!hasBurnedDisc?.()) {
    onToast?.("Publish a mix before performing.");
    return false;
  }
  const cat = CATALOG_MAP[stage.catalogId];
  const fp = cat ? effectiveFootprint(cat, stage.rot ?? 0) : { w: 1, d: 1 };
  const stageX = stage.x + fp.w / 2;
  const stageY = stage.y + fp.d / 2;
  if (Math.hypot(p.x - stageX, p.y - stageY) > 4.5) {
    onToast?.("Tap the stage and walk over before starting your set.");
    return false;
  }
  startMix();
  world.performing = true;
  world.performUntil = world.time + 28;
  p.action = "dance";
  p.path = [];
  onToast?.("You're on. The room is listening.");
  world.actors.forEach((a) => {
    if (a.isPlayer) return;
    a.action = "dance";
    const stage = world.furniture.find((f) => CATALOG_MAP[f.catalogId]?.stage);
    if (stage) walkTo(a, stage.x + 1, stage.y + 3);
  });
  return true;
}

export function studioFurniture(): PlacedItem[] {
  return world.room.private ? world.furniture : [];
}

export function tick(dt: number) {
  dt = Math.min(dt, 0.1);
  world.time += dt;
  world.drinkCd = Math.max(0, world.drinkCd - dt);

  if (world.performing && world.time > world.performUntil) {
    world.performing = false;
    stopMix();
    const amt = doubleDb ? 24 : 12;
    onDb?.(amt, "solo-set");
    sfxThumbs();
    onToast?.(`Set complete. +${amt} dB`);
  }

  for (const a of world.actors) {
    a.actionT += dt;
    // Never leave a standing/walking actor on a furniture tile (walk-under bug).
    if (a.action !== "sit" && !walkable(Math.floor(a.x), Math.floor(a.y))) {
      const n = nearestWalkable(Math.floor(a.x), Math.floor(a.y), walkable, world.room.w, world.room.h);
      if (n) {
        a.x = n.x + 0.5;
        a.y = n.y + 0.5;
        if (!a.path.length && a.action === "walk") a.action = "idle";
      }
    }
    if (a.path.length) {
      a.action = "walk";
      const t = a.path[0]!;
      if (!walkable(t.x, t.y) || tileTakenByActor(t.x, t.y, a.id)) {
        deflectActor(a);
        continue;
      }
      const gx = t.x + 0.5;
      const gy = t.y + 0.5;
      const dx = gx - a.x;
      const dy = gy - a.y;
      const dist = Math.hypot(dx, dy);
      const spd = 3.1;
      const step = spd * dt;
      if (dist <= Math.max(0.06, step)) {
        // Reserve destination: only land if still free.
        if (tileTakenByActor(t.x, t.y, a.id)) {
          deflectActor(a);
          continue;
        }
        a.x = gx;
        a.y = gy;
        a.path.shift();
        if (!a.path.length) {
          a.action = "idle";
          if (a.isPlayer) doUse(a);
          else if (a.pendingSit) {
            occupySeat(a, a.pendingSit.id, a.pendingSit.slot);
            a.pendingSit = undefined;
          }
        }
      } else {
        a.dir = dirFrom(dx, dy);
        a.x += (dx / dist) * step;
        a.y += (dy / dist) * step;
        a.walkPhase += dt * 8;
      }
    } else if (a.action === "drink" && a.actionT > 1.1) {
      a.action = "idle";
    } else if (a.action === "wave" && a.actionT > 1.4) {
      a.action = "idle";
    }

    if (!a.isPlayer) {
      a.nextAi -= dt;
      if (a.nextAi <= 0 && !a.path.length) {
        a.nextAi = 2.5 + Math.random() * 4;
        const roll = Math.random();
        if (world.performing || isMixPlaying()) {
          a.action = "dance";
          if (Math.random() > 0.7) {
            say(a, CHAT_LINES[Math.floor(Math.random() * 4)]!);
          }
        } else if (roll < 0.4) {
          const tx = Math.floor(Math.random() * world.room.w);
          const ty = Math.floor(Math.random() * world.room.h);
          walkTo(a, tx, ty);
        } else if (roll < 0.55) {
          a.action = "dance";
        } else if (roll < 0.72) {
          const buddy = player();
          let pick: { f: PlacedItem; slot: number } | null = null;
          if (buddy?.action === "sit" && buddy.sitId) {
            const bf = world.furniture.find((it) => it.id === buddy.sitId);
            if (bf) {
              const slot = freeSlot(bf);
              if (slot != null) pick = { f: bf, slot };
            }
          }
          if (!pick) {
            const seats = world.furniture.filter((f) => seatCount(CATALOG_MAP[f.catalogId]) > 0);
            const shuffled = seats.sort(() => Math.random() - 0.5);
            for (const f of shuffled) {
              const slot = freeSlot(f);
              if (slot != null) {
                pick = { f, slot };
                break;
              }
            }
          }
          if (pick) {
            const pos = seatWorldPos(pick.f, pick.slot);
            const adj = nearestWalkable(Math.floor(pos.x), Math.floor(pos.y), walkable, world.room.w, world.room.h);
            if (adj) {
              walkTo(a, adj.x, adj.y);
              a.pendingSit = { id: pick.f.id, slot: pick.slot };
            }
          }
        } else if (roll < 0.85) {
          say(a, CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)]!);
        } else {
          a.action = "idle";
        }
      }
    }
  }

  for (let i = world.particles.length - 1; i >= 0; i--) {
    const pt = world.particles[i]!;
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.life <= 0) world.particles.splice(i, 1);
  }

  const p = player();
  if (p) {
    const s = tileToScreen(p.x, p.y);
    const k = 3.2;
    const a = 1 - Math.exp(-k * dt);
    world.camX += (s.x - world.camX) * a;
    world.camY += (s.y - 20 - world.camY) * a;
  }
}
