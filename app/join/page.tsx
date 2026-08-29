import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Link2, Palette, Rows3 } from "lucide-react";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Become a founding creator",
  description: "Claim your FACEBACK.CAM creator page and bring your work together.",
};

export default async function JoinPage() {
  const user = await getChatGPTUser();
  const nextHref = user ? "/studio" : chatGPTSignInPath("/studio");

  return (
    <main className="join-page">
      <header className="profile-nav">
        <Link className="wordmark" href="/">
          FACEBACK<span>.CAM</span>
        </Link>
        <Link className="back-link" href="/">
          <ArrowLeft size={17} /> Back home
        </Link>
      </header>

      <section className="join-hero">
        <div className="join-copy">
          <p className="eyebrow">Founding creator access</p>
          <h1>Claim a home for everything you make.</h1>
          <p>
            Stop rebuilding your identity on every platform. Paste your links,
            organize the work, and share one FACEBACK page that belongs to you.
          </p>
          <a className="button button-primary" href={nextHref} target="_top">
            {user ? "Open my creator studio" : "Claim my creator page"}
            <ArrowRight size={18} />
          </a>
          <small>
            {user
              ? `Signed in as ${user.displayName}`
              : "Founding access uses your ChatGPT sign-in. Your public page remains viewable by everyone."}
          </small>
        </div>

        <div className="join-steps">
          <article>
            <span>01</span>
            <Link2 size={24} />
            <h2>Paste your work</h2>
            <p>Add music, video, art, writing, games and websites from anywhere.</p>
          </article>
          <article>
            <span>02</span>
            <Rows3 size={24} />
            <h2>Build the inventory</h2>
            <p>Group related versions and add the human story behind the work.</p>
          </article>
          <article>
            <span>03</span>
            <Palette size={24} />
            <h2>Make it yours</h2>
            <p>Choose your page identity, feature your best work and publish.</p>
          </article>
        </div>
      </section>

      <section className="founding-list">
        <div>
          <p className="eyebrow">Included free</p>
          <h2>Founding creators get the useful part first.</h2>
        </div>
        <ul>
          {[
            "A public FACEBACK creator address",
            "A cross-platform creative inventory",
            "Featured work and custom collections",
            "A personal Why I Face Back story",
            "Founding creator status",
          ].map((item) => (
            <li key={item}><Check size={18} /> {item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
