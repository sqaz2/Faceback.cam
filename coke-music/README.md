# Coke Music (tribute)

Browser tribute to 2002 Coke Music / Coke Studios: isometric hangout, V-Egos, wardrobe, multi-seat sofas, Web Audio mixer.

**If you are an AI (or a human picking this up cold), start with [HANDOFF.md](./HANDOFF.md).** It is the full brief: user preferences, brand rules, sitting math, the white-blob bug, and how to QA.

## Run

```bash
npm install
npm run dev
```

Dev server: `0.0.0.0:8080`. `startup.sh` starts it if it is down.

```bash
npm run typecheck
node scripts/qa-sit.mjs   # screenshots in ./screenshots
```

Auth and database are **off**. Save data is `localStorage` key `coke-music-v1`.

## Layout

| Path | What |
| --- | --- |
| `src/lib/game/` | World sim, canvas draw, catalog, audio |
| `src/components/game/` | Splash, create V-Ego, room HUD, mixer |
| `public/art/` | Avatar sheets + isometric furniture |
| `attachments/` | User bug screenshots (armrest sit, white blob) |
| `screenshots/` | Latest Playwright QA |
