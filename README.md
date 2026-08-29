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
  - Rapid prompts for bars, hooks, punchlines, concepts and remixes
  - Anonymous submissions during voting
  - Room scoring and winner reveal
  - Winner profile link for post-round examination

## Arena transport

The first multiplayer release intentionally uses Cloudflare D1 plus lightweight client polling. Creative rounds do not require frame-level synchronization, so this keeps the room model simple and deployable without another API key. The transport can later move to Durable Objects/WebSockets while preserving the same room, round, submission and vote model.

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

Creator database schema lives in `db/schema.ts`; migrations live in `drizzle/`. The Creative Arena currently uses the additive `drizzle/0001_creative_arena.sql` migration and raw D1 queries in its API route.
