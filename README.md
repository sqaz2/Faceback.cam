# FACEBACK.CAM

**Creators And Machines, facing back at the anti-AI backlash.**

FACEBACK.CAM is a creator-home and live creativity platform for people who use AI in their work. Members can claim a public creator page, organize a cross-platform work inventory, and meet other creators in short creative competitions where the work is judged before the creator is revealed.

## Current release

- Public movement landing page
- Founding creator profile at `/@callmedaddy`
- Sign in with ChatGPT for founding-member access
- Persistent creator profiles backed by Cloudflare D1
- Automatic link previews for YouTube, Spotify, SoundCloud, Vimeo and Suno
- Public cross-platform work inventories
- Mobile-first creator studio
- Creative Arena at `/arena`
  - 5-character invite codes
  - Up to 8 signed-in creators per room
  - 3- or 5-round matches
  - Solo ladder or auto-balanced **Team Signal vs Team Static** competition
  - Automatic no-repeat mode rotation or host-picked games
  - Rap Battle, Punchline, Hook Lab, Creative Pitch, Caption Clash, Flip It or Random
  - Mode-specific prompt banks, entry limits and judging criteria
  - Anonymous creator/team identities during voting
  - Self-vote prevention and one vote per creator
  - Individual wins plus team points
  - Live round counter and match history
  - Final individual standings and team championship result
  - Same-room rematches with a new match number and preserved prior round history
  - Winner profile link for post-round examination
  - **School the Room** winner teach-back: aim → creative move → reusable principle
  - Tie-safe scoring and teach-backs

## Creative Arena match loop

1. Host chooses 3 or 5 rounds, solo or teams, and automatic or host-picked mode rotation.
2. Everyone gets the same creative constraint each round.
3. Creators submit without attribution; in team matches the team is hidden too.
4. The room votes using that mode's judging lenses.
5. The creator is revealed and the individual/team scoreboard updates.
6. The winner can explain what they were aiming for, the move they made, and the principle everyone else can reuse.
7. The next game starts until the configured round count is reached.
8. FACEBACK shows final standings and the host can call a rematch without creating a new room.

Automatic rotation walks through the six game modes without repeating one inside a five-round match. A rematch increments the room's match number, resets the live scoreboard, and retains old match rows rather than overwriting them.

This keeps FACEBACK centered on creative literacy rather than merely arguing about whether a tool is legitimate. Winning is social proof, but the teach-back converts the winning decision into something the opposing creators or team can actually learn from.

## Arena transport

The first multiplayer release intentionally uses Cloudflare D1 plus lightweight client polling. Creative rounds do not require frame-level synchronization, so this keeps the room model simple and deployable without another API key. The transport can later move to Durable Objects/WebSockets while preserving the same room, match, round, submission, vote and teach-back model.

## Development

```bash
npm ci
npm run dev
```

Production validation:

```bash
npm run build
npm run lint
```

Creator database schema lives in `db/schema.ts`; migrations live in `drizzle/`. The Creative Arena uses additive migrations:

- `0001_creative_arena.sql` — rooms, players, rounds, submissions and votes
- `0002_arena_teachbacks.sql` — winner breakdowns
- `0003_arena_matches.sql` — match settings, match numbering, team assignments and team scoring

Arena runtime queries are currently raw D1 queries in its API route.
