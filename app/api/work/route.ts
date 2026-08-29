import {
  cleanText,
  db,
  getOwnedProfile,
  requireApiUser,
  validPublicUrl,
} from "../_shared";

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const profile = await getOwnedProfile(user.email);
    if (!profile) {
      return Response.json({ error: "Save your creator profile first." }, { status: 400 });
    }

    const count = await db()
      .prepare("SELECT COUNT(*) AS total FROM works WHERE profile_id = ?")
      .bind(profile.id)
      .first<{ total: number }>();
    if ((count?.total ?? 0) >= 100) {
      return Response.json({ error: "Founding profiles currently support 100 works." }, { status: 400 });
    }

    const payload = (await request.json()) as Record<string, unknown>;
    const title = cleanText(payload.title, 140);
    const url = cleanText(payload.url, 1000);
    const provider = cleanText(payload.provider, 40) || "Website";
    const category = cleanText(payload.category, 40) || "Project";
    const note = cleanText(payload.note, 140);
    const description = cleanText(payload.description, 600);
    const imageUrl = cleanText(payload.imageUrl, 1000);

    if (!title) return Response.json({ error: "Give this work a title." }, { status: 400 });
    if (!validPublicUrl(url)) return Response.json({ error: "Paste a valid public link." }, { status: 400 });
    if (imageUrl && !validPublicUrl(imageUrl)) {
      return Response.json({ error: "Preview image must be a public URL." }, { status: 400 });
    }

    const sort = await db()
      .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM works WHERE profile_id = ?")
      .bind(profile.id)
      .first<{ nextOrder: number }>();

    const inserted = await db()
      .prepare(
        `INSERT INTO works
          (profile_id, title, url, provider, category, note, description, image_url, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id, title, url, provider, category, note, description,
           image_url AS imageUrl, sort_order AS sortOrder`,
      )
      .bind(
        profile.id,
        title,
        url,
        provider,
        category,
        note,
        description,
        imageUrl,
        sort?.nextOrder ?? 0,
      )
      .first();

    return Response.json({ work: inserted }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to add work" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const profile = await getOwnedProfile(user.email);
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });
    const payload = (await request.json()) as { id?: number };
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) {
      return Response.json({ error: "Invalid work" }, { status: 400 });
    }

    await db()
      .prepare("DELETE FROM works WHERE id = ? AND profile_id = ?")
      .bind(id, profile.id)
      .run();
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to remove work" },
      { status: 500 },
    );
  }
}
