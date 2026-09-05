"use client";

import Link from "next/link";
import { Clock3, Headphones, ListMusic, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CokeMusicApp } from "@/components/coke-game/app";

type QueueTrack = {
  id: string;
  artist: string;
  title: string;
  url: string;
};

const STARTER_QUEUE: QueueTrack[] = [
  { id: "one", artist: "Call Me Daddy", title: "Twas the Tism m’Lord", url: "https://suno.com/" },
  { id: "two", artist: "MusicSubject", title: "What Is My Opponent Threatening?", url: "https://suno.com/" },
];

function isSunoLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "suno.com" || url.hostname.endsWith(".suno.com"));
  } catch {
    return false;
  }
}

export function CokeMusicPlace() {
  const [queueOpen, setQueueOpen] = useState(false);
  const [queue, setQueue] = useState<QueueTrack[]>(STARTER_QUEUE);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const nowPlaying = queue[0];
  const secondsLeft = Math.max(0, 90 - elapsed);

  useEffect(() => {
    if (!nowPlaying) return;
    const timer = window.setInterval(() => {
      setElapsed((current) => {
        if (current < 89) return current + 1;
        setQueue((items) => items.slice(1));
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [nowPlaying]);

  const progress = useMemo(() => `${Math.min(100, (elapsed / 90) * 100)}%`, [elapsed]);

  function addTrack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const url = String(form.get("url") || "").trim();
    const title = String(form.get("title") || "").trim();
    const artist = String(form.get("artist") || "").trim();
    if (!isSunoLink(url)) {
      setError("Only verified suno.com links can enter this room.");
      return;
    }
    setQueue((items) => [...items, { id: crypto.randomUUID(), url, title: title || "Untitled", artist: artist || "Guest artist" }]);
    setError("");
    event.currentTarget.reset();
  }

  return (
    <main className="coke-place-shell">
      <div className="coke-place-bar">
        <Link href="/" className="coke-place-brand">FACEBACK<span>.CAM</span></Link>
        <div className="coke-place-room"><span /> RED ROOM · {queue.length + 3} HERE</div>
        <button type="button" onClick={() => setQueueOpen(true)}>
          <ListMusic size={18} /> Queue {queue.length > 0 && <b>{queue.length}</b>}
        </button>
      </div>

      <div className="coke-place-game"><CokeMusicApp /></div>

      {nowPlaying && (
        <button className="coke-now-playing" type="button" onClick={() => setQueueOpen(true)}>
          <Headphones size={18} />
          <span><small>ROOM SPOTLIGHT</small><strong>{nowPlaying.title}</strong><em>{nowPlaying.artist}</em></span>
          <span className="coke-time"><Clock3 size={14} /> {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</span>
          <i style={{ width: progress }} />
        </button>
      )}

      {queueOpen && (
        <div className="coke-queue-layer" role="dialog" aria-modal="true" aria-label="Room music queue">
          <button className="coke-queue-backdrop" aria-label="Close queue" onClick={() => setQueueOpen(false)} />
          <section className="coke-queue-sheet">
            <header><div><small>RED ROOM</small><h1>Music line-up</h1></div><button aria-label="Close queue" onClick={() => setQueueOpen(false)}><X /></button></header>
            <p className="coke-queue-note">Each artist gets 90 seconds. The room fades one track into the next so everyone hears the same spotlight.</p>
            <ol>
              {queue.map((track, index) => (
                <li key={track.id} className={index === 0 ? "is-playing" : ""}>
                  <span>{index === 0 ? "LIVE" : index + 1}</span>
                  <div><strong>{track.title}</strong><small>{track.artist}</small></div>
                  <em>{index === 0 ? `${secondsLeft}s` : `~${index * 2} min`}</em>
                </li>
              ))}
            </ol>
            <form onSubmit={addTrack}>
              <h2>Get in line</h2>
              <div className="coke-form-row"><input name="artist" placeholder="Artist name" maxLength={40} /><input name="title" placeholder="Song title" maxLength={60} /></div>
              <input name="url" inputMode="url" placeholder="https://suno.com/song…" aria-describedby="suno-rule" />
              <small id="suno-rule">Suno links only for now. Other links are rejected before joining the queue.</small>
              {error && <p className="coke-form-error" role="alert">{error}</p>}
              <button type="submit">Join the line</button>
            </form>
            {nowPlaying && <aside><small>BACK THE NEXT MOVE</small><strong>Help {nowPlaying.artist} finish the release.</strong><p>Fund the master · book a local set · press merch · visit the artist</p><button type="button">See this artist’s next moves</button></aside>}
          </section>
        </div>
      )}
    </main>
  );
}
