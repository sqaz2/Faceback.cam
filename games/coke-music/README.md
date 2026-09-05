# Coke Music (tribute)

Browser tribute to 2002 Coke Music / Coke Studios: isometric hangout, V-Egos, wardrobe, multi-seat sofas, Web Audio mixer.

Start with HANDOFF.md. Foundations changes are summarized in FOUNDATIONS.md.

## Setup

Art sprites are not committed under public/art/ (binary size). Unpack the repo-root coke-music-art.zip into this game folder so public/art is present (see scripts/extract-art.sh). Then install dependencies with the project package manager and start the Vite development server on port 8080.

Optional checks: TypeScript noEmit check, and scripts/qa-sit.mjs for sit QA screenshots.

Auth and database stay off. Save data uses localStorage key coke-music-v1.

## Layout

| Path | What |
| --- | --- |
| src/lib/game/ | World sim, canvas draw, catalog, audio |
| src/components/game/ | Splash, create V-Ego, room HUD, mixer |
| public/art/ | Avatar sheets + isometric furniture (after unpack) |
| attachments/ | User bug screenshots |
| screenshots/ | Latest Playwright QA |
