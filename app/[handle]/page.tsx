import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Layers3, Play, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { featuredWork } from "../content";

type CreatorPageProps = {
  params: Promise<{ handle: string }>;
};

export async function generateMetadata({ params }: CreatorPageProps): Promise<Metadata> {
  const { handle } = await params;
  if (decodeURIComponent(handle).toLowerCase() !== "@callmedaddy") return {};
  return {
    title: "Call Me Daddy — Creator page",
    description:
      "Music, satire, games and experiments from FACEBACK.CAM founding creator Call Me Daddy.",
  };
}

export default async function CreatorPage({ params }: CreatorPageProps) {
  const { handle } = await params;
  if (decodeURIComponent(handle).toLowerCase() !== "@callmedaddy") notFound();

  return (
    <main className="profile-shell">
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
          <span>FOUNDING CREATOR</span>
          <span>RED DEER · CANADA</span>
        </div>
        <div className="profile-identity">
          <div className="profile-avatar">WC</div>
          <div>
            <p className="profile-handle">@callmedaddy</p>
            <h1>Call Me Daddy</h1>
            <p className="profile-brand">MusicSubject</p>
          </div>
        </div>
        <p className="profile-bio">
          Music, satire, games and experiments built across years of human ideas
          and newer machine-assisted workflows. AI didn&apos;t start the creativity.
          It gave more of it somewhere to go.
        </p>
        <div className="profile-tags">
          <span>Music</span>
          <span>Writing</span>
          <span>Games</span>
          <span>AI-assisted</span>
        </div>
        <a className="button button-primary" href="https://callmedaddy.musicsubject.com">
          Visit main music site <ArrowUpRight size={18} />
        </a>
      </section>

      <section className="profile-story">
        <div className="story-label">
          <Sparkles size={20} />
          <span>WHY I FACE BACK</span>
        </div>
        <blockquote>
          “AI lets me nearly instantly get an idea out of my head. It also lets
          me revisit music I wrote long before AI was in the mix.”
        </blockquote>
        <p>
          The work below is not one prompt pretending to be a lifetime. It
          connects older writing and rehearsals with new versions, new tools and
          new decisions.
        </p>
      </section>

      <section className="inventory-section">
        <div className="inventory-heading">
          <div>
            <p className="eyebrow">Creative inventory</p>
            <h2>Selected work</h2>
          </div>
          <span><Layers3 size={17} /> {featuredWork.length} works</span>
        </div>
        <div className="inventory-list">
          {featuredWork.map((work, index) => (
            <article className="inventory-card" key={work.title}>
              <div className={`inventory-art inventory-art-${(index % 3) + 1}`}>
                <span>0{index + 1}</span>
                <Play size={24} fill="currentColor" />
              </div>
              <div className="inventory-copy">
                <div className="inventory-meta">
                  <span>{work.type}</span>
                  <span>{work.note}</span>
                </div>
                <h3>{work.title}</h3>
                <p>{work.description}</p>
                <a href={work.href}>
                  {work.action} <ArrowUpRight size={16} />
                </a>
              </div>
            </article>
          ))}
        </div>
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
