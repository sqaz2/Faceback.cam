# FACEBACK.CAM

**Creators And Machines, facing back at the anti-AI backlash.**

FACEBACK.CAM is a creator-home platform for people who use AI in their work. Members can claim a public creator page, paste media and project links, organize a cross-platform work inventory, and optionally explain the human story behind the work.

## Current release

- Public movement landing page
- Founding creator profile at `/@callmedaddy`
- Sign in with ChatGPT for founding-member access
- Persistent creator profiles backed by Cloudflare D1
- Automatic link previews for YouTube, Spotify, SoundCloud, Vimeo and Suno
- Public cross-platform work inventories
- Mobile-first creator studio

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

Database schema lives in `db/schema.ts`; generated migrations live in `drizzle/`.
