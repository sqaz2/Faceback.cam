# Handoff: Coke Music / Coke Studios tribute

This file is for another human or AI picking up the project. It records **what the user asked for**, **preferences that kept coming up**, **bugs that looked “fixed” but weren’t**, and **how the current code actually works**. Read this before changing sitting, avatars, furniture, or art.

The playable app lives at the repo root (`src/`, `public/`). It is **not** the old static prototype under `artifacts/vego/`.

---

## 1. What this is

A **browser tribute** to **2002 Coke Music / Coke Studios** — the Habbo-style isometric hangout with a music mixer.

Working title in OG metadata: **Coke Music** (`src/lib/og/site.json`). In-world characters are **V-Egos**. The flagship room is the **Red Room**.

It should **feel like** Habbo Hotel / Coke Music:

- Click-to-walk isometric room
- Click furniture to sit / drink / play the jukebox / hit the stage
- Multi-seat sofas: if you sit, there is room for someone next to you
- Wardrobe with real clothing/hair/accessories, not cubes
- Furniture occupies exact tiles; you cannot walk through a sofa or plant
- Sitters nest **on the cushions**, not on armrests, not floating in the air

It is **not** a 1:1 clone of trademarks. See brand rules below.

Original user ask (paraphrased): *“vibe code coke music clone produce final product.”*

---

## 2. Hard constraints (do not “helpfully” violate)

| Topic | Rule |
| --- | --- |
| Auth / accounts | **OFF**. No login, no profiles-across-devices. |
| Database | **OFF**. Persist with `localStorage` + Zustand only (`src/lib/game/store.ts`, key `coke-music-v1`). |
| Preview | SPA on `0.0.0.0:8080` via `npm run dev` / `startup.sh`. |
| Art trademarks | **Brand-safe.** Cherry-red / cream lounge. **Do not** put Coca-Cola wordmarks, contour bottles, Habbo, Sulake, or their logos in generated art. “Cola machine” in-world is original. Prompts must not name those IPs. |
| Cubes | **Forbidden as the player/NPC look.** Early versions fell back to cubes when sprites tainted or failed to load. User hated this. |
| Shipping unfinished art | User’s exact frustration: *“you keep presenting unfinished artwork and controls instead of testing what you build and refine.”* **Do not declare sitting or characters done without browser screenshots.** |

Stack (keep it): React 19 + Vite + TanStack Router + Tailwind v4 + Zustand. Canvas 2D isometric, not Phaser/Three unless the user asks.

---

## 3. User messages, in order (the real spec)

These are the follow-ups. All of them are still in force.

1. **Redo images; music could be better.** First art pass failed (cubes / unusable). Prompts must not violate copyright. Mixer needed more life than a thin beep loop.

2. **Proper chibi characters + inventory for every wardrobe option.** Furniture must **interact** with V-Egos. Sofa must be **two-seat**: sit, and there is room for someone next to you.

3. **Polished clothing and accessories.** Sofa felt like a floating sprite you could walk behind; hard to click to sit. Plants: you could walk behind them. Furniture must obstruct the square(s) it occupies (`w × d` tiles). Furniture is placed on tiles.

4. **Hair (especially Tail and Bangs) looked bad** — redesign with real images, not ovals. Sofa sprite was nice but not sitting on ground tiles / looked sideways. Sitters stood **next to** the sofa or **floated**, not nested on cushions. **Future (user said this, not built yet):** a dozen sofas, more hairs, tables, plants, **wall/floor painting**.

5. **Walked under the sofa.** Sitting on chair/sofa sat **in the air**, not on the cushion. Need better hairstyles. *“This game should operate like habbo hotel and coke music clone.”*

6. *“Nothing’s fixed that you said.”* Full audit of furniture config **and how characters react to it**. Wardrobe overhaul. **Use real images.**

7. *“The characters still need a lot of work. Also the sitting isn’t finished.”* Screenshots showed:
   - V-Ego as a **white blob with a red cap** sitting on the **sofa armrest**
   - Nia looking more reasonable on a cushion
   - V-Ego on a chair as a **tiny white hovering blob**
   Explicit: test in browser, iterate until sitters are **on cushions** and the player is **not a white blob**.

8. **This zip request:** package the whole project + a markdown of preferences/tidbits so another AI can pick up the picture.

### Preferences that kept repeating

- **Test, then refine.** Screenshots in Playwright. Do not describe a fix as done until you have looked at `qa-sit-white.png` / `qa-sit-red.png` / `qa-sit-chair.png`.
- **Habbo-like seating:** click near a sofa to sit; two cushions; nestle into the seat; legs can hang; you cannot walk through the footprint.
- **Chibi, not cubes, not abstract blobs.** Peach face, eyes, hair, clothes with folds. White clothes must still show a face.
- **Every wardrobe option must be visible** in the inventory/create UI and on the in-room avatar.
- **Isometric furniture grounded on tiles**, not floating billboards you walk under.
- **Cherry-red + cream lounge** aesthetic. Wordmark / “Est. 2002 · Studios open.”
- **Music mixer should feel like burning a disc** and dropping it on a jukebox / performing on stage. User said the music “could be better” after the first pass — `src/lib/game/audio.ts` is a Web Audio mixer with genres/clips, vinyl, ducking. Still fair game to improve.
- **Do not gold-plate** wall/floor painting or “a dozen sofas” unless asked this turn — but those are on the wishlist.
- User-facing copy: product language. V-Ego, Red Room, decibels (dB), burned discs. Not “Habbo” in the UI.

### Things the user did **not** ask for

- Accounts, multiplayer-as-default, leaderboards, a real Coke license.
- Replacing the canvas world with DOM furniture.
- Pixel-art 16-bit (the look is **clean HD chibi**, 3/4 isometric).

---

## 4. How the game is structured

```
src/components/game/app.tsx       splash → create V-Ego → world + overlays
src/components/game/world-view.tsx  canvas loop, HUD, window.__vego debug API
src/components/game/mixer-panel.tsx  4-track mixer UI
src/components/game/minigames.tsx    VegaSan, Uncover Music
src/lib/game/world.ts              sim: pathfind, sit, block, AI, drinks, stage
src/lib/game/draw.ts               isometric render + avatar compose
src/lib/game/data.ts               catalog, rooms, wardrobe enums, sprite URLs
src/lib/game/types.ts              Appearance, CatalogItem (sitY/sitLift/sitSpread)
src/lib/game/pathfind.ts           A* — blocked tiles are never legal goals
src/lib/game/store.ts              localStorage save
src/lib/game/audio.ts              Web Audio mixer + lounge bed
public/art/avatar/                 idle, sit, walk, dance, hair, acc, tops, bottoms
public/art/furniture/              iso props (sofa, chair, …)
scripts/qa-sit.mjs                 Playwright sit/wardrobe visual QA
scripts/process-wardrobe.py        magenta chroma-key for overlay sheets
```

Iso constants: `TILE_W = 64`, `TILE_H = 32`.

```
screen.x = (tx - ty) * 32
screen.y = (tx + ty) * 16
```

`+x` is down-right, `+y` is down-left. Furniture draw origin matches `drawSpriteItem`:

```
cx = item.x + (w - 1) * 0.5
cy = item.y + (d - 1) * 0.5
footY = screen.y + TILE_H * 0.5   // sprite stands on the diamond
```

Directions: `0 = +x`, `1 = +y` (toward camera — **sit facing**), `2 = -x`, `3 = -y`. Avatar body sheets are **2×2**:

| cell | dir |
| --- | --- |
| top-left | 0 down-right |
| top-right | 1 down-left (sit uses this) |
| bottom-left | 3 up-right |
| bottom-right | 2 up-left |

`walk.png` is currently a copy of `idle.png` (2×2). Walk motion is a bob, not a 4-frame cycle.

`window.__vego` (from `world-view.tsx`) exposes `{ world, occupySeat, player, clickWorld, setPlayerLook }` for Playwright.

---

## 5. Sitting (the part that kept being wrong)

### What “done” looks like

- Sofa (`w: 2`, `seats: 2`) at Red Room `(8, 8)`: two V-Egos on the **two cushions**, same visual depth, not on the left/right **armrests**.
- Chair: butt on the cream cushion, legs dangling, not a tiny ghost hovering in front.
- Clicking the sofa sprite **or tiles in front of it** sits you (sofa art overhangs the front).
- You **cannot walk under/through** the sofa or a plant. A* must not allow a blocked goal.
- Stand-up snaps to a walkable tile, not onto the sofa footprint.

### Why earlier math put people on the armrest

Naive `x = f.x + pad + slot * usable` with the same `y` for both slots **does not** keep sitters at the same screen-depth. In iso, higher `x` is down-right, so slot 1 slid onto the **right arm** and looked like it was sitting on the armrest.

**Current `seatWorldPos`** (`world.ts`) places seats in **screen-symmetric** offsets from the furniture origin:

- `depth` (`sitY`) is added to **both** `x` and `y` → moves down-screen, `sx` unchanged.
- `spread` varies `(tx - ty)` → left/right on screen, same `sy`.

Verified QA numbers for sofa at `(8,8)`:

- origin screen ≈ `(16, 264)`
- slot 0 ≈ `sx 0–1`, slot 1 ≈ `sx 31–32`, **same `sy`**

### Per-item knobs (`data.ts` catalog)

| id | sitY | sitLift | sitSpread | notes |
| --- | --- | --- | --- | --- |
| sofa | 0.04 | 12 | 0.95 | two cushions |
| chair | 0.08 | 16 | — | higher seat |
| stool | 0.10 | 14 | — | |
| booth | 0.10 | 8 | 0.90 | two seats |
| bean | 0.22 | -2 | — | low; negative lift is OK |

`sitLift` is pixels **up** when drawing a sitting actor (`draw.ts` `drawAppearance`). The **sit sprite is a chair-sit** (thighs forward, lower legs hanging). That pose is load-bearing: the old sit sheet was a **floor sit** (butt at the bottom of the sprite), so planting feet on the tile put the butt on the **floor / arm / front lip**. Do not go back to a seiza/floor-sit sheet.

Y-sort: sitting actors sort just **after** their furniture (`furnSort + 0.15`) so they draw on top of the seat but still in the room order.

Click: `sitFurnitureNear` checks the tile plus neighbors (including `dy = -1/-2`) because the sofa sprite overhangs the front.

Blocking: `rebuildBlocked` skips `floor`, `hang`, and `block === false` (disco, stage). Plants and sofas **do** block their `w × d`. `tick` snaps non-sitters off blocked tiles (the “walked under the sofa” bug). `astar` must never path to a blocked goal.

If you change sofa art, **re-screenshot** both slots. Spread/lift are tuned to the current `public/art/furniture/sofa.png` (drawn `SPRITE_H.sofa = 68`).

---

## 6. Characters / wardrobe (the white-blob saga)

### Pipeline

1. Body sheet (`idle` / `sit` / `walk` / `dance`): **bald** peach chibi, **medium-gray** clothes, dark outlines, 2×2 directions.
2. `extractCell` crops opaque pixels, bottom-aligns into 96×96.
3. `remapCanvas` recolors peach → chosen skin, gray → shirt/pants/shoes by `py`. **Pale clothes are luminance-mapped with a cap** so `#FFFFFF` becomes a shaded off-white, not a blown-out blob.
4. `outlineCanvas` darkens edge pixels so white outfits keep a silhouette.
5. Hair overlay **on top of the scalp** from `hair.png` (2×3: Crop, Spikes, Flow, Halo, Tail, Bangs), tinted to hair color.
6. Accessories: sheet for Shades/Cans; **Cap is procedural** (crown + visor). The acc-sheet cap was a red smear.
7. **Do not draw a second procedural face** on top of the body sheet — the new bodies already have eyes/smile. Double-face looked wrong; missing face on white clothes was a remap bug.

Compose cache key includes the full `Appearance`. Skip caching until hair/acc sheets are `complete`.

### Why V-Ego became a white blob

- `CLOTH_COLORS[8] === "#FFFFFF"`.
- Old remap treated **all light desaturated pixels** (including face) as shirt.
- Hair was drawn **behind** the body, so a white head hid it.
- Source idle sheets used to have **baked brown hair**, fighting overlays.
- Sit scale was tiny (`h ≈ 56`) so a featureless white sprite looked like a ghost on the armrest.

Worst-case QA look (keep testing this):

```
skin 0, hair 4 (Tail), hairColor 0, top 0, topColor 8 (white),
bottom 0, bottomColor 8, shoeColor 2, accessory 3 (Cap)
```

If that look is a blob again, remap or layering regressed.

Second QA look: red hoodie (`top: 2, topColor: 0`), bangs (`hair: 5`), cans (`accessory: 2`).

### Peach vs gray shirt

Generated “gray” tees come out **warm gray** and can match a loose peach detector, painting the **shirt as skin**. Head-region peach is remapped; body uses a **stricter** peach (`sat > 38`, `r > g > b`) and treats low-sat pixels as cloth. If create-preview shows a nude/peach torso on a red tee, this detector slipped again.

### Sprite files (`public/art/avatar/`, cache-bust `?v=6` in `AVATAR_URLS`)

| file | grid | what |
| --- | --- | --- |
| idle.png | 2×2 | bald standing |
| sit.png | 2×2 | bald **chair-sit**, legs dangling, no furniture in the sprite |
| walk.png | 2×2 | copy of idle (bob in code) |
| dance.png | 2×2 | bald, arms up |
| hair.png | 2×3 | hair **only** (no heads). Magenta keyed. |
| acc.png | 2×2 | shades, cans, cap (cap unused in code) |
| tops.png / bottoms.png | 2×2 | overlays; body remap is the main cloth path |

Art style to match if you regenerate: clean HD chibi, big round head, small body, crisp dark outlines, solid `#FF00FF` background, **no Coke/Habbo names in the prompt**. Process with chroma-key (`scripts/process-wardrobe.py` or `generate2dsprite`). Keep even cell sizes.

`hair2.png` is leftover from an older pass.

---

## 7. Furniture / rooms

Catalog in `data.ts`. Red Room sofa at `(8,8)`; plant at `(11,5)` was moved **off the sofa front** so click-to-sit and blocking don’t fight.

Disco: `hang: true, block: false`. Stage: `block: false` (walkable performance floor). Rugs: `floor: true` (no collision).

Private room `studio`: player places catalog items with `placeAt` / `pickupAt`. Public rooms ignore placing.

If you add more sofas/chairs, set `sit`, `seats`, `sitY`, `sitLift`, `sitSpread` and **screenshot two sitters**. Do not assume 1-tile math works on `w: 2`.

---

## 8. Mixer / progression (user: “the music could be better”)

- 4 tracks: drums, bass, melody, vox. Genres in `GENRES` / clips in `CLIPS`.
- Burn a disc → inventory → play on **jukebox** or perform on **stage**.
- Currency is **decibels (dB)**. Cola machines / crates grant dB; Red Room is `doubleDb`. Stage thumbs-up from NPCs while performing.
- Web Audio in `audio.ts`: buses, compressor, delay, vinyl crackle, lounge bed, ducking when a mix plays.
- Minigames: VegaSan, Uncover Music (`minigames.tsx`) — extra dB.

Improving the mixer is still aligned with the user. Don’t strip it.

---

## 9. Known remaining gaps (honest)

These are **not** claimed done:

- Walk is idle+bob, not a 4-frame walk cycle (old 4×4 walk didn’t match the new bald chibi).
- Headphones/shades from `acc.png` are messier than the procedural cap.
- Hair can still read a bit “helmet-y” on Tail/Bangs — user originally called those styles out as bad; current overlays are real images and better, not perfect.
- Sitters are on cushions in QA shots; small `sitLift` / `sitY` tweaks may still help nest them deeper if sofa art changes.
- Wishlist from the user, **not built**: dozen sofa variants, more hairs, more tables/plants, **wall and floor painting**.
- Mixer can still be more musical.
- No real multiplayer (there is a `src/lib/multiplayer/` stub; not the product).
- `artifacts/vego/` is an **abandoned static** prototype. Do not “fix” that instead of `src/`.

---

## 10. How to test (mandatory before calling sit/characters done)

Dev: `npm install` then `npm run dev` (port 8080). `startup.sh` is the revive contract.

```bash
node scripts/qa-sit.mjs
```

Inspect:

- `screenshots/qa-create.png` — create preview is a chibi (face, hair, clothes), not a cube/blob
- `screenshots/qa-sit-white.png` — white clothes + cap + tail, **two people on two sofa cushions**, faces visible
- `screenshots/qa-sit-red.png` — red hoodie + bangs + cans, still on cushions
- `screenshots/qa-sit-chair.png` — chair sit on the cushion
- `screenshots/qa-stand.png` — standing size comparable to NPCs

User bug screenshots (the standard of “broken”) are in `attachments/`:

- `27991.png` — V-Ego white blob on **sofa armrest**, Nia on sofa
- `27989.png` — standing white blob
- `27990.png` — tiny hovering blob on a chair
- `27891.png` / `27892.png` — walked under sofa; sit in the air

If a new screenshot looks like those, it is not fixed.

Typecheck: `npm run typecheck`.

---

## 11. Brand / copy / palette

- Cherry `#E61A27`, cream `#F4E8DC`, ink `#1A0A0C` / `#14080A`.
- UI: Outfit font, cream-on-ink, red CTAs.
- Player default name **V-Ego**. NPCs: Rio, Nia, Jules, Kato, …
- Help overlay should mention click-to-sit and that furniture blocks tiles.
- Do not put “Habbo” or “Coca-Cola” in player-facing strings. Tribute framing is enough (“Est. 2002”, “isometric cola lounge”).

---

## 12. Working with another AI — do this first

1. Read this file and `src/lib/game/{types,data,world,draw}.ts`.
2. Run the app and `qa-sit.mjs`. **Look at the PNGs.**
3. If you change seats or avatars, iterate on those PNGs. Do not trust the math alone — iso + sprite overhang lies.
4. Keep bodies **bald + gray clothes** so hair overlays and remaps work. Do not bake hair into idle/sit again.
5. Keep sit sprites as **chair-sit with dangling legs**, furniture-free, magenta background.
6. Never re-enable a “light pixels → shirt color” remap that can hit the face.
7. Auth/db stay off unless the user asks for accounts.

---

## 13. Zip contents note

This archive **omits `node_modules/`** (restore with `npm install`; `package-lock.json` is included). Raw Imagine intermediates under `artifacts/imagine_images/` are omitted as bulk; processed sprites are in `public/art/`. User bug screenshots (`attachments/`) and QA shots (`screenshots/`) are included on purpose.
