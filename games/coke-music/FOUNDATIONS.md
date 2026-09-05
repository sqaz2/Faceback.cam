# Foundations pass (coke-music-foundations)

What changed in this branch vs what is still deferred.

## Shipped

- **Searchable inventory / catalog**: name + category filter, Catalog/Owned tabs, category chips.
- **Furniture expansion**: Habbo-like catalog variants (extra sofas, chairs, stools, booths, beans, tables, lamps, plants, speakers, rugs) reusing existing sprites with distinct ids, names, and placement knobs.
- **Grounded furniture**: `groundBias` + retuned `SPRITE_H` / `footY` so public-room props sit on tile diamonds; Red Room placements expanded with cream loveseat, booth, lamps, plants.
- **Sitting nest**: retuned `sitY` / `sitLift` / `sitSpread` for sofa/chair/stool/booth/bean; sit draw foot offset lowered so cushions catch sitters.
- **V-Ego create / wardrobe UI**: every hair/top/bottom/accessory option is a labeled live chibi tile (not unfinished cubes/blobs); larger hero preview.
- **Docs**: this file + README run notes + `scripts/extract-art.sh` (art zip stays at repo root).

## Deferred (wishlist / known gaps)

- True 4-frame **walk cycle** (still idle + bob).
- A **dozen unique sofa arts** (variants share sprites for now).
- **Wall / floor painting** tools.
- Mixer **music quality** upgrade beyond current Web Audio bed.
- Headphones/shades polish; Tail/Bangs hair can still read a bit helmet-y.
- Real multiplayer (`src/lib/multiplayer/` stub only).
- Playwright sit QA screenshots in CI (run `node scripts/qa-sit.mjs` locally after art extract).

## Brand / stack

Auth and DB stay **off** (localStorage Zustand). Cherry-red / cream lounge. No Coca-Cola or Habbo trademarks in UI copy.
