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

test("FACEBACK.CAM composes every visible character choice from generated RGBA sheets", async () => {
  const actions = ["idle", "walk", "sit", "dance"];
  const bodies = ["man", "woman"];
  const catalog = {
    base: [""],
    top: ["tee", "tank", "hoodie", "jacket"],
    bottom: ["pants", "shorts", "skirt"],
    shoes: ["sneakers", "boots", "hightops"],
    hair: ["crop", "spikes", "flow", "halo", "tail", "bangs"],
    accessory: ["shades", "headphones", "cap"],
  };
  const paths = [];
  for (const body of bodies) {
    for (const [category, styles] of Object.entries(catalog)) {
      for (const style of styles) {
        for (const action of actions) {
          paths.push(
            category === "base"
              ? `../public/coke-music/art/avatar/generated/base/${body}/${action}.png`
              : `../public/coke-music/art/avatar/generated/${category}/${body}/${style}/${action}.png`,
          );
        }
      }
    }
  }
  const images = await Promise.all(paths.map((path) => readFile(new URL(path, import.meta.url))));
  const dimensions = images.map(pngInfo);
  assert.deepEqual(new Set(dimensions.map(({ width, height }) => `${width}x${height}`)).size, 1);
  for (const image of dimensions) {
    assert.equal(image.width % 4, 0, "each action sheet must have four equal direction columns");
    assert.equal(image.colorType, 6, "generated layers must preserve transparent RGBA pixels");
  }

  const data = await readFile(new URL("../lib/coke-game/data.ts", import.meta.url), "utf8");
  assert.match(data, /BODY_STYLES\s*=\s*\["Man",\s*"Woman"\]/);
  assert.match(data, /SHOE_STYLES\s*=\s*\["Sneakers",\s*"Boots",\s*"High-tops"\]/);
  assert.match(data, /body:\s*0/);
  assert.match(data, /accessory:\s*0/);
  const renderer = await readFile(new URL("../lib/coke-game/draw.ts", import.meta.url), "utf8");
  assert.match(renderer, /loadActionSheets\("hair"/);
  assert.match(renderer, /loadActionSheets\("accessory"/);
  assert.match(renderer, /ctx\.drawImage\(hair/);
  assert.match(renderer, /if \(accessoryImg\) ctx\.drawImage/);
  assert.match(renderer, /ensureAvatarSheets\(a\.body \?\? 0\)/);
  const drawAppearanceBody = renderer.slice(renderer.indexOf("export function drawAppearance"), renderer.indexOf("function drawBubble"));
  assert.doesNotMatch(drawAppearanceBody, /drawChibi|drawWardrobeHair|drawWardrobeFront/);
});
