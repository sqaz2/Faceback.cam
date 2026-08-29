# FACEBACK.CAM

**Creators And Machines, facing back at the anti-AI backlash.**

FACEBACK.CAM is a creator-home and live creativity platform for people who use AI in their work. Members can claim a public creator page, organize a cross-platform work inventory, and meet other creators in short prompt-and-vote rounds where the work is judged before the creator is revealed.

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
  - Host-selectable game modes: Rap Battle, Punchline, Hook Lab, Creative Pitch, Caption Clash, Flip It or Random
  - Mode-specific prompt banks, entry limits and judging criteria
  - Anonymous submissions during voting
  - Self-vote prevention and one vote per creator
  - Room scoring and winner reveal
  - Winner profile link for post-round examination
  - **School the Room** winner teach-back: aim → creative move → reusable principle
  - Tie-safe teach-backs: every tied winner can explain their own move

## Creative Arena loop

1. Host chooses a game mode.
2. Everyone gets the same creative constraint.
3. Creators submit without attribution.
4. The room votes using that mode's judging lenses.
5. The winner is revealed.
6. The winner can explain what they were aiming for, the move they made, and the principle everyone else can reuse.
7. The host chooses the next game.

This keeps FACEBACK centered on creative literacy rather than merely arguing about whether a tool is legitimate. The winning work becomes evidence, and the post-round breakdown turns that evidence into something teachable.

## Arena transport

The first multiplayer release intentionally uses Cloudflare D1 plus lightweight client polling. Creative rounds do not require frame-level synchronization, so this keeps the room model simple and deployable without another API key. The transport can later move to Durable Objects/WebSockets while preserving the same room, round, submission, vote and teach-back model.

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

Creator database schema lives in `db/schema.ts`; migrations live in `drizzle/`. The Creative Arena currently uses additive migrations `0001_creative_arena.sql` and `0002_arena_teachbacks.sql` plus raw D1 queries in its API route.
