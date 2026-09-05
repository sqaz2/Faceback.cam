import {
  ACCESSORIES,
  AVATAR_URLS,
  CATALOG_MAP,
  CLOTH_COLORS,
  HAIR_COLORS,
  SKINS,
} from "./data";
import type { Actor, Appearance, PlacedItem, RoomDef } from "./types";
import { TILE_H, TILE_W, seatLiftPx, tileToScreen, world } from "./world";

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
  hair: HTMLImageElement;
  tops: HTMLImageElement;
  bottoms: HTMLImageElement;
  acc: HTMLImageElement;
};

let avatarSheets: AvatarSheets | null = null;

function ensureAvatarSheets() {
  if (avatarSheets) return avatarSheets;
  const s = {} as AvatarSheets;
  for (const [k, url] of Object.entries(AVATAR_URLS)) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = url;
    (s as unknown as Record<string, HTMLImageElement>)[k] = img;
  }
  avatarSheets = s;
  return s;
}

function dirCell2(dir: number) {
  if (dir === 0) return { c: 0, r: 0 };
  if (dir === 1) return { c: 1, r: 0 };
  if (dir === 3) return { c: 0, r: 1 };
  return { c: 1, r: 1 };
}

function dirIndex4(dir: number) {
  return dir === 0 ? 0 : dir === 1 ? 1 : dir === 3 ? 2 : 3;
}

function facingLeft(dir: number) {
  return dir === 1 || dir === 2;
}

const frameCache = new Map<string, HTMLCanvasElement>();

function extractCell(src: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, size: number): HTMLCanvasElement {
  const tmp = document.createElement("canvas");
  tmp.width = Math.max(1, sw | 0);
  tmp.height = Math.max(1, sh | 0);
  const t = tmp.getContext("2d")!;
  t.drawImage(src, sx, sy, sw, sh, 0, 0, tmp.width, tmp.height);
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const o = out.getContext("2d")!;
  let img: ImageData;
  try {
    img = t.getImageData(0, 0, tmp.width, tmp.height);
  } catch {
    o.drawImage(tmp, 0, 0, size, size);
    return out;
  }
  const d = img.data;
  let minX = tmp.width,
    minY = tmp.height,
    maxX = 0,
    maxY = 0;
  for (let y = 0; y < tmp.height; y++) {
    for (let x = 0; x < tmp.width; x++) {
      if (d[(y * tmp.width + x) * 4 + 3]! > 14) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) {
    o.drawImage(tmp, 0, 0, size, size);
    return out;
  }
  const pad = Math.max(2, Math.round(Math.max(tmp.width, tmp.height) * 0.02));
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(tmp.width, maxX + pad);
  maxY = Math.min(tmp.height, maxY + pad);
  const cw = maxX - minX;
  const ch = maxY - minY;
  const scale = Math.min(size / cw, size / ch) * 0.96;
  const dw = cw * scale;
  const dh = ch * scale;
  const dx = (size - dw) / 2;
  const dy = size - dh - 1;
  o.drawImage(tmp, minX, minY, cw, ch, dx, dy, dw, dh);
  return out;
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
  const SIZE = c.width;
  const skin = hexRgb(SKINS[a.skin] ?? SKINS[0]!);
  const shirt = hexRgb(CLOTH_COLORS[a.topColor] ?? CLOTH_COLORS[0]!);
  const pants = hexRgb(CLOTH_COLORS[a.bottomColor] ?? CLOTH_COLORS[2]!);
  const shoes = hexRgb(CLOTH_COLORS[a.shoeColor] ?? CLOTH_COLORS[2]!);

  const paint = (target: [number, number, number], lum: number): [number, number, number] => {
    const t = Math.max(0, Math.min(1, lum / 255));
    const pale = (target[0] + target[1] + target[2]) / 3 > 200;
    // Pale clothes keep folds (never blow out to a white blob). Saturated clothes keep punch.
    const k = pale ? 0.3 + t * 0.42 : 0.4 + t * 0.7;
    return [clamp255(target[0] * k), clamp255(target[1] * k), clamp255(target[2] * k)];
  };

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!,
      g = d[i + 1]!,
      b = d[i + 2]!,
      al = d[i + 3]!;
    if (al < 12) continue;
    if (r > 150 && b > 130 && g + 25 < r && g + 20 < b) {
      d[i + 3] = 0;
      continue;
    }
    const lum = (r + g + b) / 3;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const sat = mx - mn;
    // Outlines, eyes, mouth, shoe edges stay dark.
    if (lum < 48 && sat < 50) continue;
    const py = (Math.floor(i / 4 / SIZE) + 0.5) / SIZE;
    const isPeach =
      r > g + 10 && g > b + 8 && r > 135 && sat > 38 && sat < 140 && lum > 80 && lum < 240;
    const isCloth = sat < 50 && lum > 52 && lum < 222;

    // Head stays skin. Warm-gray shirts must not count as peach.
    if (py < 0.5) {
      if (isPeach && !isCloth) {
        const p = paint(skin, lum);
        d[i] = p[0];
        d[i + 1] = p[1];
        d[i + 2] = p[2];
      }
      continue;
    }

    if (isPeach && sat > 50) {
      const p = paint(skin, lum);
      d[i] = p[0];
      d[i + 1] = p[1];
      d[i + 2] = p[2];
      continue;
    }

    if (!isCloth) continue;
    const p = py > 0.84 ? paint(shoes, lum) : py > 0.62 ? paint(pants, lum) : paint(shirt, lum);
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

function extractCellCenter(src: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, size: number): HTMLCanvasElement {
  const tmp = document.createElement("canvas");
  tmp.width = Math.max(1, sw | 0);
  tmp.height = Math.max(1, sh | 0);
  const t = tmp.getContext("2d")!;
  t.drawImage(src, sx, sy, sw, sh, 0, 0, tmp.width, tmp.height);
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const o = out.getContext("2d")!;
  let img: ImageData;
  try {
    img = t.getImageData(0, 0, tmp.width, tmp.height);
  } catch {
    o.drawImage(tmp, 0, 0, size, size);
    return out;
  }
  const d = img.data;
  let minX = tmp.width,
    minY = tmp.height,
    maxX = 0,
    maxY = 0;
  for (let y = 0; y < tmp.height; y++) {
    for (let x = 0; x < tmp.width; x++) {
      if (d[(y * tmp.width + x) * 4 + 3]! > 14) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) {
    o.drawImage(tmp, 0, 0, size, size);
    return out;
  }
  const pad = Math.max(2, Math.round(Math.max(tmp.width, tmp.height) * 0.02));
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(tmp.width, maxX + pad);
  maxY = Math.min(tmp.height, maxY + pad);
  const cw = maxX - minX;
  const ch = maxY - minY;
  const scale = Math.min(size / cw, size / ch) * 0.92;
  const dw = cw * scale;
  const dh = ch * scale;
  const dx = (size - dw) / 2;
  const dy = (size - dh) / 2;
  o.drawImage(tmp, minX, minY, cw, ch, dx, dy, dw, dh);
  return out;
}

function drawFace(ctx: CanvasRenderingContext2D, a: Appearance, dir: number, action: Actor["action"]) {
  const sitting = action === "sit";
  const hx = 48;
  const hy = sitting ? 30 : 24;
  const flip = facingLeft(dir) ? -1 : 1;
  const skin = SKINS[a.skin] ?? SKINS[0]!;
  // tiny blush
  ctx.globalAlpha = 0.28;
  oval(ctx, hx - 7 * flip, hy + 3, 3.2, 2.2, "#e08990");
  oval(ctx, hx + 7 * flip, hy + 3, 3.2, 2.2, "#e08990");
  ctx.globalAlpha = 1;
  // eyes
  ctx.fillStyle = "#1a1012";
  ctx.beginPath();
  ctx.ellipse(hx - 5 * flip, hy - 1, 1.7, 2.2, 0, 0, Math.PI * 2);
  ctx.ellipse(hx + 5 * flip, hy - 1, 1.7, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff8f2";
  ctx.beginPath();
  ctx.arc(hx - 4.4 * flip, hy - 1.8, 0.7, 0, Math.PI * 2);
  ctx.arc(hx + 5.6 * flip, hy - 1.8, 0.7, 0, Math.PI * 2);
  ctx.fill();
  // smile
  ctx.strokeStyle = shade(skin, -50);
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(hx, hy + 3.5, 3.2, 0.2, Math.PI - 0.2);
  ctx.stroke();
}

function tintDraw(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  color: string | null,
) {
  if (!color) {
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    return;
  }
  const c = document.createElement("canvas");
  c.width = Math.max(1, dw | 0);
  c.height = Math.max(1, dh | 0);
  const t = c.getContext("2d")!;
  t.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  t.globalCompositeOperation = "source-atop";
  t.fillStyle = color;
  t.globalAlpha = 0.7;
  t.fillRect(0, 0, c.width, c.height);
  t.globalAlpha = 1;
  t.globalCompositeOperation = "destination-in";
  t.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  ctx.drawImage(c, dx, dy);
}

function sheetReady(img: HTMLImageElement | undefined) {
  return !!(img && img.complete && img.naturalWidth > 8);
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawHair(ctx: CanvasRenderingContext2D, style: number, color: string, dir: number, hx: number, hy: number, r: number) {
  const flip = facingLeft(dir) ? -1 : 1;
  const dark = shade(color, -55);
  ctx.fillStyle = color;
  if (style === 0) {
    oval(ctx, hx, hy - r * 0.82, r * 0.9, r * 0.4, color);
    oval(ctx, hx - r * 0.72, hy - r * 0.42, r * 0.26, r * 0.36, color);
    oval(ctx, hx + r * 0.72, hy - r * 0.42, r * 0.26, r * 0.36, color);
  } else if (style === 1) {
    oval(ctx, hx, hy - r * 0.72, r * 0.78, r * 0.32, color);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(hx + i * 5.2 - 2.2, hy - r * 0.55);
      ctx.lineTo(hx + i * 5.4, hy - r * 1.45);
      ctx.lineTo(hx + i * 5.2 + 3, hy - r * 0.55);
      ctx.fill();
    }
  } else if (style === 2) {
    oval(ctx, hx, hy - r * 0.78, r * 0.88, r * 0.4, color);
    oval(ctx, hx + 8 * flip, hy - r * 0.45, r * 0.85, r * 0.55, color);
  } else if (style === 3) {
    oval(ctx, hx, hy - r * 0.7, r * 1.18, r * 0.7, color);
    oval(ctx, hx, hy - r * 1.05, r * 0.9, r * 0.42, dark);
    oval(ctx, hx, hy - r * 0.98, r * 0.78, r * 0.34, color);
  } else if (style === 4) {
    oval(ctx, hx, hy - r * 0.8, r * 0.82, r * 0.36, color);
    oval(ctx, hx - 12 * flip, hy - r * 0.1, 5.2, 11, color);
    oval(ctx, hx - 12 * flip, hy + 10, 4.2, 4.5, color);
  } else {
    oval(ctx, hx, hy - r * 0.78, r * 0.9, r * 0.38, color);
    ctx.fillRect(hx - r * 0.72, hy - r * 0.42, r * 1.44, 5);
  }
}

function drawWardrobeHair(ctx: CanvasRenderingContext2D, a: Appearance, dir: number, action: Actor["action"]) {
  const sitting = action === "sit";
  const hx = 48;
  const hy = sitting ? 30 : 24;
  const r = sitting ? 18 : 20;
  const hairC = HAIR_COLORS[a.hairColor] ?? HAIR_COLORS[0]!;
  const sh = ensureAvatarSheets();
  ctx.save();
  if (facingLeft(dir)) {
    ctx.translate(hx, 0);
    ctx.scale(-1, 1);
    ctx.translate(-hx, 0);
  }
  if (sheetReady(sh.hair) && a.hair >= 0 && a.hair <= 5) {
    const cw = sh.hair.naturalWidth / 3;
    const ch = sh.hair.naturalHeight / 2;
    const col = a.hair % 3;
    const row = Math.floor(a.hair / 3);
    const hair = extractCellCenter(sh.hair, col * cw, row * ch, cw, ch, 72);
    tintToColor(hair, hairC);
    const dw = sitting ? 54 : 52;
    const dh = sitting ? 40 : 38;
    ctx.drawImage(hair, hx - dw / 2, hy - dh * 0.82, dw, dh);
  } else {
    drawHair(ctx, a.hair, hairC, 0, hx, hy, r);
  }
  ctx.restore();
}

function drawWardrobeFront(ctx: CanvasRenderingContext2D, a: Appearance, dir: number, action: Actor["action"]) {
  const sitting = action === "sit";
  const hx = 48;
  const hy = sitting ? 32 : 26;
  const r = sitting ? 16 : 18;
  const topC = CLOTH_COLORS[a.topColor] ?? CLOTH_COLORS[0]!;
  const botC = CLOTH_COLORS[a.bottomColor] ?? CLOTH_COLORS[2]!;
  const sh = ensureAvatarSheets();
  ctx.save();
  if (facingLeft(dir)) {
    ctx.translate(hx, 0);
    ctx.scale(-1, 1);
    ctx.translate(-hx, 0);
  }

  if (a.top === 2) {
    ctx.strokeStyle = shade(topC, -25);
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(hx, hy + 8, r + 2, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
  } else if (a.top === 3) {
    ctx.fillStyle = shade(topC, 22);
    ctx.beginPath();
    ctx.moveTo(hx - 2, 48);
    ctx.lineTo(hx - 11, 64);
    ctx.lineTo(hx - 4, 66);
    ctx.lineTo(hx, 52);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + 2, 48);
    ctx.lineTo(hx + 11, 64);
    ctx.lineTo(hx + 4, 66);
    ctx.lineTo(hx, 52);
    ctx.fill();
  }

  if (a.bottom === 2 && !sitting) {
    ctx.fillStyle = botC;
    ctx.beginPath();
    ctx.moveTo(hx - 10, 62);
    ctx.lineTo(hx + 10, 62);
    ctx.lineTo(hx + 16, 80);
    ctx.lineTo(hx - 16, 80);
    ctx.closePath();
    ctx.fill();
  }

  const acc = ACCESSORIES[a.accessory];
  if (acc === "Shades" && sheetReady(sh.acc)) {
    const cw = sh.acc.naturalWidth / 2;
    const ch = sh.acc.naturalHeight / 2;
    tintDraw(ctx, sh.acc, 0, 0, cw, ch, hx - 16, hy - 4, 32, 14, null);
  } else if (acc === "Cans" && sheetReady(sh.acc)) {
    const cw = sh.acc.naturalWidth / 2;
    const ch = sh.acc.naturalHeight / 2;
    tintDraw(ctx, sh.acc, cw, 0, cw, ch, hx - 28, hy - 12, 56, 30, null);
  } else if (acc === "Shades") {
    ctx.fillStyle = "#1a1012";
    ctx.fillRect(hx - 13, hy - 1, 26, 6);
  } else if (acc === "Cans") {
    oval(ctx, hx - (r + 3), hy + 1, 5, 7, "#1a1012");
    oval(ctx, hx + (r + 3), hy + 1, 5, 7, "#1a1012");
    ctx.strokeStyle = "#1a1012";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(hx, hy - 2, r + 2, Math.PI, 0);
    ctx.stroke();
  } else if (acc === "Cap") {
    oval(ctx, hx, hy - r * 0.78, r * 1.02, r * 0.38, "#e61a27");
    ctx.fillStyle = "#c4121e";
    ctx.beginPath();
    ctx.ellipse(hx + r * 0.42, hy - r * 0.5, r * 0.72, r * 0.16, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade("#e61a27", -30);
    ctx.fillRect(hx - r * 0.7, hy - r * 0.72, r * 1.4, 3);
  }
  ctx.restore();
}

function composeAvatar(
  a: Appearance,
  dir: number,
  action: Actor["action"],
  phase: number,
): HTMLCanvasElement | null {
  const sh = ensureAvatarSheets();
  const bodyImg =
    action === "sit" ? sh.sit : action === "walk" ? sh.walk : action === "dance" || action === "wave" ? sh.dance : sh.idle;
  if (!bodyImg.complete || bodyImg.naturalWidth < 8) return null;
  const key = `${a.skin}-${a.hair}-${a.hairColor}-${a.top}-${a.topColor}-${a.bottom}-${a.bottomColor}-${a.shoeColor}-${a.accessory}-${action}-${dir}-${Math.floor(phase) % 4}`;
  const wardrobeReady = sheetReady(sh.hair);
  const hit = frameCache.get(key);
  if (hit && wardrobeReady) return hit;

  const cell = dirCell2(dir);
  const sw = bodyImg.naturalWidth / 2;
  const shh = bodyImg.naturalHeight / 2;
  const sx = cell.c * sw;
  const sy = cell.r * shh;

  let body: HTMLCanvasElement;
  try {
    body = extractCell(bodyImg, sx, sy, sw, shh, 96);
    remapCanvas(body, a);
    outlineCanvas(body);
  } catch {
    body = document.createElement("canvas");
    body.width = 96;
    body.height = 96;
    body.getContext("2d")!.drawImage(bodyImg, sx, sy, sw, shh, 0, 0, 96, 96);
  }

  const out = document.createElement("canvas");
  out.width = body.width;
  out.height = body.height;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(body, 0, 0);
  try {
    drawWardrobeHair(ctx, a, dir, action);
  } catch {
    /* hair optional */
  }
  try {
    drawWardrobeFront(ctx, a, dir, action);
  } catch {
    /* front optional */
  }

  if (frameCache.size > 280) frameCache.clear();
  if (wardrobeReady) frameCache.set(key, out);
  return out;
}

function shade(hex: string, amt: number) {
  const n = hex.replace("#", "");
  const r = Math.max(0, Math.min(255, parseInt(n.slice(0, 2), 16) + amt));
  const g = Math.max(0, Math.min(255, parseInt(n.slice(2, 4), 16) + amt));
  const b = Math.max(0, Math.min(255, parseInt(n.slice(4, 6), 16) + amt));
  return `rgb(${r},${g},${b})`;
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
  const s = tileToScreen(item.x + (cat.w - 1) * 0.5, item.y + (cat.d - 1) * 0.5);
  const w = cat.w * TILE_W * 0.72;
  const d = cat.d * TILE_W * 0.72;
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
    return;
  }
  if (item.catalogId === "vending") {
    drawCube(ctx, s.x, s.y - 40, 28, 22, 52, "#e61a27", "#b0101c", "#8a0c16");
    ctx.fillStyle = "#1a1012";
    ctx.fillRect(s.x - 8, s.y - 28, 16, 22);
    return;
  }
  if (item.catalogId === "jukebox") {
    drawCube(ctx, s.x, s.y - 32, 26, 20, 40, "#e61a27", "#8a0c16", "#6e0a12");
    return;
  }
  if (item.catalogId === "chair") {
    drawCube(ctx, s.x, s.y - 6, 24, 22, 12, "#e61a27", "#b0101c", "#8a0c16");
    drawCube(ctx, s.x - 8, s.y - 20, 12, 22, 16, "#c4121e", "#8a0c16", "#6e0a12");
    return;
  }
  if (item.catalogId === "plant") {
    drawCube(ctx, s.x, s.y + 4, 16, 14, 10, "#e61a27", "#b0101c", "#8a0c16");
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 18, 16, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#1f6b4a";
    ctx.fill();
    return;
  }
  if (item.catalogId === "speaker") {
    drawCube(ctx, s.x, s.y - 22, 22, 18, 32, "#1a1012", "#14080a", "#0e0608");
    return;
  }
  if (item.catalogId === "sofa") {
    drawCube(ctx, s.x, s.y - 4, w * 0.92, d * 0.8, 14, "#e61a27", "#b0101c", "#8a0c16");
    drawCube(ctx, s.x - w * 0.32, s.y - 18, 16, d * 0.8, 18, "#c4121e", "#8a0c16", "#6e0a12");
    drawCube(ctx, s.x + w * 0.32, s.y - 18, 16, d * 0.8, 18, "#c4121e", "#8a0c16", "#6e0a12");
    return;
  }
  if (item.catalogId === "crate") {
    drawCube(ctx, s.x, s.y - 6, 30, 24, 16, "#8a5a38", "#6e4428", "#5a3620");
    return;
  }
  if (item.catalogId === "disco") {
    ctx.beginPath();
    ctx.arc(s.x, s.y - 10, 11, 0, Math.PI * 2);
    ctx.fillStyle = "#d8d0cc";
    ctx.fill();
    return;
  }
  if (item.catalogId === "table") {
    drawCube(ctx, s.x, s.y - 18, w * 0.7, d * 0.7, 6, "#f4e8dc", "#d4c2b0", "#c4b09c");
    drawCube(ctx, s.x, s.y + 2, 8, 8, 16, "#6e4428", "#5a3620", "#4a2c18");
    return;
  }
  if (item.catalogId === "lamp") {
    drawCube(ctx, s.x, s.y + 8, 10, 10, 28, "#c5b9b4", "#9a8e88", "#7a706c");
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 18, 16, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#f4e8dc";
    ctx.fill();
    return;
  }
  if (item.catalogId === "bean") {
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 6, 22, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#e61a27";
    ctx.fill();
    return;
  }
  if (item.catalogId === "fridge") {
    drawCube(ctx, s.x, s.y - 36, 28, 24, 44, "#f4e8dc", "#d0c0b4", "#c0b0a4");
    return;
  }
  if (item.catalogId === "tv") {
    drawCube(ctx, s.x, s.y - 22, 36, 16, 26, "#1a1012", "#120a0c", "#0c0608");
    ctx.fillStyle = "#2a5a8a";
    ctx.fillRect(s.x - 12, s.y - 14, 24, 14);
    return;
  }
  if (item.catalogId === "stool") {
    drawCube(ctx, s.x, s.y - 16, 20, 20, 5, "#e61a27", "#b0101c", "#8a0c16");
    return;
  }
  if (item.catalogId === "booth") {
    drawCube(ctx, s.x, s.y - 8, w, d * 0.8, 12, "#6e0a12", "#4a0810", "#3a060c");
    drawCube(ctx, s.x - 10, s.y - 22, 16, d * 0.8, 18, "#e61a27", "#b0101c", "#8a0c16");
    return;
  }
  if (item.catalogId === "stage") {
    drawCube(ctx, s.x, s.y - 8, w, d, 14, "#2a1619", "#1a1012", "#14080a");
    ctx.strokeStyle = "#e61a27";
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - 20, s.y - 4, 40, 8);
    return;
  }
  if (item.catalogId === "mic") {
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
    return;
  }
  drawCube(ctx, s.x, s.y - 16, w * 0.8, d * 0.8, 18, "#e61a27", "#b0101c", "#8a0c16");
}

const SPRITE_H: Record<string, number> = {
  vending: 102,
  jukebox: 98,
  fridge: 94,
  lamp: 96,
  speaker: 84,
  plant: 86,
  mic: 82,
  disco: 64,
  sofa: 68,
  booth: 72,
  chair: 62,
  stool: 50,
  table: 48,
  bean: 42,
  crate: 44,
  stage: 48,
  tv: 66,
};

function drawSpriteItem(ctx: CanvasRenderingContext2D, item: PlacedItem, img: HTMLImageElement) {
  const cat = CATALOG_MAP[item.catalogId]!;
  const s = tileToScreen(item.x + (cat.w - 1) * 0.5, item.y + (cat.d - 1) * 0.5);
  const footY = s.y + TILE_H * 0.5;
  const destH = SPRITE_H[cat.sprite ?? item.catalogId] ?? 56;
  const aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
  const tileSpan = TILE_W * (0.55 * cat.w + 0.45 * cat.d);
  let destW = destH * aspect;
  if (cat.w >= 2) destW = Math.min(Math.max(destW, tileSpan * 0.92), tileSpan * 1.08);
  else destW = Math.min(Math.max(destW, tileSpan * 0.7), tileSpan * 1.15);
  ctx.drawImage(img, s.x - destW / 2, footY - destH, destW, destH);
}

function drawChibi(
  ctx: CanvasRenderingContext2D,
  a: Appearance,
  ox: number,
  oy: number,
  dir: number,
  action: Actor["action"],
  phase: number,
  t: number,
) {
  const skin = SKINS[a.skin] ?? SKINS[0]!;
  const hairC = HAIR_COLORS[a.hairColor] ?? HAIR_COLORS[0]!;
  const topC = CLOTH_COLORS[a.topColor] ?? CLOTH_COLORS[0]!;
  const botC = CLOTH_COLORS[a.bottomColor] ?? CLOTH_COLORS[2]!;
  const shoeC = CLOTH_COLORS[a.shoeColor] ?? CLOTH_COLORS[2]!;
  const flip = facingLeft(dir) ? -1 : 1;
  const sitting = action === "sit";
  const dancing = action === "dance";
  const waving = action === "wave";
  const walking = action === "walk";
  const bob = dancing ? Math.abs(Math.sin(t * 10)) * 5 : walking ? Math.sin(phase) * 2 : 0;
  ctx.save();
  ctx.translate(ox, oy + (sitting ? 10 : 0) - bob);

  oval(ctx, 0, sitting ? 10 : 18, 13, 5, "rgba(0,0,0,0.28)");

  const swing = walking ? Math.sin(phase) * 5 : dancing ? Math.sin(t * 10) * 3 : 0;
  if (!sitting) {
    ctx.fillStyle = botC;
    ctx.beginPath();
    ctx.roundRect(-8 * flip - 3, 2, 8, a.bottom === 1 ? 12 : 16, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(4 * flip - 3, 2 + swing * 0.15, 8, a.bottom === 1 ? 12 : 16, 3);
    ctx.fill();
    ctx.fillStyle = shoeC;
    ctx.beginPath();
    ctx.roundRect(-9 * flip - 3, 14, 10, 5, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(3 * flip - 3, 14 + swing * 0.15, 10, 5, 2);
    ctx.fill();
  } else {
    ctx.fillStyle = botC;
    ctx.beginPath();
    ctx.roundRect(-12, 4, 24, 9, 4);
    ctx.fill();
    ctx.fillStyle = shoeC;
    ctx.beginPath();
    ctx.roundRect(-14, 11, 9, 5, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(5, 11, 9, 5, 2);
    ctx.fill();
  }

  if (a.bottom === 2) {
    ctx.fillStyle = botC;
    ctx.beginPath();
    ctx.moveTo(-11, 2);
    ctx.lineTo(11, 2);
    ctx.lineTo(14, 13);
    ctx.lineTo(-14, 13);
    ctx.closePath();
    ctx.fill();
  }

  const bodyH = a.top === 1 ? 15 : a.top === 2 ? 20 : 18;
  ctx.fillStyle = shade(topC, -18);
  ctx.beginPath();
  ctx.roundRect(-11, sitting ? -8 : -14, 22, bodyH, 6);
  ctx.fill();
  ctx.fillStyle = topC;
  ctx.beginPath();
  ctx.roundRect(-10, sitting ? -9 : -15, 20, bodyH - 1, 6);
  ctx.fill();

  const armUp = dancing || waving;
  const drink = action === "drink";
  const armY = armUp ? -24 : drink ? -16 : sitting ? -4 : -8;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.roundRect(-15 * flip - 3, armY, 7, armUp ? 10 : 13, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(11 * flip - 3, drink ? -20 : armY + (walking ? swing * 0.25 : 0), 7, armUp ? 10 : 13, 3);
  ctx.fill();
  if (drink) {
    ctx.fillStyle = "#e61a27";
    ctx.beginPath();
    ctx.roundRect(16 * flip - 3, -28, 7, 12, 2);
    ctx.fill();
  }

  const headY = -28;
  oval(ctx, 0, headY, 13, 14, skin);
  ctx.fillStyle = "#1a1012";
  ctx.beginPath();
  ctx.ellipse(-3.8 * flip, headY - 1, 1.8, 2.3, 0, 0, Math.PI * 2);
  ctx.ellipse(3.8 * flip, headY - 1, 1.8, 2.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(skin, -40);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(0, headY + 3, 3.6, 0.15, Math.PI - 0.15);
  ctx.stroke();

  drawHair(ctx, a.hair, hairC, dir, 0, headY, 13);

  if (a.top === 2) {
    ctx.strokeStyle = shade(topC, -20);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, headY + 2, 15, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  }
  if (a.top === 3) {
    ctx.fillStyle = shade(topC, 20);
    ctx.beginPath();
    ctx.moveTo(-2, -14);
    ctx.lineTo(-9, 2);
    ctx.lineTo(-3, 3);
    ctx.lineTo(0, -8);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2, -14);
    ctx.lineTo(9, 2);
    ctx.lineTo(3, 3);
    ctx.lineTo(0, -8);
    ctx.fill();
  }

  const acc = ACCESSORIES[a.accessory];
  if (acc === "Shades") {
    ctx.fillStyle = "#1a1012";
    ctx.fillRect(-10, headY - 4, 20, 5);
  } else if (acc === "Cans") {
    ctx.fillStyle = "#1a1012";
    oval(ctx, -15, headY, 4.5, 6, "#1a1012");
    oval(ctx, 15, headY, 4.5, 6, "#1a1012");
    ctx.strokeStyle = "#1a1012";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, headY - 6, 12, Math.PI, 0);
    ctx.stroke();
  } else if (acc === "Cap") {
    oval(ctx, 0, headY - 10, 13, 5, "#e61a27");
    ctx.fillStyle = "#c4121e";
    ctx.fillRect(-2 * flip, headY - 11, 16 * flip, 4);
  }

  ctx.restore();
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
    const frame = composeAvatar(a, dir, action, phase);
    if (frame) {
      const bob = action === "dance" ? Math.abs(Math.sin(t * 10)) * 3 : action === "walk" ? Math.sin(phase) * 2 : 0;
      const sitting = action === "sit";
      const h = sitting ? 70 : 78;
      const w = (frame.width / frame.height) * h;
      const foot = sitting ? 6 : 10;
      ctx.drawImage(frame, ox - w / 2, oy - h + foot - sitLift - bob, w, h);
      return;
    }
  } catch {
    /* fall through to canvas chibi */
  }
  drawChibi(ctx, a, ox, oy, dir, action, phase, t);
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
    const cat = CATALOG_MAP[f.catalogId];
    return f.x + f.y + (cat?.w ?? 1) / 2 + (cat?.d ?? 1) / 2;
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
      drawAppearance(ctx, a.appearance, s.x, s.y, a.dir, a.action, a.walkPhase, world.time, lift);
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
  const dir = (Math.floor(t / 1.8) % 4) as 0 | 1 | 2 | 3;
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

