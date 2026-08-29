# FACEBACK.CAM

**Creators And Machines, facing back at the anti-AI backlash.**

FACEBACK.CAM is a creator-home and live creativity platform for people who use AI in their work. Members can claim a public creator page, organize a cross-platform work inventory, compete in short creative matches, and let spectators watch the work before creator identity is revealed.

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
  - Server-controlled timer presets: **Quick Fire 45/20**, **Standard 75/30**, **Give It Room 120/45**
  - Automatic timer phase advancement once minimum viable submissions/votes exist
  - Overtime rather than killing a round when there are not yet enough entries/votes
  - Anonymous creator/team identities during voting
  - Self-vote prevention and one vote per creator
  - Individual wins plus team points
  - Live round counter and match history
  - Final individual standings and team championship result
  - Same-room rematches with a new match number and preserved prior round history
  - Winner profile link for post-round examination
  - **School the Room** winner teach-back: aim → creative move → reusable principle
  - Tie-safe scoring and teach-backs
- Public spectator mode at `/watch`
  - Enter a room code without signing in
  - Creation phase exposes prompt, timer and entry count but not the entries
  - Voting phase exposes anonymous entries but no creator attribution
  - Reveal phase exposes author/profile/team, votes and teach-back
  - Spectators are read-only and cannot submit or vote
- Creator profiles include revealed Arena history
  - recent Arena entries
  - round wins and vote counts
  - match/round/mode context
  - reusable **Steal this** lessons from winner teach-backs

## Creative Arena match loop

1. Host chooses 3 or 5 rounds, solo or teams, automatic or host-picked mode rotation, and a timer pace.
2. Everyone gets the same creative constraint each round.
3. Creators submit without attribution; in team matches the team is hidden too.
4. When the create clock expires, FACEBACK opens voting automatically once at least two entries exist; otherwise the room goes into overtime.
5. The room votes using that mode's judging lenses. When the voting clock expires, FACEBACK reveals automatically once at least one creator vote exists.
6. The creator is revealed and the individual/team scoreboard updates.
7. The winner can explain what they were aiming for, the move they made, and the principle everyone else can reuse.
8. The next game starts until the configured round count is reached.
9. FACEBACK shows final standings and the host can call a rematch without creating a new room.

Automatic rotation walks through the six game modes without repeating one inside a five-round match. A rematch increments the room's match number, resets the live scoreboard, and retains old match rows rather than overwriting them.

This keeps FACEBACK centered on creative literacy rather than merely arguing about whether a tool is legitimate. Winning is social proof, but the teach-back converts the winning decision into something the opposing creators, team and spectators can actually learn from.

## Public spectator boundary

Creator rooms remain writable only through the authenticated Arena API. `/watch/[code]` is a separate read-only endpoint and page. It intentionally preserves the blind structure:

- **Create:** no submitted content is public yet.
- **Vote:** submitted content is visible, creator/team attribution is not.
- **Reveal:** author, public profile handle, team, vote count and teach-back become visible.

No account email is returned by the spectator API or creator Arena-history query.

## Arena transport

The first multiplayer release intentionally uses Cloudflare D1 plus lightweight client polling. Creative rounds do not require frame-level synchronization, so this keeps the room model simple and deployable without another API key. The transport can later move to Durable Objects/WebSockets while preserving the same room, match, round, deadline, submission, vote and teach-back model.

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

The repository also includes `.github/workflows/ci.yml`, which runs dependency install, TypeScript checking and lint on the Arena branch/PR.

Creator database schema lives in `db/schema.ts`; migrations live in `drizzle/`. The Creative Arena uses additive migrations:

- `0001_creative_arena.sql` — rooms, players, rounds, submissions and votes
- `0002_arena_teachbacks.sql` — winner breakdowns
- `0003_arena_matches.sql` — match settings, match numbering, team assignments and team scoring
- `0004_arena_live_public.sql` — server timers/deadlines plus indexes supporting public Arena history

Arena runtime queries are currently raw D1 queries in its API routes.
