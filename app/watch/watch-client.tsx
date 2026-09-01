"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Bot, Crown, Eye, Radio, Trophy, Users } from "lucide-react";
import { getGameMode } from "../arena/game-modes";
import { TEAM_SIGNAL, TEAM_STATIC, teamLabel } from "../arena/match-config";

type SpectatorState = {
  serverNow: string;
  room: {
    code: string;
    phase: "lobby" | "answering" | "voting" | "results";
    roundNumber: number;
    matchLength: number;
    matchFormat: string;
    rotationMode: string;
    matchStatus: string;
    matchNumber: number;
    matchFinished: boolean;
    timerPreset: string;
    teamScores: { signal: number; static: number };
  };
  players: Array<{ id: number; displayName: string; profileHandle: string; score: number; team: string; isBot: boolean }>;
  round: {
    id: number;
    roundNumber: number;
    mode: string;
    prompt: string;
    winningTeam: string;
    answerDeadlineAt: string | null;
    voteDeadlineAt: string | null;
  } | null;
  roundHistory: Array<{ roundNumber: number; mode: string; winningTeam: string }>;
  submissions: Array<{ id: number; content: string; author?: string; profileHandle?: string; team?: string; voteCount?: number }>;
  winners: Array<{
    id: number;
    content: string;
    author: string;
    profileHandle: string;
    team: string;
    voteCount: number;
    teachback: { intent: string; move: string; lesson: string } | null;
  }>;
  counts: { players: number; submissions: number; votes: number };
};

export function SpectatorRoom({ code }: { code: string }) {
  const [state, setState] = useState<SpectatorState | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/arena/spectate?code=${encodeURIComponent(code)}`, { cache: "no-store" });
    const data = (await response.json()) as SpectatorState & { error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to watch this room");
    setState(data);
  }, [code]);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const poll = async () => {
      try {
        await load();
        if (active) setError("");
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to refresh this room");
      } finally {
        if (active) timer = window.setTimeout(poll, 3000);
      }
    };
    void poll();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [load]);

  if (!state) {
    return <main className="spectator-shell"><div className="arena-loading">Tuning into room {code}…</div>{error && <p className="arena-error">{error}</p>}</main>;
  }

  const mode = state.round ? getGameMode(state.round.mode) : null;
  const deadline = state.room.phase === "answering" ? state.round?.answerDeadlineAt : state.room.phase === "voting" ? state.round?.voteDeadlineAt : null;

  return (
    <main className="spectator-shell">
      <header className="arena-topbar spectator-topbar">
        <Link className="wordmark" href="/">FACEBACK<span>.CAM</span></Link>
        <div className="spectator-live"><span className="record-dot" /> LIVE · ROOM {code}</div>
        <Link className="button button-primary spectator-join" href={`/arena/${code}`}>Join as creator <ArrowRight size={16} /></Link>
      </header>

      <section className="spectator-grid">
        <aside className="spectator-sidebar">
          <div className="spectator-badge"><Eye size={16} /> SPECTATOR MODE</div>
          <div className="arena-match-status">
            <div><span>MATCH</span><strong>{state.room.matchNumber}</strong></div>
            <div><span>ROUND</span><strong>{state.room.roundNumber}/{state.room.matchLength}</strong></div>
            <div><span>FORMAT</span><strong>{state.room.matchFormat === "TEAMS" ? "TEAMS" : "SOLO"}</strong></div>
          </div>
          {state.room.matchFormat === "TEAMS" && (
            <div className="spectator-team-score">
              <article><span>TEAM SIGNAL</span><strong>{state.room.teamScores.signal}</strong></article>
              <b>VS</b>
              <article><span>TEAM STATIC</span><strong>{state.room.teamScores.static}</strong></article>
            </div>
          )}
          <div className="spectator-roster">
            <span><Users size={15} /> {state.counts.players} creators</span>
            {state.players.map((player, index) => (
              <div key={player.id}><b>{index + 1}</b><strong>{player.displayName}{player.isBot && <small className="spectator-cpu"><Bot size={11} /> CPU</small>}</strong><span>{player.score}</span></div>
            ))}
          </div>
        </aside>

        <section className="spectator-stage">
          {state.room.phase === "lobby" && (
            <div className="spectator-card">
              <p className="eyebrow"><Radio size={15} /> MATCH SETUP</p>
              <h1>The room is loading the next fight.</h1>
              <p>Creators can join between rounds. Spectators stay read-only and never affect the vote.</p>
            </div>
          )}

          {state.room.phase === "answering" && state.round && (
            <div className="spectator-card">
              <div className="arena-round-meta"><span>ROUND {state.round.roundNumber}/{state.room.matchLength}</span><span>{mode?.name ?? state.round.mode}</span></div>
              <PublicRoundTrack state={state} />
              <RoundClock deadline={deadline} serverNow={state.serverNow} label="CREATE" waitingText="Overtime · waiting for 2 locked entries" />
              {mode && <div className="spectator-mode"><span>{mode.kicker}</span><strong>{mode.name}</strong><small>{mode.criteria.join(" · ")}</small></div>}
              <h1>{state.round.prompt}</h1>
              <div className="spectator-hidden-entries">
                <Eye size={22} />
                <strong>{state.counts.submissions}/{state.counts.players} entries locked</strong>
                <p>The work stays hidden while creators are writing. It appears anonymously when voting opens.</p>
              </div>
            </div>
          )}

          {state.room.phase === "voting" && state.round && (
            <div className="spectator-card">
              <div className="arena-round-meta"><span>ROUND {state.round.roundNumber}/{state.room.matchLength}</span><span>BLIND VOTE</span></div>
              <PublicRoundTrack state={state} />
              <RoundClock deadline={deadline} serverNow={state.serverNow} label="VOTE" waitingText="Overtime · waiting for the first vote" />
              <h1>{state.round.prompt}</h1>
              <p className="arena-vote-help">You can see the entries now, but not who wrote them. Spectators cannot vote.</p>
              <div className="arena-submissions spectator-submissions">
                {state.submissions.map((submission, index) => (
                  <article className="arena-submission" key={submission.id}>
                    <span>ENTRY {String(index + 1).padStart(2, "0")}</span>
                    <strong>{submission.content}</strong>
                  </article>
                ))}
              </div>
              <div className="spectator-vote-count">{state.counts.votes} creator vote{state.counts.votes === 1 ? "" : "s"} in</div>
            </div>
          )}

          {state.room.phase === "results" && state.round && (
            <div className="spectator-card">
              <div className="arena-round-meta"><span>ROUND {state.round.roundNumber}/{state.room.matchLength}</span><span>REVEALED</span></div>
              <PublicRoundTrack state={state} />
              <p className="eyebrow"><Crown size={16} /> WINNING MOVE</p>
              {state.winners.map((winner) => (
                <article className="arena-winner spectator-winner" key={winner.id}>
                  <blockquote>“{winner.content}”</blockquote>
                  <div><strong>{winner.author}</strong><span>{state.room.matchFormat === "TEAMS" && winner.team ? `${teamLabel(winner.team)} · ` : ""}{winner.voteCount} vote{winner.voteCount === 1 ? "" : "s"}</span></div>
                  {winner.profileHandle && <Link href={`/@${winner.profileHandle}`}>Open creator profile <ArrowRight size={16} /></Link>}
                  {winner.teachback && (
                    <div className="spectator-teachback">
                      <div><span>WHAT I WANTED</span><p>{winner.teachback.intent}</p></div>
                      <div><span>WHAT I DID</span><p>{winner.teachback.move}</p></div>
                      <div><span>STEAL THIS</span><p>{winner.teachback.lesson}</p></div>
                    </div>
                  )}
                </article>
              ))}
              <div className="spectator-results-list">
                {state.submissions.map((submission, index) => (
                  <article key={submission.id}>
                    <span>#{index + 1}</span>
                    <div><strong>{submission.author}</strong><p>{submission.content}</p></div>
                    <b>{submission.voteCount ?? 0}</b>
                  </article>
                ))}
              </div>
              {state.room.matchFinished && <PublicFinal state={state} />}
            </div>
          )}

          {error && <p className="arena-error">{error}</p>}
        </section>
      </section>
    </main>
  );
}

function RoundClock({ deadline, serverNow, label, waitingText }: { deadline: string | null | undefined; serverNow: string; label: string; waitingText: string }) {
  const seconds = useCountdown(deadline, serverNow);
  const overtime = Boolean(deadline) && seconds <= 0;
  return (
    <div className={`arena-clock ${overtime ? "arena-clock-overtime" : ""}`}>
      <span>{overtime ? "OVERTIME" : label}</span>
      <strong>{overtime ? "00:00" : formatSeconds(seconds)}</strong>
      <small>{overtime ? waitingText : "Server-controlled round clock"}</small>
    </div>
  );
}

function useCountdown(deadline: string | null | undefined, serverNow: string) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const parsedServerNow = Date.parse(serverNow);
    const serverOffset = Number.isFinite(parsedServerNow) ? parsedServerNow - Date.now() : 0;
    const calculate = () => {
      if (!deadline) return 0;
      return Math.max(0, Math.ceil((Date.parse(deadline) - (Date.now() + serverOffset)) / 1000));
    };
    setSeconds(calculate());
    const timer = window.setInterval(() => setSeconds(calculate()), 250);
    return () => window.clearInterval(timer);
  }, [deadline, serverNow]);
  return seconds;
}

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function PublicRoundTrack({ state }: { state: SpectatorState }) {
  return (
    <div className="arena-round-track">
      {Array.from({ length: state.room.matchLength }, (_, index) => {
        const n = index + 1;
        const history = state.roundHistory.find((entry) => entry.roundNumber === n);
        const active = state.room.roundNumber === n && !history;
        return <div key={n} className={`${history ? "arena-round-done" : ""} ${active ? "arena-round-active" : ""}`}><span>{n}</span><small>{history ? getGameMode(history.mode)?.shortName ?? history.mode : active ? "LIVE" : "—"}</small></div>;
      })}
    </div>
  );
}

function PublicFinal({ state }: { state: SpectatorState }) {
  const sorted = useMemo(() => [...state.players].sort((a, b) => b.score - a.score), [state.players]);
  const top = Math.max(...sorted.map((player) => player.score), 0);
  const signal = state.room.teamScores.signal;
  const statik = state.room.teamScores.static;
  const teamWinner = signal === statik ? "DRAW" : signal > statik ? TEAM_SIGNAL : TEAM_STATIC;
  return (
    <section className="spectator-final">
      <div><Trophy size={22} /><span>MATCH {state.room.matchNumber} FINAL</span></div>
      {state.room.matchFormat === "TEAMS" && <p>{teamWinner === "DRAW" ? "Team draw." : `${teamLabel(teamWinner)} wins ${Math.max(signal, statik)}–${Math.min(signal, statik)}.`}</p>}
      {sorted.map((player, index) => <article key={player.id} className={player.score === top && top > 0 ? "spectator-champion" : ""}><span>{index + 1}</span><strong>{player.displayName}</strong><b>{player.score} win{player.score === 1 ? "" : "s"}</b></article>)}
    </section>
  );
}
