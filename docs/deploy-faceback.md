# Deploying FACEBACK.CAM (public host)

`faceback.pages.dev` historically pointed at an **older Vite Coke Music tribute**, not this vinext app. Do not treat that URL as current.

## Live preview (2026-10-02)

- **Preview Worker:** https://faceback-cam-preview.sqaz.workers.dev
- Coke Music / Red Room: https://faceback-cam-preview.sqaz.workers.dev/world
- This preview ships **without a D1 binding** (token lacked D1 create permission; placeholder `00000000-…` blocked `faceback-cam`).
- `/world` is localStorage-only and works. Arena / profile / authenticated APIs that touch `env.DB` will fail until D1 is wired.

## Local

```bash
# Node >= 22.13
npm ci
npm run dev          # http://localhost:5173 → open /world
npm run test:unit
# with Playwright + chromium installed:
QA_BASE=http://127.0.0.1:5173/world node scripts/qa-sit-world.mjs
```

## Production Worker (full Faceback + Arena)

1. Create a D1 database (Cloudflare dashboard or a token with D1 edit):
   ```bash
   npx wrangler d1 create faceback-cam-db
   ```
2. `npm run build`
3. Edit `dist/server/wrangler.json`:
   - `name`: `faceback-cam` (or keep `faceback-cam-preview`)
   - `d1_databases[0].database_id`: the real UUID from step 1
4. Deploy:
   ```bash
   npx wrangler deploy --config dist/server/wrangler.json
   ```
5. Optional custom domain on the Worker triggers tab.
6. Smoke `/world` + one Arena room create.

## Pages vs Workers

This app is **not** a static Pages site (RSC + optional D1). Prefer Workers. Keep any old Pages Coke Music tribute clearly named so it is never confused with FACEBACK.CAM.

## Hair / walk polish (2026-10-02)

- Tail/Bangs overlays re-extracted from cyan master sheets (`scripts/reextract-hair-overlays.py`) with Crop scalp underlay in compose.
- Walk art is still 2 poses (idle ↔ walk sheets). A 4-beat plant/push/mid/recover cycle is sold with timing/lean/bob/plant-shadow — not new sheet frames.

## Accessory polish (2026-10-02)

- Cap / Shades / Headphones overlays re-extracted from red master sheets (`scripts/reextract-accessory-overlays.py`) with head-band connected-component filters (no body leak / blob).
- Walk stride duty cycle slightly favors planted idle (`sin(phase) > 0.2`).
- Wardrobe cache-bust `?v=11`.

## Sit / shades polish (2026-10-02)

- Sofa/chair `sitLift` + sit foot clip so feet nestle on cushions (no under-sofa peek).
- Shades re-extract: thicken eye-band + lens/gloss remap so they read as glasses.
- Woman headphones sit nudged down slightly. Wardrobe cache-bust `?v=12`.

## Booth / bean / mixer polish (2026-10-02)

- Booth + bean (+ stool) sitLift/sitY retuned to match sofa/chair nestle; seat apron is per-furniture (booth burgundy, bean oval).
- Mixer: vinyl bed under mixes (ducks with kicks), clearer clip labels, BPM chips, live meters, **Burn disc** feedback.

## Walk cycle polish (2026-10-02)

- Confirmed walk/idle sheets are **4 directions × 1 pose** each (1280×308). Legacy `walk.png` 1024 grid is not a usable multi-frame cycle.
- `strideBeat(walkPhase)` → plant / push / mid / recover; sheets swap idle↔walk on that curve; facing lean + plant contact shadow fill the gaps.
- QA: `QA_BASE=http://127.0.0.1:5173/world node scripts/qa-walk-world.mjs`

## Mixer musicality polish (2026-10-02)

- Richer layered Web Audio patterns (pad beds, ghost rims, perc, octave doubles) with clearer kick / bass / lead separation.
- Vinyl duck from #13 kept; jukebox + stage (+ speakers/disco) pulse when a mix is playing.
- Last automatic polish before playtest pause — no further polish PRs until Will feedback.

