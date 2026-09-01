import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Camera, Radio, Sparkles, Users } from "lucide-react";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import PlayLobbyClient from "./play-lobby-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quickfire rooms",
  description: "Create or join a live FACEBACK creative room.",
};

export default async function PlayPage() {
  const user = await getChatGPTUser();

  return (
    <main className="play-shell">
      <header className="profile-nav play-nav">
        <Link className="wordmark" href="/">
          FACEBACK<span>.CAM</span>
        </Link>
        <Link className="back-link" href="/">
          <ArrowLeft size={17} /> Back home
        </Link>
      </header>

      <section className="play-entry">
        <div className="play-entry-copy">
          <p className="eyebrow"><span className="record-dot" /> FACEBACK QUICKFIRE</p>
          <h1>Get the creators in the same room.</h1>
          <p>
            Start a live room, send the six-character code, and watch everyone
            arrive and ready up in real time.
          </p>
          <div className="play-format-line">
            <span><Users size={17} /> 2–6 creators</span>
            <span><Radio size={17} /> Shared live state</span>
            <span><Camera size={17} /> Built for performance</span>
          </div>
        </div>

        {user ? (
          <PlayLobbyClient displayName={user.displayName} />
        ) : (
          <div className="play-gate">
            <span className="play-panel-number">ROOM ACCESS</span>
            <Sparkles size={30} />
            <h2>Sign in to take a seat.</h2>
            <p>Your sign-in keeps room seats, readiness and later votes attached to one creator.</p>
            <a className="button button-primary" href={chatGPTSignInPath("/play")} target="_top">
              Sign in with ChatGPT
            </a>
          </div>
        )}
      </section>

      <section className="play-coming">
        <span>CONNECTION LAYER 01</span>
        <p>
          Rooms are the stage. Quickfire prompts, blind performances, voting and
          the winner&apos;s Under the Lens reveal attach to this shared room next.
        </p>
      </section>
    </main>
  );
}
