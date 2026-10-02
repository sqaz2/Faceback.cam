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
- Walk uses a 2-pose stride (idle ↔ walk sheets) + stronger bob/sway — not a full multi-frame cycle.
