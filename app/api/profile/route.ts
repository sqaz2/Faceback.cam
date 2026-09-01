import {
  cleanText,
  db,
  getOwnedProfile,
  getOwnedWorks,
  normalizeHandle,
  requireApiUser,
  validHandle,
  validPublicUrl,
} from "../_shared";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const profile = await getOwnedProfile(user.email);
    if (!profile) return Response.json({ profile: null, works: [] });
    const works = await getOwnedWorks(profile.id);
    return Response.json({ profile, works: works.results });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load profile" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const handle = normalizeHandle(payload.handle);
    const displayName = cleanText(payload.displayName, 70) || user.displayName.slice(0, 70);
    const brand = cleanText(payload.brand, 80);
    const bio = cleanText(payload.bio, 420);
    const story = cleanText(payload.story, 1400);
    const location = cleanText(payload.location, 80);
    const websiteUrl = cleanText(payload.websiteUrl, 500);
    const accent = ["signal", "acid", "violet"].includes(String(payload.accent))
      ? String(payload.accent)
      : "signal";

    if (!validHandle(handle)) {
      return Response.json(
        { error: "Use 3–30 lowercase letters, numbers or hyphens for your handle." },
        { status: 400 },
      );
    }
    if (websiteUrl && !validPublicUrl(websiteUrl)) {
      return Response.json({ error: "Website must be a valid public URL." }, { status: 400 });
    }

    const collision = await db()
      .prepare("SELECT id FROM profiles WHERE handle = ? AND user_email <> ? LIMIT 1")
      .bind(handle, user.email)
      .first();
    if (collision) {
      return Response.json({ error: "That handle has already been claimed." }, { status: 409 });
    }

    const existing = await getOwnedProfile(user.email);
    if (existing) {
      await db()
        .prepare(
          `UPDATE profiles
           SET handle = ?, display_name = ?, brand = ?, bio = ?, story = ?,
             location = ?, website_url = ?, accent = ?, updated_at = CURRENT_TIMESTAMP
           WHERE user_email = ?`,
        )
        .bind(handle, displayName, brand, bio, story, location, websiteUrl, accent, user.email)
        .run();
    } else {
      await db()
        .prepare(
          `INSERT INTO profiles
            (user_email, handle, display_name, brand, bio, story, location, website_url, accent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(user.email, handle, displayName, brand, bio, story, location, websiteUrl, accent)
        .run();
    }

    const profile = await getOwnedProfile(user.email);
    if (profile) {
      await db()
        .prepare(
          `UPDATE arena_players
           SET profile_id = ?, display_name = ?, profile_handle = ?
           WHERE user_email = ?`,
        )
        .bind(profile.id, profile.displayName, profile.handle, user.email)
        .run();
    }
    return Response.json({ profile });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to save profile" },
      { status: 500 },
    );
  }
}
