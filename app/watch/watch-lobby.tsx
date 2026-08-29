"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Eye, Radio } from "lucide-react";

export function WatchLobby() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function watch() {
    const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    if (normalized.length !== 5) {
      setError("Enter the 5-character room code.");
      return;
    }
    router.push(`/watch/${normalized}`);
  }

  return (
    <main className="spectator-shell">
      <header className="arena-topbar">
        <Link className="wordmark" href="/">FACEBACK<span>.CAM</span></Link>
        <Link className="back-link" href="/arena">Creator Arena</Link>
      </header>
      <section className="watch-lobby">
        <p className="eyebrow"><Eye size={16} /> PUBLIC SPECTATOR MODE</p>
        <h1>Watch the work before you know who made it.</h1>
        <p>Enter a live room code. Spectators can see the prompt, clocks and anonymous voting stage, but cannot submit or vote.</p>
        <div className="watch-code-entry">
          <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={5} placeholder="ABCDE" aria-label="Live room code" />
          <button className="button button-primary" onClick={watch}>Watch live <ArrowRight size={18} /></button>
        </div>
        {error && <p className="arena-error">{error}</p>}
        <div className="watch-rules">
          <article><Radio size={18} /><strong>Creation stays hidden</strong><span>You see the prompt and locked-entry count.</span></article>
          <article><Eye size={18} /><strong>Voting is anonymous</strong><span>Entries appear without creator attribution.</span></article>
          <article><ArrowRight size={18} /><strong>Reveal teaches</strong><span>Winner, profile and teach-back appear after the vote.</span></article>
        </div>
      </section>
    </main>
  );
}
