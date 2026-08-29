"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Crown, Radio, Sparkles, Users } from "lucide-react";

type ArenaState = {
  room: { code: string; phase: "lobby" | "answering" | "voting" | "results"; roundNumber: number; maxPlayers: number; isHost: boolean };
  me: { id: number } | null;
  players: Array<{ id: number; displayName: string; profileHandle: string; score: number }>;
  round: { id: number; prompt: string; mode: string; roundNumber: number } | null;
  submissions: Array<{ id: number; content: string; isMine: boolean; voteCount?: number; author?: string; profileHandle?: string }>;
  mySubmissionId: number | null;
  mySubmission: string;
  myVoteId: number | null;
  winners: Array<{ submissionId: number; content: string; author: string; profileHandle: string; voteCount: number }>;
  counts: { players: number; submissions: number; votes: number };
};

async function arenaAction(payload: Record<string, unknown>) {
  const response = await fetch("/api/arena/room", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as { error?: string; code?: string };
  if (!response.ok) throw new Error(data.error || "Arena request failed");
  return data;
}

export function ArenaLobby() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createRoom() {
    setBusy(true); setError("");
    try {
      const data = await arenaAction({ action: "create" });
      if (data.code) router.push(`/arena/${data.code}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to create room"); }
    finally { setBusy(false); }
  }

  async function joinRoom() {
    const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    if (normalized.length !== 5) { setError("Enter the 5-character room code."); return; }
    setBusy(true); setError("");
    try {
      await arenaAction({ action: "join", code: normalized });
      router.push(`/arena/${normalized}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to join room"); }
    finally { setBusy(false); }
  }

  return (
    <main className="arena-shell">
      <header className="arena-topbar">
        <Link className="wordmark" href="/">FACEBACK<span>.CAM</span></Link>
        <Link className="back-link" href="/"><ArrowLeft size={17} /> Movement home</Link>
      </header>
      <section className="arena-landing">
        <p className="eyebrow"><Radio size={16} /> LIVE CREATIVE ARENA</p>
        <h1>Make fast. Vote blind. <span>Study what won.</span></h1>
        <p className="arena-lede">Short creativity rounds built for punchlines, bars, hooks, concepts and weird ideas. Nobody sees the creator until voting is over.</p>
        <div className="arena-entry-grid">
          <article className="arena-entry-card arena-entry-primary">
            <Sparkles size={26} />
            <h2>Start a room</h2>
            <p>Host up to eight creators and control when each round moves from making to voting.</p>
            <button className="button button-primary" onClick={createRoom} disabled={busy}>Create room <ArrowRight size={18} /></button>
          </article>
          <article className="arena-entry-card">
            <Users size={26} />
            <h2>Join a room</h2>
            <p>Got an invite code? Drop in between rounds and start creating.</p>
            <div className="arena-code-entry">
              <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={5} placeholder="ABCDE" aria-label="Room code" />
              <button onClick={joinRoom} disabled={busy}>Join</button>
            </div>
          </article>
        </div>
        {error && <p className="arena-error">{error}</p>}
        <div className="arena-rules">
          <span>01 · Prompt</span><span>02 · Create</span><span>03 · Blind vote</span><span>04 · Winner revealed</span>
        </div>
      </section>
    </main>
  );
}

export function ArenaRoom({ code }: { code: string }) {
  const router = useRouter();
  const [state, setState] = useState<ArenaState | null>(null);
  const [entry, setEntry] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const roundRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/arena/room?code=${encodeURIComponent(code)}`, { cache: "no-store" });
    const data = (await response.json()) as ArenaState & { error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to load room");
    const nextRoundId = data.round?.id ?? null;
    if (roundRef.current !== nextRoundId) {
      roundRef.current = nextRoundId;
      setEntry(data.mySubmission || "");
    }
    setState(data);
  }, [code]);

  useEffect(() => {
    let active = true;
    load().catch((err) => active && setError(err instanceof Error ? err.message : "Unable to load room"));
    const timer = window.setInterval(() => {
      load().catch((err) => active && setError(err instanceof Error ? err.message : "Unable to refresh room"));
    }, 1800);
    return () => { active = false; window.clearInterval(timer); };
  }, [load]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setError("");
    try { await arenaAction({ action, code, ...extra }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Arena action failed"); }
    finally { setBusy(false); }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true); window.setTimeout(() => setCopied(false), 1400);
  }

  const sortedScores = useMemo(() => [...(state?.players || [])].sort((a, b) => b.score - a.score), [state?.players]);

  if (!state) {
    return <main className="arena-shell"><div className="arena-loading">Connecting to room {code}…</div></main>;
  }

  if (!state.me) {
    return (
      <main className="arena-shell"><section className="arena-landing"><p className="eyebrow">ROOM {code}</p><h1>You're not in this room yet.</h1><button className="button button-primary" onClick={() => act("join")} disabled={busy}>Join room</button>{error && <p className="arena-error">{error}</p>}</section></main>
    );
  }

  return (
    <main className="arena-shell">
      <header className="arena-topbar">
        <Link className="wordmark" href="/">FACEBACK<span>.CAM</span></Link>
        <button className="arena-invite" onClick={copyInvite}>{copied ? <Check size={16} /> : <Copy size={16} />} ROOM {code}</button>
      </header>

      <section className="arena-room-grid">
        <aside className="arena-scoreboard">
          <div className="arena-side-title"><Users size={17} /><span>{state.counts.players}/{state.room.maxPlayers} creators</span></div>
          {sortedScores.map((player, index) => (
            <div className="arena-player" key={player.id}>
              <span>{index + 1}</span><strong>{player.displayName}</strong><b>{player.score}</b>
            </div>
          ))}
          <button className="arena-exit" onClick={() => router.push("/arena")}>Leave screen</button>
        </aside>

        <section className="arena-stage-live">
          {state.room.phase === "lobby" && (
            <div className="arena-phase-card">
              <p className="eyebrow"><Radio size={15} /> ROOM OPEN</p>
              <h1>Get the creators in.</h1>
              <p>Share <strong>{code}</strong>. The host starts when at least two people are here.</p>
              {state.room.isHost ? <button className="button button-primary" onClick={() => act("start")} disabled={busy || state.counts.players < 2}>Start round one <ArrowRight size={18} /></button> : <div className="arena-waiting">Waiting for the host…</div>}
            </div>
          )}

          {state.room.phase === "answering" && state.round && (
            <div className="arena-phase-card">
              <div className="arena-round-meta"><span>ROUND {state.round.roundNumber}</span><span>{state.round.mode}</span></div>
              <h1>{state.round.prompt}</h1>
              <textarea value={entry} onChange={(event) => setEntry(event.target.value.slice(0, 280))} maxLength={280} placeholder="Make your move…" />
              <div className="arena-submit-row">
                <button className="button button-primary" onClick={() => act("submit", { content: entry })} disabled={busy || entry.trim().length < 2}>{state.mySubmissionId ? "Update entry" : "Lock it in"}</button>
                <span>{state.counts.submissions}/{state.counts.players} locked · {entry.length}/280</span>
              </div>
              {state.room.isHost && <button className="arena-host-control" onClick={() => act("open-voting")} disabled={busy || state.counts.submissions < 2}>Open blind voting</button>}
            </div>
          )}

          {state.room.phase === "voting" && state.round && (
            <div className="arena-phase-card">
              <div className="arena-round-meta"><span>ROUND {state.round.roundNumber}</span><span>BLIND VOTE</span></div>
              <h1>{state.round.prompt}</h1>
              <p className="arena-vote-help">Creators stay hidden until the reveal. Vote for the move that works best—not the person.</p>
              <div className="arena-submissions">
                {state.submissions.map((submission, index) => (
                  <button key={submission.id} className={`arena-submission ${state.myVoteId === submission.id ? "arena-submission-voted" : ""} ${submission.isMine ? "arena-submission-mine" : ""}`} onClick={() => !submission.isMine && act("vote", { submissionId: submission.id })} disabled={busy || submission.isMine}>
                    <span>ENTRY {String(index + 1).padStart(2, "0")}{submission.isMine ? " · YOURS" : ""}</span>
                    <strong>{submission.content}</strong>
                    {state.myVoteId === submission.id && <small><Check size={14} /> Your vote</small>}
                  </button>
                ))}
              </div>
              <div className="arena-submit-row"><span>{state.counts.votes}/{state.counts.players} votes in</span>{state.room.isHost && <button className="button button-primary" onClick={() => act("reveal")} disabled={busy || state.counts.votes < 1}>Reveal creators <Crown size={18} /></button>}</div>
            </div>
          )}

          {state.room.phase === "results" && state.round && (
            <div className="arena-phase-card">
              <div className="arena-round-meta"><span>ROUND {state.round.roundNumber}</span><span>RESULT</span></div>
              <p className="eyebrow"><Crown size={16} /> WINNING MOVE</p>
              {state.winners.map((winner) => (
                <article className="arena-winner" key={winner.submissionId}>
                  <blockquote>“{winner.content}”</blockquote>
                  <div><strong>{winner.author}</strong><span>{winner.voteCount} vote{winner.voteCount === 1 ? "" : "s"}</span></div>
                  {winner.profileHandle && <Link href={`/@${winner.profileHandle}`}>Examine the winner's creator profile <ArrowRight size={16} /></Link>}
                </article>
              ))}
              <div className="arena-breakdown"><span>WHY DID IT WORK?</span><p>Look for specificity, surprise, compression and rhythm. The winner gets the floor; the room gets to steal the principle, not the answer.</p></div>
              {state.room.isHost ? <button className="button button-primary" onClick={() => act("start")} disabled={busy}>Next prompt <ArrowRight size={18} /></button> : <div className="arena-waiting">Waiting for the next prompt…</div>}
            </div>
          )}
          {error && <p className="arena-error">{error}</p>}
        </section>
      </section>
    </main>
  );
}
