import assert from "node:assert/strict";
import test from "node:test";

// Pure mirror of lib/coke-game/draw.ts stride helpers — keeps CI free of DOM/TS loaders.
function strideCycle(phase) {
  const u = (phase / (Math.PI * 2)) % 1;
  return u < 0 ? u + 1 : u;
}

function strideBeat(phase) {
  const u = strideCycle(phase);
  if (u < 0.16) return "plant";
  if (u < 0.34) return "push";
  if (u < 0.68) return "mid";
  return "recover";
}

function strideAction(action, phase) {
  if (action !== "walk") return action;
  const beat = strideBeat(phase);
  return beat === "plant" || beat === "push" ? "idle" : "walk";
}

test("stride beats map a full 2π walkPhase into plant/push/mid/recover", () => {
  assert.equal(strideBeat(0), "plant");
  assert.equal(strideBeat(Math.PI * 0.5), "push"); // cycle 0.25
  assert.equal(strideBeat(Math.PI), "mid"); // cycle 0.5
  assert.equal(strideBeat(Math.PI * 1.5), "recover"); // cycle 0.75
});

test("strideAction stays on idle for plant/push and walk sheet for mid/recover", () => {
  assert.equal(strideAction("walk", 0), "idle");
  assert.equal(strideAction("walk", Math.PI * 0.5), "idle");
  assert.equal(strideAction("walk", Math.PI), "walk");
  assert.equal(strideAction("walk", Math.PI * 1.5), "walk");
  assert.equal(strideAction("idle", Math.PI), "idle");
  assert.equal(strideAction("sit", Math.PI), "sit");
});

test("strideCycle wraps negative and large phases", () => {
  assert.ok(strideCycle(-0.1) > 0.9);
  assert.equal(strideBeat(Math.PI * 2), "plant");
  assert.equal(strideBeat(Math.PI * 4 + Math.PI), "mid");
});
