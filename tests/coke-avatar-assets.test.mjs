import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function pngInfo(buffer) {
  assert.equal(buffer.subarray(1, 4).toString(), "PNG");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
  };
}

test("FACEBACK.CAM uses one transparent four-direction master for every action", async () => {
  const actions = ["idle", "walk", "sit", "dance"];
  const images = await Promise.all(actions.map((action) =>
    readFile(new URL(`../public/coke-music/art/avatar/${action}-v2.png`, import.meta.url)),
  ));
  const dimensions = images.map(pngInfo);
  assert.deepEqual(new Set(dimensions.map(({ width, height }) => `${width}x${height}`)).size, 1);
  for (const image of dimensions) {
    assert.equal(image.width % 4, 0, "each action sheet must have four equal direction columns");
    assert.equal(image.colorType, 6, "sprites must preserve transparent RGBA pixels");
  }

  const data = await readFile(new URL("../lib/coke-game/data.ts", import.meta.url), "utf8");
  assert.match(data, /accessory:\s*0/);
  assert.match(data, /"Headphones"/);
  assert.doesNotMatch(data, /avatar\/(?:idle|walk|sit|dance)\.png\?v=6/);
  assert.doesNotMatch(data, /avatar\/(?:hair|tops|bottoms|acc)\.png/);
});
