import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Layers3, Link2, Play, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { getPublicProfile } from "../../db/profile-queries";
import { featuredWork } from "../content";

export const dynamic = "force-dynamic";

type CreatorPageProps = {
  params: Promise<{ handle: string }>;
};

type DisplayWork = {
  id: string | number;
  title: string;
  type: string;
  note: string;
  description: string;
  href: string;
  action: string;
  imageUrl: string;
};

type DisplayProfile = {
  handle: string;
  displayName: string;
  brand: string;
  bio: string;
  story: string;
  location: string;
  websiteUrl: string;
  accent: string;
  founding: boolean;
  works: DisplayWork[];
};

export async function generateMetadata({ params }: CreatorPageProps): Promise<Metadata> {
  const { handle } = await params;
  const creator = await resolveCreator(handle);
  if (!creator) return {};
  return {
    title: `${creator.displayName} — Creator page`,
    description: creator.bio || `Explore ${creator.displayName}'s creative inventory on FACEBACK.CAM.`,
  };
}

export default async function CreatorPage({ params }: CreatorPageProps) {
  const { handle } = await params;
  const creator = await resolveCreator(handle);
  if (!creator) notFound();
  const categories = [...new Set(creator.works.map((work) => work.type.split("·")[0].trim()))].slice(0, 5);

  return (
    <main className={`profile-shell profile-accent-${creator.accent}`}>
      <header className="profile-nav">
        <Link className="wordmark" href="/">
          FACEBACK<span>.CAM</span>
        </Link>
        <Link className="back-link" href="/">
          <ArrowLeft size={17} /> Movement home
        </Link>
      </header>

      <section className="profile-hero">
        <div className="profile-signal">
          <span>{creator.founding ? "FOUNDING CREATOR" : "FACEBACK CREATOR"}</span>
          <span>{creator.location || "CREATORS AND MACHINES"}</span>
        </div>
        <div className="profile-identity">
          <div className="profile-avatar">{initials(creator.displayName)}</div>
          <div>
            <p className="profile-handle">@{creator.handle}</p>
            <h1>{creator.displayName}</h1>
            {creator.brand && <p className="profile-brand">{creator.brand}</p>}
          </div>
        </div>
        <p className="profile-bio">
          {creator.bio || "A creator bringing every medium and experiment together in one place."}
        </p>
        {categories.length > 0 && (
          <div className="profile-tags">
            {categories.map((category) => <span key={category}>{category}</span>)}
          </div>
        )}
        {creator.websiteUrl && (
          <a className="button button-primary" href={creator.websiteUrl} target="_blank" rel="noreferrer">
            Visit main site <ArrowUpRight size={18} />
          </a>
        )}
      </section>

      {creator.story && (
        <section className="profile-story">
          <div className="story-label">
            <Sparkles size={20} />
            <span>WHY I FACE BACK</span>
          </div>
          <blockquote>“{creator.story}”</blockquote>
          <p>
            This is the creator&apos;s account of what the tools made possible and
            why their human decisions still belong in the story.
          </p>
        </section>
      )}

      <section className={`inventory-section ${creator.story ? "" : "inventory-no-story"}`}>
        <div className="inventory-heading">
          <div>
            <p className="eyebrow">Creative inventory</p>
            <h2>Selected work</h2>
          </div>
          <span><Layers3 size={17} /> {creator.works.length} {creator.works.length === 1 ? "work" : "works"}</span>
        </div>
        {creator.works.length > 0 ? (
          <div className="inventory-list">
            {creator.works.map((work, index) => (
              <article className="inventory-card" key={work.id}>
                <div
                  className={`inventory-art inventory-art-${(index % 3) + 1} ${work.imageUrl ? "inventory-art-image" : ""}`}
                  style={work.imageUrl ? { backgroundImage: `linear-gradient(180deg, transparent, rgba(0,0,0,.52)), url(${work.imageUrl})` } : undefined}
                >
                  <span>0{index + 1}</span>
                  <Play size={24} fill="currentColor" />
                </div>
                <div className="inventory-copy">
                  <div className="inventory-meta">
                    <span>{work.type}</span>
                    <span>{work.note}</span>
                  </div>
                  <h3>{work.title}</h3>
                  {work.description && <p>{work.description}</p>}
                  <a href={work.href} target="_blank" rel="noreferrer">
                    {work.action} <ArrowUpRight size={16} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="public-empty-work">
            <Link2 size={26} />
            <strong>The page is claimed. The inventory is next.</strong>
          </div>
        )}
      </section>

      <section className="profile-cta">
        <p>Make things with machines?</p>
        <h2>Build your own creator home.</h2>
        <Link className="button button-light" href="/join">
          Become a founding creator <ArrowUpRight size={18} />
        </Link>
      </section>
    </main>
  );
}

async function resolveCreator(rawHandle: string): Promise<DisplayProfile | null> {
  const handle = decodeURIComponent(rawHandle).toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(handle)) return null;

  let stored = null;
  try {
    stored = await getPublicProfile(handle);
  } catch {
    stored = null;
  }

  if (stored) {
    const storedWorks: DisplayWork[] = stored.works.map((work) => ({
      id: work.id,
      title: work.title,
      type: `${work.category.toUpperCase()} · ${work.provider.toUpperCase()}`,
      note: work.note,
      description: work.description,
      href: work.url,
      action: `Open on ${work.provider}`,
      imageUrl: work.imageUrl,
    }));
    return {
      handle: stored.handle,
      displayName: stored.displayName,
      brand: stored.brand,
      bio: stored.bio,
      story: stored.story,
      location: stored.location,
      websiteUrl: stored.websiteUrl,
      accent: stored.accent,
      founding: handle === "callmedaddy",
      works:
        handle === "callmedaddy" && storedWorks.length === 0
          ? foundingWorks()
          : storedWorks,
    };
  }

  if (handle !== "callmedaddy") return null;
  return {
    handle: "callmedaddy",
    displayName: "Call Me Daddy",
    brand: "MusicSubject",
    bio:
      "Music, satire, games and experiments built across years of human ideas and newer machine-assisted workflows. AI didn't start the creativity. It gave more of it somewhere to go.",
    story:
      "AI lets me nearly instantly get an idea out of my head. It also lets me revisit music I wrote long before AI was in the mix.",
    location: "RED DEER · CANADA",
    websiteUrl: "https://callmedaddy.musicsubject.com",
    accent: "signal",
    founding: true,
    works: foundingWorks(),
  };
}

function foundingWorks(): DisplayWork[] {
  return featuredWork.map((work, index) => ({
    id: `founding-${index}`,
    title: work.title,
    type: work.type,
    note: work.note,
    description: work.description,
    href: work.href,
    action: work.action,
    imageUrl: "",
  }));
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "FB";
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts.at(-1)?.[0] ?? "" : parts[0]?.[1] ?? ""}`.toUpperCase();
}
