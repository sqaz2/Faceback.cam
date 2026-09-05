import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = `${dirname(dirname(fileURLToPath(import.meta.url)))}/`;
const base = pathToFileURL(root).href;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.startsWith(base)) {
      const url = new URL(specifier, context.parentURL);
      if (!url.pathname.endsWith(".ts") && existsSync(`${fileURLToPath(url)}.ts`)) {
        return { url: `${url.href}.ts`, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
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

const starts = [];
const disconnects = [];
const timers = new Map();
let serial = 0;
let timerId = 0;
const param = () => new Proxy({ value: 0 }, { get: (target, key) => key === "value" ? target.value : () => {} });
function node(kind) {
  const id = ++serial;
  const target = {
    id,
    kind,
    connect: (destination) => destination,
    disconnect: () => disconnects.push(id),
    start: (at) => starts.push({ id, at: at ?? 0 }),
    stop: () => {},
    setPeriodicWave: () => {},
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : (object[key] = param()) });
}
class MockAudioContext {
  currentTime = 100;
  sampleRate = 1000;
  state = "running";
  destination = node("destination");
  constructor() {
    return new Proxy(this, {
      get: (object, key) => key in object ? object[key] : String(key).startsWith("create") ? () => node(String(key)) : undefined,
    });
  }
  createBuffer(_channels, length) {
    return { getChannelData: () => new Float32Array(length) };
  }
  resume() { return Promise.resolve(); }
}

globalThis.document = { visibilityState: "visible", addEventListener: () => {} };
globalThis.window = {
  AudioContext: MockAudioContext,
  setTimeout: (callback, delay) => {
    const id = ++timerId;
    timers.set(id, { callback, delay });
    return id;
  },
  clearTimeout: (id) => timers.delete(id),
};
globalThis.clearTimeout = globalThis.window.clearTimeout;

const audio = await import(`${base}src/lib/game/audio.ts`);

test("Stop disconnects every note already queued for the current mix", () => {
  audio.startMix();
  assert.ok(starts.some((entry) => entry.at > audio.getCtx().currentTime));
  const before = disconnects.length;
  audio.stopMix();
  assert.equal(disconnects.length, before + 1);
  assert.equal(audio.isMixPlaying(), false);
});

test("a delayed scheduler skips missed bars instead of replaying the past", () => {
  audio.startMix();
  const scheduledPump = [...timers.values()].find((entry) => entry.delay === 100);
  assert.ok(scheduledPump);
  const before = starts.length;
  audio.getCtx().currentTime += 30;
  scheduledPump.callback();
  const resumed = starts.slice(before);
  assert.ok(resumed.length > 0);
  assert.equal(resumed.filter((entry) => entry.at < audio.getCtx().currentTime).length, 0);
  assert.ok(resumed.length < 300);
  audio.stopMix();
});
