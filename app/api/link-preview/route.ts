import { cleanText, requireApiUser, validPublicUrl } from "../_shared";

type Preview = {
  title: string;
  provider: string;
  category: string;
  imageUrl: string;
  description: string;
};

const PROVIDERS = [
  { hosts: ["youtube.com", "www.youtube.com", "youtu.be"], name: "YouTube", category: "Video" },
  { hosts: ["open.spotify.com"], name: "Spotify", category: "Music" },
  { hosts: ["soundcloud.com", "www.soundcloud.com"], name: "SoundCloud", category: "Music" },
  { hosts: ["suno.com", "www.suno.com"], name: "Suno", category: "Music" },
  { hosts: ["bandcamp.com"], suffix: true, name: "Bandcamp", category: "Music" },
  { hosts: ["vimeo.com", "www.vimeo.com"], name: "Vimeo", category: "Video" },
  { hosts: ["tiktok.com", "www.tiktok.com"], name: "TikTok", category: "Video" },
  { hosts: ["instagram.com", "www.instagram.com"], name: "Instagram", category: "Visual" },
  { hosts: ["github.com", "www.github.com"], name: "GitHub", category: "Game / Web" },
  { hosts: ["itch.io"], suffix: true, name: "itch.io", category: "Game / Web" },
];

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const payload = (await request.json()) as { url?: unknown };
    const rawUrl = cleanText(payload.url, 1000);
    if (!validPublicUrl(rawUrl)) {
      return Response.json({ error: "Paste a valid public link." }, { status: 400 });
    }

    const url = new URL(rawUrl);
    const match = PROVIDERS.find((provider) =>
      provider.suffix
        ? provider.hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
        : provider.hosts.includes(url.hostname),
    );
    const fallback: Preview = {
      title: humanizePath(url),
      provider: match?.name ?? humanizeHost(url.hostname),
      category: match?.category ?? "Project",
      imageUrl: "",
      description: "",
    };

    if (!match) return Response.json({ preview: fallback });

    const preview = await fetchKnownPreview(rawUrl, match.name, fallback);
    return Response.json({ preview });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to read that link" },
      { status: 500 },
    );
  }
}

async function fetchKnownPreview(url: string, provider: string, fallback: Preview): Promise<Preview> {
  try {
    let endpoint = "";
    if (provider === "YouTube") endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    if (provider === "Spotify") endpoint = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    if (provider === "SoundCloud") endpoint = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`;
    if (provider === "Vimeo") endpoint = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;

    if (endpoint) {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(4500) });
      if (!response.ok) return fallback;
      const data = (await response.json()) as Record<string, unknown>;
      return {
        ...fallback,
        title: cleanText(data.title, 140) || fallback.title,
        imageUrl: cleanText(data.thumbnail_url, 1000),
        description: cleanText(data.author_name, 180),
      };
    }

    if (provider === "Suno") {
      const response = await fetch(url, {
        headers: { "user-agent": "FACEBACK.CAM link preview" },
        signal: AbortSignal.timeout(4500),
      });
      if (!response.ok) return fallback;
      const html = (await response.text()).slice(0, 300_000);
      return {
        ...fallback,
        title: meta(html, "og:title") || fallback.title,
        imageUrl: meta(html, "og:image"),
        description: meta(html, "og:description"),
      };
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function meta(html: string, property: string) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const value = html.match(pattern)?.[1];
    if (value) return decodeEntities(value).slice(0, property === "og:image" ? 1000 : 600);
  }
  return "";
}

function decodeEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function humanizeHost(host: string) {
  return host.replace(/^www\./, "").split(".")[0].replace(/[-_]/g, " ");
}

function humanizePath(url: URL) {
  const last = url.pathname.split("/").filter(Boolean).at(-1) ?? humanizeHost(url.hostname);
  return decodeURIComponent(last).replace(/[-_]/g, " ").slice(0, 140) || humanizeHost(url.hostname);
}
