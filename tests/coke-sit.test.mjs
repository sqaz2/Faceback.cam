import assert from "node:assert/strict";
import test from "node:test";

// Pure mirror of seatWorldPos math from lib/coke-game/world.ts — keeps CI free of DOM/TS loaders.
function seatWorldPos(f, slot, cat) {
  const n = Math.max(1, cat.seats ?? 1);
  const w = cat.w;
  const d = cat.d;
  const cx = f.x + (w - 1) * 0.5;
  const cy = f.y + (d - 1) * 0.5;
  const depth = cat.sitY ?? 0.12;
  const spreadAmt = cat.sitSpread ?? (n <= 1 ? 0 : w * 0.5);
  const spread = n <= 1 ? 0 : ((slot - (n - 1) / 2) / Math.max(1, n - 1)) * spreadAmt;
  return {
    x: cx + depth + spread * 0.5,
    y: cy + depth - spread * 0.5,
  };
}

function screen(x, y) {
  return { x: (x - y) * 32, y: (x + y) * 16 };
}

test("sofa two-seat slots share screen depth and spread sideways", () => {
  const sofa = { x: 8, y: 8 };
  const cat = { w: 2, d: 1, seats: 2, sitY: 0.06, sitSpread: 0.92 };
  const a = seatWorldPos(sofa, 0, cat);
  const b = seatWorldPos(sofa, 1, cat);
  const sa = screen(a.x, a.y);
  const sb = screen(b.x, b.y);
  assert.ok(Math.abs(sa.y - sb.y) < 0.01, `sy drifted: ${sa.y} vs ${sb.y}`);
  assert.ok(Math.abs(sa.x - sb.x) > 20, `sx spread too small: ${Math.abs(sa.x - sb.x)}`);
  assert.ok(sa.x < sb.x, "slot 0 should be left of slot 1 on screen");
});

test("chair single seat stays near furniture center", () => {
  const chair = { x: 3, y: 8 };
  const cat = { w: 1, d: 1, seats: 1, sitY: 0.1 };
  const p = seatWorldPos(chair, 0, cat);
  assert.ok(Math.abs(p.x - (3 + 0.1)) < 0.001);
  assert.ok(Math.abs(p.y - (8 + 0.1)) < 0.001);
});

test("booth two-seat slots share screen depth like sofa", () => {
  const booth = { x: 1, y: 2 };
  const cat = { w: 2, d: 1, seats: 2, sitY: 0.14, sitSpread: 0.92 };
  const a = seatWorldPos(booth, 0, cat);
  const b = seatWorldPos(booth, 1, cat);
  const sa = screen(a.x, a.y);
  const sb = screen(b.x, b.y);
  assert.ok(Math.abs(sa.y - sb.y) < 0.01, `sy drifted: ${sa.y} vs ${sb.y}`);
  assert.ok(Math.abs(sa.x - sb.x) > 20, `sx spread too small: ${Math.abs(sa.x - sb.x)}`);
});

test("bean single seat nests with positive depth", () => {
  const bean = { x: 2, y: 8 };
  const cat = { w: 1, d: 1, seats: 1, sitY: 0.2 };
  const p = seatWorldPos(bean, 0, cat);
  assert.ok(Math.abs(p.x - (2 + 0.2)) < 0.001);
  assert.ok(Math.abs(p.y - (8 + 0.2)) < 0.001);
});
