import {
  ACCESSORIES,
  AVATAR_URLS,
  BOTTOM_STYLES,
  CATALOG_MAP,
  CLOTH_COLORS,
  HAIR_COLORS,
  SHOE_STYLES,
  SKINS,
  TOP_STYLES,
} from "./data";
import type { Actor, Appearance, PlacedItem, RoomDef, Dir } from "./types";
import { TILE_H, TILE_W, effectiveFootprint, itemFootprint, rotDegrees, seatLiftPx, tileToScreen, world } from "./world";

export type SpriteMap = Record<string, HTMLImageElement>;

function hexRgb(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
function clamp255(n: number) {
  return Math.max(0, Math.min(255, n | 0));
}

type AvatarSheets = {
  idle: HTMLImageElement;
  walk: HTMLImageElement;
  sit: HTMLImageElement;
  dance: HTMLImageElement;
};

const avatarSheets = new Map<number, AvatarSheets>();

function ensureAvatarSheets(body = 0) {
  const bodyIndex = body === 1 ? 1 : 0;
  const cached = avatarSheets.get(bodyIndex);
  if (cached) return cached;
  const s = {} as AvatarSheets;
  const urls = AVATAR_URLS[bodyIndex === 1 ? "woman" : "man"]!;
  for (const [k, url] of Object.entries(urls)) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.addEventListener("load", () => frameCache.clear());
    img.src = url;
    (s as unknown as Record<string, HTMLImageElement>)[k] = img;
  }
  avatarSheets.set(bodyIndex, s);
  return s;
}

type WardrobeSheets = {
  top: AvatarSheets[];
  bottom: AvatarSheets[];
  shoes: AvatarSheets[];
  hair: AvatarSheets[];
  accessories: AvatarSheets[];
};

const wardrobeSheets = new Map<number, WardrobeSheets>();

function assetSlug(label: string) {
  return label.toLowerCase().replaceAll("-", "").replaceAll(" ", "");
}

function loadActionSheets(category: "top" | "bottom" | "shoes" | "hair" | "accessory", body: string, style: string): AvatarSheets {
  const set = {} as AvatarSheets;
  for (const action of ["idle", "walk", "sit", "dance"] as const) {
    const img = new Image();
    img.decoding = "async";
    img.addEventListener("load", () => frameCache.clear());
    img.src = `/art/avatar/generated/${category}/${body}/${assetSlug(style)}/${action}.png?v=9`;
    set[action] = img;
  }
  return set;
}

function ensureWardrobeSheets(body = 0) {
  const bodyIndex = body === 1 ? 1 : 0;
  const cached = wardrobeSheets.get(bodyIndex);
  if (cached) return cached;
  const bodyName = bodyIndex === 1 ? "woman" : "man";
  const set: WardrobeSheets = {
    top: TOP_STYLES.map((style) => loadActionSheets("top", bodyName, style)),
    bottom: BOTTOM_STYLES.map((style) => loadActionSheets("bottom", bodyName, style)),
    shoes: SHOE_STYLES.map((style) => loadActionSheets("shoes", bodyName, style)),
    hair: ["Crop", "Spikes", "Flow", "Halo", "Tail", "Bangs"].map((style) =>
      loadActionSheets("hair", bodyName, style),
    ),
    accessories: ACCESSORIES.slice(1).map((style) => loadActionSheets("accessory", bodyName, style)),
  };
  wardrobeSheets.set(bodyIndex, set);
  return set;
}

const frameCache = new Map<string, HTMLCanvasElement>();

function extractFixedCell(src: HTMLImageElement, dir: number, size = 96): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  // Sheet columns are [away/-x, +y, +x, away/-y]; world dir 0=+x and 2=-x are swapped vs art.
  const col = dir === 0 ? 2 : dir === 2 ? 0 : dir;
  const sw = src.naturalWidth / 4;
  out.getContext("2d")!.drawImage(src, Math.max(0, Math.min(3, col)) * sw, 0, sw, src.naturalHeight, 0, 0, size, size);
  return out;
}

function actionSheet(set: AvatarSheets, action: Actor["action"]) {
  return action === "sit" ? set.sit : action === "walk" ? set.walk : action === "dance" || action === "wave" ? set.dance : set.idle;
}

function remapCanvas(c: HTMLCanvasElement, a: Appearance): HTMLCanvasElement {
  const x = c.getContext("2d")!;
  let img: ImageData;
  try {
    img = x.getImageData(0, 0, c.width, c.height);
  } catch {
    return c;
  }
  const d = img.data;
  const skin = hexRgb(SKINS[a.skin] ?? SKINS[0]!);

  const paint = (target: [number, number, number], lum: number): [number, number, number] => {
    const t = Math.max(0, Math.min(1, lum / 255));
    const k = 0.34 + t * 0.72;
    return [clamp255(target[0] * k), clamp255(target[1] * k), clamp255(target[2] * k)];
  };

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!,
      g = d[i + 1]!,
      b = d[i + 2]!,
      al = d[i + 3]!;
    if (al < 12) continue;
    const lum = (r + g + b) / 3;
    // The generated underlayer reserves warm peach pixels for exposed skin.
    // Recolor only those pixels, preserving its rendered anatomy and shading.
    const isGeneratedSkin = r > 82 && g > 42 && b > 24 && r > g * 1.04 && g > b * 1.04 && r - b > 22 && lum > 56;
    if (!isGeneratedSkin) continue;
    const p = paint(skin, lum);
    d[i] = p[0];
    d[i + 1] = p[1];
    d[i + 2] = p[2];
  }
  x.putImageData(img, 0, 0);
  return c;
}

function outlineCanvas(c: HTMLCanvasElement) {
  const x = c.getContext("2d")!;
  let img: ImageData;
  try {
    img = x.getImageData(0, 0, c.width, c.height);
  } catch {
    return;
  }
  const d = img.data;
  const copy = new Uint8ClampedArray(d);
  const w = c.width;
  const h = c.height;
  for (let y = 1; y < h - 1; y++) {
    for (let x0 = 1; x0 < w - 1; x0++) {
      const i = (y * w + x0) * 4;
      if (copy[i + 3]! < 20) continue;
      const edge =
        copy[((y - 1) * w + x0) * 4 + 3]! < 20 ||
        copy[((y + 1) * w + x0) * 4 + 3]! < 20 ||
        copy[(y * w + x0 - 1) * 4 + 3]! < 20 ||
        copy[(y * w + x0 + 1) * 4 + 3]! < 20;
      if (!edge) continue;
      d[i] = clamp255(d[i]! * 0.28);
      d[i + 1] = clamp255(d[i + 1]! * 0.28);
      d[i + 2] = clamp255(d[i + 2]! * 0.28);
    }
  }
  x.putImageData(img, 0, 0);
}

function tintToColor(c: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const x = c.getContext("2d")!;
  let img: ImageData;
  try {
    img = x.getImageData(0, 0, c.width, c.height);
  } catch {
    return c;
  }
  const d = img.data;
  const target = hexRgb(color);
  const pale = (target[0] + target[1] + target[2]) / 3 > 200;
  for (let i = 0; i < d.length; i += 4) {
    const al = d[i + 3]!;
    if (al < 12) continue;
    const r = d[i]!,
      g = d[i + 1]!,
      b = d[i + 2]!;
    const lum = (r + g + b) / 3;
    if (lum < 40) continue;
    const t = Math.max(0, Math.min(1, lum / 255));
    const k = pale ? 0.34 + t * 0.5 : 0.38 + t * 0.7;
    d[i] = clamp255(target[0] * k);
    d[i + 1] = clamp255(target[1] * k);
    d[i + 2] = clamp255(target[2] * k);
  }
  x.putImageData(img, 0, 0);
  return c;
}

function composeAvatar(
  a: Appearance,
  dir: number,
  action: Actor["action"],
): HTMLCanvasElement | null {
  const sh = ensureAvatarSheets(a.body ?? 0);
  const wardrobe = ensureWardrobeSheets(a.body ?? 0);
  const bodyImg = actionSheet(sh, action);
  const topImg = actionSheet(wardrobe.top[a.top] ?? wardrobe.top[0]!, action);
  const bottomImg = actionSheet(wardrobe.bottom[a.bottom] ?? wardrobe.bottom[0]!, action);
  const shoeImg = actionSheet(wardrobe.shoes[a.shoe ?? 0] ?? wardrobe.shoes[0]!, action);
  const hairImg = actionSheet(wardrobe.hair[a.hair] ?? wardrobe.hair[0]!, action);
  const accessorySet = a.accessory > 0 ? wardrobe.accessories[a.accessory - 1] : undefined;
  const accessoryImg = accessorySet ? actionSheet(accessorySet, action) : undefined;
  if (!bodyImg.complete || bodyImg.naturalWidth < 8) return null;
  const key = `dmap-${a.body ?? 0}-${a.skin}-${a.hair}-${a.hairColor}-${a.top}-${a.topColor}-${a.bottom}-${a.bottomColor}-${a.shoe ?? 0}-${a.shoeColor}-${a.accessory}-${action}-${dir}`;
  const wardrobeReady = [topImg, bottomImg, shoeImg, hairImg, accessoryImg]
    .filter((img): img is HTMLImageElement => !!img)
    .every((img) => img.complete && img.naturalWidth > 8);
  const hit = frameCache.get(key);
  if (hit && wardrobeReady) return hit;
  if (!wardrobeReady) return null;

  let body: HTMLCanvasElement;
  try {
    body = extractFixedCell(bodyImg, dir);
    remapCanvas(body, a);
    outlineCanvas(body);
  } catch {
    return null;
  }

  const out = document.createElement("canvas");
  out.width = body.width;
  out.height = body.height;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(body, 0, 0);
  const bottom = tintToColor(extractFixedCell(bottomImg, dir), CLOTH_COLORS[a.bottomColor] ?? CLOTH_COLORS[2]!);
  const top = tintToColor(extractFixedCell(topImg, dir), CLOTH_COLORS[a.topColor] ?? CLOTH_COLORS[0]!);
  const shoes = tintToColor(extractFixedCell(shoeImg, dir), CLOTH_COLORS[a.shoeColor] ?? CLOTH_COLORS[2]!);
  const hair = tintToColor(extractFixedCell(hairImg, dir), HAIR_COLORS[a.hairColor] ?? HAIR_COLORS[0]!);
  ctx.drawImage(bottom, 0, 0);
  ctx.drawImage(top, 0, 0);
  ctx.drawImage(shoes, 0, 0);
  ctx.drawImage(hair, 0, 0);
  if (accessoryImg) ctx.drawImage(extractFixedCell(accessoryImg, dir), 0, 0);

  if (frameCache.size > 280) frameCache.clear();
  if (wardrobeReady) frameCache.set(key, out);
  return out;
}

export function drawCube(
  ctx: CanvasRenderingContext2D,
  topX: number,
  topY: number,
  pW: number,
  pD: number,
  pH: number,
  top: string,
  left: string,
  right: string,
) {
  const hx = pW / 2;
  const hy = pD / 2;
  const N = { x: topX, y: topY };
  const E = { x: topX + hx, y: topY + hy / 2 };
  const S = { x: topX, y: topY + hy };
  const W = { x: topX - hx, y: topY + hy / 2 };
  const drop = pH;
  ctx.beginPath();
  ctx.moveTo(N.x, N.y);
  ctx.lineTo(E.x, E.y);
  ctx.lineTo(S.x, S.y);
  ctx.lineTo(W.x, W.y);
  ctx.closePath();
  ctx.fillStyle = top;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W.x, W.y);
  ctx.lineTo(S.x, S.y);
  ctx.lineTo(S.x, S.y + drop);
  ctx.lineTo(W.x, W.y + drop);
  ctx.closePath();
  ctx.fillStyle = left;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(E.x, E.y);
  ctx.lineTo(S.x, S.y);
  ctx.lineTo(S.x, S.y + drop);
  ctx.lineTo(E.x, E.y + drop);
  ctx.closePath();
  ctx.fillStyle = right;
  ctx.fill();
}

function floorColors(kind: RoomDef["floor"], x: number, y: number): [string, string] {
  const alt = (x + y) % 2 === 0;
  switch (kind) {
    case "carpet":
      return alt ? ["#8a1420", "#6e0a12"] : ["#7a101c", "#5c0810"];
    case "wood":
      return alt ? ["#8a5a38", "#6e4428"] : ["#7a4e30", "#5e3a22"];
    case "tatami":
      return alt ? ["#c4b089", "#a8946e"] : ["#b9a57c", "#9a8760"];
    case "tile":
      return alt ? ["#d8c8b8", "#c4b4a4"] : ["#cfc0b0", "#b8a898"];
    case "sand":
      return alt ? ["#d2b48c", "#c4a574"] : ["#cbb284", "#b89668"];
    case "loft":
      return alt ? ["#9a8a7c", "#7e6e62"] : ["#8e7e72", "#6e6056"];
  }
}

function wallColors(kind: RoomDef["wall"]): { left: string; right: string; trim: string } {
  switch (kind) {
    case "red":
      return { left: "#b0101c", right: "#8a0c16", trim: "#f4e8dc" };
    case "cream":
      return { left: "#e6d5c5", right: "#d4c2b0", trim: "#e61a27" };
    case "lacquer":
      return { left: "#1a1012", right: "#120a0c", trim: "#e61a27" };
    case "brick":
      return { left: "#7a3a32", right: "#5e2c26", trim: "#c5b9b4" };
    case "stucco":
      return { left: "#e8c9a4", right: "#d4b48c", trim: "#e61a27" };
  }
}

function drawFloorTile(ctx: CanvasRenderingContext2D, x: number, y: number, room: RoomDef) {
  const s = tileToScreen(x, y);
  const [a, b] = floorColors(room.floor, x, y);
  const hx = TILE_W / 2;
  const hy = TILE_H / 2;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(s.x + hx, s.y + hy);
  ctx.lineTo(s.x, s.y + TILE_H);
  ctx.lineTo(s.x - hx, s.y + hy);
  ctx.closePath();
  ctx.fillStyle = a;
  ctx.fill();
  ctx.strokeStyle = b;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawWalls(ctx: CanvasRenderingContext2D, room: RoomDef) {
  const { left, right, trim } = wallColors(room.wall);
  const H = 86;
  for (let x = 0; x < room.w; x++) {
    const s = tileToScreen(x, 0);
    const hx = TILE_W / 2;
    const hy = TILE_H / 2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - H);
    ctx.lineTo(s.x + hx, s.y + hy - H);
    ctx.lineTo(s.x + hx, s.y + hy);
    ctx.lineTo(s.x, s.y);
    ctx.closePath();
    ctx.fillStyle = right;
    ctx.fill();
    ctx.fillStyle = trim;
    ctx.fillRect(s.x + 4, s.y - 18, 10, 6);
  }
  for (let y = 0; y < room.h; y++) {
    const s = tileToScreen(0, y);
    const hx = TILE_W / 2;
    const hy = TILE_H / 2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - H);
    ctx.lineTo(s.x - hx, s.y + hy - H);
    ctx.lineTo(s.x - hx, s.y + hy);
    ctx.lineTo(s.x, s.y);
    ctx.closePath();
    ctx.fillStyle = left;
    ctx.fill();
  }
}

function drawProcFurniture(ctx: CanvasRenderingContext2D, item: PlacedItem) {
  const cat = CATALOG_MAP[item.catalogId];
  if (!cat) return;
  const fp = effectiveFootprint(cat, item.rot ?? 0);
  const s = tileToScreen(item.x + (fp.w - 1) * 0.5, item.y + (fp.d - 1) * 0.5);
  const w = cat.w * TILE_W * 0.72;
  const d = cat.d * TILE_W * 0.72;
  const deg = rotDegrees(cat, item.rot ?? 0);
  if (deg) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.translate(-s.x, -s.y);
  }
  if (cat.floor) {
    const hx = (cat.w * TILE_W) / 2;
    const hy = (cat.d * TILE_H) / 2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + hx, s.y + hy);
    ctx.lineTo(s.x, s.y + hy * 2);
    ctx.lineTo(s.x - hx, s.y + hy);
    ctx.closePath();
    ctx.fillStyle = "rgba(110,10,18,0.55)";
    ctx.fill();
    if (deg) ctx.restore();
    return;
  }
  if (item.catalogId === "vending") {
    drawCube(ctx, s.x, s.y - 40, 28, 22, 52, "#e61a27", "#b0101c", "#8a0c16");
    ctx.fillStyle = "#1a1012";
    ctx.fillRect(s.x - 8, s.y - 28, 16, 22);
  } else if (item.catalogId === "jukebox") {
    drawCube(ctx, s.x, s.y - 32, 26, 20, 40, "#e61a27", "#8a0c16", "#6e0a12");
  } else if (item.catalogId === "chair") {
    drawCube(ctx, s.x, s.y - 6, 24, 22, 12, "#e61a27", "#b0101c", "#8a0c16");
    drawCube(ctx, s.x - 8, s.y - 20, 12, 22, 16, "#c4121e", "#8a0c16", "#6e0a12");
  } else if (item.catalogId === "plant") {
    drawCube(ctx, s.x, s.y + 4, 16, 14, 10, "#e61a27", "#b0101c", "#8a0c16");
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 18, 16, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#1f6b4a";
    ctx.fill();
  } else if (item.catalogId === "speaker") {
    drawCube(ctx, s.x, s.y - 22, 22, 18, 32, "#1a1012", "#14080a", "#0e0608");
  } else if (item.catalogId === "sofa") {
    drawCube(ctx, s.x, s.y - 4, w * 0.92, d * 0.8, 14, "#e61a27", "#b0101c", "#8a0c16");
    drawCube(ctx, s.x - w * 0.32, s.y - 18, 16, d * 0.8, 18, "#c4121e", "#8a0c16", "#6e0a12");
    drawCube(ctx, s.x + w * 0.32, s.y - 18, 16, d * 0.8, 18, "#c4121e", "#8a0c16", "#6e0a12");
  } else if (item.catalogId === "crate") {
    drawCube(ctx, s.x, s.y - 6, 30, 24, 16, "#8a5a38", "#6e4428", "#5a3620");
  } else if (item.catalogId === "disco") {
    ctx.beginPath();
    ctx.arc(s.x, s.y - 10, 11, 0, Math.PI * 2);
    ctx.fillStyle = "#d8d0cc";
    ctx.fill();
  } else if (item.catalogId === "table") {
    drawCube(ctx, s.x, s.y - 18, w * 0.7, d * 0.7, 6, "#f4e8dc", "#d4c2b0", "#c4b09c");
    drawCube(ctx, s.x, s.y + 2, 8, 8, 16, "#6e4428", "#5a3620", "#4a2c18");
  } else if (item.catalogId === "lamp") {
    drawCube(ctx, s.x, s.y + 8, 10, 10, 28, "#c5b9b4", "#9a8e88", "#7a706c");
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 18, 16, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#f4e8dc";
    ctx.fill();
  } else if (item.catalogId === "bean") {
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 6, 22, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#e61a27";
    ctx.fill();
  } else if (item.catalogId === "fridge") {
    drawCube(ctx, s.x, s.y - 36, 28, 24, 44, "#f4e8dc", "#d0c0b4", "#c0b0a4");
  } else if (item.catalogId === "tv") {
    drawCube(ctx, s.x, s.y - 22, 36, 16, 26, "#1a1012", "#120a0c", "#0c0608");
    ctx.fillStyle = "#2a5a8a";
    ctx.fillRect(s.x - 12, s.y - 14, 24, 14);
  } else if (item.catalogId === "stool") {
    drawCube(ctx, s.x, s.y - 16, 20, 20, 5, "#e61a27", "#b0101c", "#8a0c16");
  } else if (item.catalogId === "booth") {
    drawCube(ctx, s.x, s.y - 8, w, d * 0.8, 12, "#6e0a12", "#4a0810", "#3a060c");
    drawCube(ctx, s.x - 10, s.y - 22, 16, d * 0.8, 18, "#e61a27", "#b0101c", "#8a0c16");
  } else if (item.catalogId === "stage") {
    drawCube(ctx, s.x, s.y - 8, w, d, 14, "#2a1619", "#1a1012", "#14080a");
    ctx.strokeStyle = "#e61a27";
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - 20, s.y - 4, 40, 8);
  } else if (item.catalogId === "mic") {
    ctx.strokeStyle = "#c5b9b4";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y + 16);
    ctx.lineTo(s.x, s.y - 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 24, 7, 10, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1012";
    ctx.fill();
  } else {
    drawCube(ctx, s.x, s.y - 16, w * 0.8, d * 0.8, 18, "#e61a27", "#b0101c", "#8a0c16");
  }
  if (deg) ctx.restore();
}

const SPRITE_H: Record<string, number> = {
  vending: 102,
  jukebox: 98,
  fridge: 94,
  lamp: 96,
  speaker: 84,
  plant: 86,
  mic: 82,
  disco: 90,
  sofa: 64,
  booth: 72,
  chair: 62,
  stool: 48,
  table: 48,
  bean: 42,
  crate: 44,
  stage: 48,
  tv: 66,
};

function drawSpriteItem(ctx: CanvasRenderingContext2D, item: PlacedItem, img: HTMLImageElement) {
  const cat = CATALOG_MAP[item.catalogId]!;
  const { w, d } = effectiveFootprint(cat, item.rot ?? 0);
  const s = tileToScreen(item.x + (w - 1) * 0.5, item.y + (d - 1) * 0.5);
  const footY = s.y + TILE_H * 0.5;
  const destH = SPRITE_H[cat.sprite ?? item.catalogId] ?? 56;
  const aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
  // Size from unrotated catalog dims so the sprite doesn't stretch when footprint swaps.
  const tileSpan = TILE_W * (0.55 * cat.w + 0.45 * cat.d);
  let destW = destH * aspect;
  if (cat.w >= 2) destW = Math.min(Math.max(destW, tileSpan * 0.92), tileSpan * 1.08);
  else if (aspect < 0.55) {
    // Tall thin props (lamp, mic, plant): keep natural aspect -- forced min-width bends them.
    destW = Math.min(destW, tileSpan * 1.15);
  } else {
    destW = Math.min(Math.max(destW, tileSpan * 0.7), tileSpan * 1.15);
  }
  // Hang items (disco ball) above the floor anchor so the chain is not a stub on the carpet.
  const hangLift = cat.hang ? Math.round(destH * 0.7) : 0;
  const deg = rotDegrees(cat, item.rot ?? 0);
  if (deg) {
    const cx = s.x;
    const cy = footY - hangLift - destH / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(img, -destW / 2, -destH / 2, destW, destH);
    ctx.restore();
  } else {
    ctx.drawImage(img, s.x - destW / 2, footY - destH - hangLift, destW, destH);
  }
}

export function drawAppearance(
  ctx: CanvasRenderingContext2D,
  a: Appearance,
  ox: number,
  oy: number,
  dir: number,
  action: Actor["action"],
  phase: number,
  t: number,
  sitLift = 0,
) {
  try {
    const frame = composeAvatar(a, dir, action);
    if (frame) {
      const bob = action === "dance" ? Math.abs(Math.sin(t * 10)) * 3 : action === "walk" ? Math.abs(Math.sin(phase)) * 2.5 : 0;
      const sway = action === "walk" ? Math.sin(phase) * 0.035 : action === "dance" ? Math.sin(t * 8) * 0.07 : Math.sin(t * 1.8) * 0.012;
      const breathe = action === "idle" ? 1 + Math.sin(t * 2.2) * 0.012 : 1;
      const sitting = action === "sit";
      const h = sitting ? 70 : 78;
      const w = (frame.width / frame.height) * h;
      const foot = sitting ? 6 : 10;
      ctx.save();
      ctx.translate(ox, oy + foot - sitLift - bob);
      ctx.rotate(sway);
      ctx.scale(1, breathe);
      ctx.drawImage(frame, -w / 2, -h, w, h);
      ctx.restore();
      return;
    }
  } catch {
    /* generated assets remain hidden until the selected sheets are ready */
  }
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.font = "600 12px Outfit, sans-serif";
  const pad = 8;
  const w = Math.min(180, ctx.measureText(text).width + pad * 2);
  const h = 22;
  ctx.fillStyle = "rgba(255,248,242,0.95)";
  roundRect(ctx, x - w / 2, y - h - 8, w, h, 8);
  ctx.fill();
  ctx.fillStyle = "#14080a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y - h / 2 - 8, w - 10);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawName(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, self: boolean) {
  ctx.font = "600 11px Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = self ? "#e61a27" : "rgba(244,232,220,0.85)";
  ctx.fillText(name, x, y + 20);
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sprites: SpriteMap,
  placing?: string | null,
  reducedMotion = false,
) {
  ensureAvatarSheets();
  ctx.clearRect(0, 0, width, height);
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, "#2a1216");
  g.addColorStop(1, "#14080a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2 - world.camX, height / 2 - world.camY - 20);

  const room = world.room;
  drawWalls(ctx, room);
  for (let y = 0; y < room.h; y++) {
    for (let x = 0; x < room.w; x++) drawFloorTile(ctx, x, y, room);
  }

  if (world.hover) {
    const s = tileToScreen(world.hover.x, world.hover.y);
    const hx = TILE_W / 2;
    const hy = TILE_H / 2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + hx, s.y + hy);
    ctx.lineTo(s.x, s.y + TILE_H);
    ctx.lineTo(s.x - hx, s.y + hy);
    ctx.closePath();
    ctx.fillStyle = placing ? "rgba(230,26,39,0.35)" : "rgba(255,248,242,0.18)";
    ctx.fill();
  }

  type DrawItem =
    | { sort: number; kind: "furn"; item: PlacedItem }
    | { sort: number; kind: "actor"; actor: Actor };
  const list: DrawItem[] = [];
  const furnSort = (f: PlacedItem) => {
    const fp = itemFootprint(f);
    return f.x + f.y + fp.w / 2 + fp.d / 2;
  };
  for (const f of world.furniture) list.push({ sort: furnSort(f), kind: "furn", item: f });
  for (const a of world.actors) {
    let sort = a.x + a.y + 0.28;
    if (a.sitId) {
      const f = world.furniture.find((it) => it.id === a.sitId);
      if (f) sort = furnSort(f) + 0.15 + (a.sitSlot ?? 0) * 0.04;
    }
    list.push({ sort, kind: "actor", actor: a });
  }
  list.sort((a, b) => a.sort - b.sort);

  for (const it of list) {
    if (it.kind === "furn") {
      const cat = CATALOG_MAP[it.item.catalogId];
      const spr = cat?.sprite ? sprites[cat.sprite] : undefined;
      if (spr && spr.complete && spr.naturalWidth > 0) drawSpriteItem(ctx, it.item, spr);
      else drawProcFurniture(ctx, it.item);
    } else {
      const a = it.actor;
      const s = tileToScreen(a.x, a.y);
      const furn = a.sitId ? world.furniture.find((f) => f.id === a.sitId) : undefined;
      const lift = a.action === "sit" ? seatLiftPx(furn) : 0;
      drawAppearance(
        ctx,
        a.appearance,
        s.x,
        s.y,
        a.dir,
        a.action,
        reducedMotion ? 0 : a.walkPhase,
        reducedMotion ? 0 : world.time,
        lift,
      );
      drawName(ctx, s.x, s.y - lift + (a.action === "sit" ? -8 : 0), a.name, a.isPlayer);
      if (a.bubble && a.bubble.until > world.time) {
        drawBubble(ctx, s.x, s.y - lift - (a.action === "sit" ? 48 : 58), a.bubble.text);
      }
    }
  }

  for (const p of world.particles) {
    const alpha = p.life / p.max;
    ctx.globalAlpha = alpha;
    if (p.text) {
      ctx.font = "700 13px Outfit, sans-serif";
      ctx.fillStyle = p.color;
      ctx.textAlign = "center";
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export function renderAvatarPreview(
  canvas: HTMLCanvasElement,
  appearance: Appearance,
  t: number,
  action: Actor["action"] = "idle",
  direction?: Dir,
) {
  ensureAvatarSheets();
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#1f1013";
  ctx.fillRect(0, 0, w, h);
  const dir = direction ?? (Math.floor(t / 1.8) % 4) as 0 | 1 | 2 | 3;
  ctx.save();
  ctx.translate(w / 2, h * 0.72);
  ctx.scale(2.8, 2.8);
  try {
    drawAppearance(ctx, appearance, 0, 0, dir, action, t * 6, t);
  } catch {
    /* keep preview looping */
  }
  ctx.restore();
}
