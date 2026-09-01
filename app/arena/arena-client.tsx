"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Crown, Eye, Radio, RotateCcw, Share2, Sparkles, Trophy, Users } from "lucide-react";
import { GAME_MODES, RANDOM_MODE, getGameMode, type ModeChoice } from "./game-modes";
import {
  MATCH_FORMATS,
  MATCH_LENGTHS,
  ROTATION_MODES,
  TEAM_SIGNAL,
  TEAM_STATIC,
  teamLabel,
  type MatchFormat,
  type MatchLength,
  type RotationMode,
  type TimerPreset,
} from "./match-config";
import { RoundClock, TimerPicker } from "./timer-ui";
import { ARENA_ROOM_CODE_LENGTH, normalizeArenaRoomCode } from "./room-code";

type Teachback = {
  intent: string;
  move: string;
  lesson: string;
};

type Winner = {
  submissionId: number;
  playerId: number;
  content: string;
  author: string;
  profileHandle: string;
  team: string;
  voteCount: number;
  teachback: Teachback | null;
};

type ArenaPlayer = {
  id: number;
  displayName: string;
  profileHandle: string;
  score: number;
  team: string;
};

type ArenaState = {
  serverNow: string;
  room: {
    code: string;
    phase: "lobby" | "answering" | "voting" | "results";
    roundNumber: number;
    maxPlayers: number;
    isHost: boolean;
    matchLength: number;
    matchFormat: MatchFormat;
    rotationMode: RotationMode;
    matchStatus: "setup" | "active" | "finished";
    matchNumber: number;
    matchFinished: boolean;
    timerPreset: TimerPreset;
    answerSeconds: number;
    voteSeconds: number;
    teamScores: { signal: number; static: number };
  };
  me: { id: number; team: string } | null;
  players: ArenaPlayer[];
  round: {
    id: number;
    prompt: string;
    mode: string;
    roundNumber: number;
    matchNumber: number;
    winningTeam: string;
    answerDeadlineAt: string | null;
    voteDeadlineAt: string | null;
  } | null;
  roundHistory: Array<{ roundNumber: number; mode: string; winningTeam: string }>;
  submissions: Array<{ id: number; content: string; isMine: boolean; voteCount?: number; author?: string; profileHandle?: string; team?: string }>;
  mySubmissionId: number | null;
  mySubmission: string;
  myVoteId: number | null;
  winners: Winner[];
  meIsWinner: boolean;
  counts: { players: number; submissions: number; votes: number; teachbacks: number };
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
    const normalized = normalizeArenaRoomCode(code);
    if (!normalized) { setError(`Enter the ${ARENA_ROOM_CODE_LENGTH}-character room code.`); return; }
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
        <p className="arena-lede">Three- or five-round creative matches: solo ladders or team battles across rap, punchlines, hooks, pitches, captions and remixes.</p>
        <div className="arena-entry-grid">
          <article className="arena-entry-card arena-entry-primary">
            <Sparkles size={26} />
            <h2>Start a match</h2>
            <p>Create the room instantly, then share one player link. No FACEBACK profile is required to host or play.</p>
            <button className="button button-primary" onClick={createRoom} disabled={busy}>Create room <ArrowRight size={18} /></button>
          </article>
          <article className="arena-entry-card">
            <Users size={26} />
            <h2>Join a room</h2>
            <p>Got an invite code? Drop in between rounds—no FACEBACK profile needed.</p>
            <div className="arena-code-entry">
              <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={ARENA_ROOM_CODE_LENGTH} placeholder="ABCD2345" aria-label="Room code" />
              <button onClick={joinRoom} disabled={busy}>Join</button>
            </div>
          </article>
        </div>
        <div className="arena-mode-preview">
          {GAME_MODES.map((mode) => (
            <article key={mode.id}>
              <span>{mode.kicker}</span>
              <strong>{mode.name}</strong>
              <p>{mode.description}</p>
            </article>
          ))}
        </div>
        <p className="arena-vote-help">No FACEBACK profile is required to host or join. Your ChatGPT display name appears in the Arena; your email is never shown.</p>
        {error && <p className="arena-error">{error}</p>}
        <div className="arena-rules">
          <span>01 · Configure match</span><span>02 · Create + vote</span><span>03 · Winner teaches</span><span>04 · Final standings</span>
        </div>
      </section>
    </main>
  );
}

export function ArenaRoom({ code }: { code: string }) {
  const router = useRouter();
  const [state, setState] = useState<ArenaState | null>(null);
  const [entry, setEntry] = useState("");
  const [selectedMode, setSelectedMode] = useState<ModeChoice>(RANDOM_MODE);
  const [matchLength, setMatchLength] = useState<MatchLength>(3);
  const [matchFormat, setMatchFormat] = useState<MatchFormat>("SOLO");
  const [rotationMode, setRotationMode] = useState<RotationMode>("AUTO");
  const [timerPreset, setTimerPreset] = useState<TimerPreset>("STANDARD");
  const [intent, setIntent] = useState("");
  const [move, setMove] = useState("");
  const [lesson, setLesson] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const roundRef = useRef<number | null>(null);
  const setupMatchRef = useRef<number | null>(null);
  const memberId = state?.me?.id ?? null;

  const load = useCallback(async () => {
    const response = await fetch(`/api/arena/room?code=${encodeURIComponent(code)}`, { cache: "no-store" });
    const data = (await response.json()) as ArenaState & { error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to load room");
    const nextRoundId = data.round?.id ?? null;
    if (roundRef.current !== nextRoundId) {
      roundRef.current = nextRoundId;
      setEntry(data.mySubmission || "");
      setIntent("");
      setMove("");
      setLesson("");
    }
    if (data.room.matchStatus === "setup" && setupMatchRef.current !== data.room.matchNumber) {
      setupMatchRef.current = data.room.matchNumber;
      setMatchLength(data.room.matchLength === 5 ? 5 : 3);
      setMatchFormat(data.room.matchFormat);
      setRotationMode(data.room.rotationMode);
      setTimerPreset(data.room.timerPreset || "STANDARD");
      setSelectedMode(RANDOM_MODE);
    }
    const mine = data.me ? data.winners.find((winner) => winner.playerId === data.me?.id) : null;
    if (mine?.teachback) {
      setIntent(mine.teachback.intent);
      setMove(mine.teachback.move);
      setLesson(mine.teachback.lesson);
    }
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
        if (active) setError(err instanceof Error ? err.message : "Unable to refresh room");
      } finally {
        if (active) timer = window.setTimeout(poll, 2500);
      }
    };
    void poll();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!memberId) return;
    let active = true;
    let timer: number | undefined;
    const heartbeat = async () => {
      try {
        await arenaAction({ action: "heartbeat", code });
      } catch {
        // Room polling reports actionable connectivity or membership errors.
      } finally {
        if (active) timer = window.setTimeout(heartbeat, 30_000);
      }
    };
    timer = window.setTimeout(heartbeat, 30_000);
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [code, memberId]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setError("");
    try { await arenaAction({ action, code, ...extra }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Arena action failed"); }
    finally { setBusy(false); }
  }

  async function shareInvite() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Join FACEBACK Arena room ${code}`,
          text: `Join my FACEBACK Creative Arena room ${code}. No FACEBACK profile needed.`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        setError("Unable to open sharing. Copy this page address from your browser.");
      }
    }
  }

  async function leaveRoom() {
    setBusy(true); setError("");
    try {
      await arenaAction({ action: "leave", code });
      router.push("/arena");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to leave room");
      setBusy(false);
    }
  }

  const sortedScores = useMemo(() => [...(state?.players || [])].sort((a, b) => b.score - a.score), [state?.players]);
  const mode = state?.round ? getGameMode(state.round.mode) : null;
  const myWinner = state?.me ? state.winners.find((winner) => winner.playerId === state.me?.id) : null;

  if (!state) {
    return <main className="arena-shell"><div className="arena-loading">Connecting to room {code}…</div>{error && <p className="arena-error">{error}</p>}</main>;
  }

  if (!state.me) {
    return (
      <main className="arena-shell">
        <header className="arena-topbar"><Link className="wordmark" href="/">FACEBACK<span>.CAM</span></Link></header>
        <section className="arena-landing arena-join-gate">
          <p className="eyebrow"><Radio size={16} /> YOU&apos;RE INVITED</p>
          <h1>Join Arena room <span>{code}</span></h1>
          <p>Tap once to enter the game. You do not need to create a FACEBACK profile.</p>
          <button className="button button-primary" onClick={() => act("join")} disabled={busy}>{busy ? "Joining…" : "Join the game"} <ArrowRight size={18} /></button>
          <small>We use your ChatGPT display name in the room. Your email stays private.</small>
          {error && <p className="arena-error">{error}</p>}
        </section>
      </main>
    );
  }

  const firstRound = state.room.roundNumber === 0 && state.room.matchStatus === "setup";
  const startPayload = firstRound
    ? { mode: selectedMode, matchLength, matchFormat, rotationMode, timerPreset }
    : { mode: selectedMode };

  return (
    <main className="arena-shell">
      <header className="arena-topbar">
        <Link className="wordmark" href="/">FACEBACK<span>.CAM</span></Link>
        <div className="arena-room-actions">
          <Link className="arena-invite" href={`/watch/${code}`}><Eye size={16} /> WATCH LIVE</Link>
          <button className="arena-invite" onClick={shareInvite}>{copied ? <Check size={16} /> : <Share2 size={16} />} {copied ? "LINK COPIED" : "SHARE ROOM"}</button>
        </div>
      </header>

      <section className="arena-room-grid">
        <aside className="arena-scoreboard">
          <MatchStatus state={state} />
          <div className="arena-side-title"><Users size={17} /><span>{state.counts.players}/{state.room.maxPlayers} creators</span></div>
          {sortedScores.map((player, index) => (
            <div className="arena-player arena-player-match" key={player.id}>
              <span>{index + 1}</span>
              <div><strong>{player.displayName}</strong>{state.room.matchFormat === "TEAMS" && player.team && <small className={`arena-team-mini arena-team-${player.team.toLowerCase()}`}>{teamLabel(player.team)}</small>}</div>
              <b>{player.score}</b>
            </div>
          ))}
          <button className="arena-exit" onClick={leaveRoom} disabled={busy}>Leave room</button>
        </aside>

        <section className="arena-stage-live">
          {state.room.phase === "lobby" && (
            <div className="arena-phase-card">
              <p className="eyebrow"><Radio size={15} /> MATCH {state.room.matchNumber} SETUP</p>
              <h1>Set the rules. Then make trouble.</h1>
              <p>Room <strong>{code}</strong> stays together for the whole match. Share the player link before you start.</p>
              {state.room.isHost ? (
                <>
                  <section className="arena-share-card">
                    <div><span>INVITE PLAYERS</span><strong>Send one link on Facebook.</strong><small>They open it, tap Join the game, and appear here. No FACEBACK profile needed.</small></div>
                    <button className="button button-primary" onClick={shareInvite}>{copied ? <Check size={18} /> : <Share2 size={18} />} {copied ? "Player link copied" : "Share player link"}</button>
                  </section>
                  <MatchSetup
                    length={matchLength}
                    format={matchFormat}
                    rotation={rotationMode}
                    timerPreset={timerPreset}
                    onLength={setMatchLength}
                    onFormat={setMatchFormat}
                    onRotation={setRotationMode}
                    onTimerPreset={setTimerPreset}
                  />
                  {rotationMode === "HOST" && <ModePicker value={selectedMode} onChange={setSelectedMode} />}
                  <button className="button button-primary arena-start-button" onClick={() => act("start", startPayload)} disabled={busy || state.counts.players < 2}>Start {matchLength}-round match <ArrowRight size={18} /></button>
                </>
              ) : <div className="arena-waiting">Host is configuring match {state.room.matchNumber}…</div>}
            </div>
          )}

          {state.room.phase === "answering" && state.round && (
            <div className="arena-phase-card">
              <div className="arena-round-meta"><span>ROUND {state.round.roundNumber} / {state.room.matchLength}</span><span>{mode?.name ?? state.round.mode}</span></div>
              <RoundTrack state={state} />
              <RoundClock deadline={state.round.answerDeadlineAt} serverNow={state.serverNow} phase="CREATE" overtimeText="Waiting for at least 2 locked entries" />
              {mode && <ModeBrief mode={mode} />}
              <h1>{state.round.prompt}</h1>
              <textarea value={entry} onChange={(event) => setEntry(event.target.value.slice(0, mode?.maxChars ?? 280))} maxLength={mode?.maxChars ?? 280} placeholder={mode?.placeholder ?? "Make your move…"} />
              <div className="arena-submit-row">
                <button className="button button-primary" onClick={() => act("submit", { content: entry })} disabled={busy || entry.trim().length < 2}>{state.mySubmissionId ? "Update entry" : "Lock it in"}</button>
                <span>{state.counts.submissions}/{state.counts.players} locked · {entry.length}/{mode?.maxChars ?? 280}</span>
              </div>
              {state.room.isHost && <button className="arena-host-control" onClick={() => act("open-voting")} disabled={busy || state.counts.submissions < 2}>Open blind voting early</button>}
            </div>
          )}

          {state.room.phase === "voting" && state.round && (
            <div className="arena-phase-card">
              <div className="arena-round-meta"><span>ROUND {state.round.roundNumber} / {state.room.matchLength}</span><span>BLIND {mode?.shortName.toUpperCase() ?? "VOTE"}</span></div>
              <RoundTrack state={state} />
              <RoundClock deadline={state.round.voteDeadlineAt} serverNow={state.serverNow} phase="VOTE" overtimeText="Waiting for the first creator vote" />
              {mode && <ModeBrief mode={mode} compact />}
              <h1>{state.round.prompt}</h1>
              <p className="arena-vote-help">Creators—and team identities—stay hidden until the reveal. Judge the move using the game&apos;s three lenses.</p>
              <div className="arena-submissions">
                {state.submissions.map((submission, index) => (
                  <button key={submission.id} className={`arena-submission ${state.myVoteId === submission.id ? "arena-submission-voted" : ""} ${submission.isMine ? "arena-submission-mine" : ""}`} onClick={() => !submission.isMine && act("vote", { submissionId: submission.id })} disabled={busy || submission.isMine}>
                    <span>ENTRY {String(index + 1).padStart(2, "0")}{submission.isMine ? " · YOURS" : ""}</span>
                    <strong>{submission.content}</strong>
                    {state.myVoteId === submission.id && <small><Check size={14} /> Your vote</small>}
                  </button>
                ))}
              </div>
              <div className="arena-submit-row"><span>{state.counts.votes}/{state.counts.players} votes in</span>{state.room.isHost && <button className="button button-primary" onClick={() => act("reveal")} disabled={busy || state.counts.votes < 1}>Reveal creators early <Crown size={18} /></button>}</div>
            </div>
          )}

          {state.room.phase === "results" && state.round && (
            <div className="arena-phase-card arena-results-card">
              <div className="arena-round-meta"><span>ROUND {state.round.roundNumber} / {state.room.matchLength}</span><span>{mode?.name ?? "RESULT"}</span></div>
              <RoundTrack state={state} />
              <p className="eyebrow"><Crown size={16} /> WINNING MOVE</p>
              {state.winners.map((winner) => (
                <article className="arena-winner" key={winner.submissionId}>
                  <blockquote>“{winner.content}”</blockquote>
                  <div>
                    <strong>{winner.author}</strong>
                    <span>{state.room.matchFormat === "TEAMS" && winner.team ? `${teamLabel(winner.team)} · ` : ""}{winner.voteCount} vote{winner.voteCount === 1 ? "" : "s"}</span>
                  </div>
                  {winner.profileHandle && <Link href={`/@${winner.profileHandle}`}>Examine the winner&apos;s creator profile <ArrowRight size={16} /></Link>}
                  {winner.teachback ? (
                    <WinnerBreakdown teachback={winner.teachback} author={winner.author} />
                  ) : (
                    <div className="arena-school-pending"><Sparkles size={16} /> Waiting for {winner.author} to school the room.</div>
                  )}
                </article>
              ))}

              {state.meIsWinner && myWinner && !myWinner.teachback && (
                <section className="arena-teachback-form">
                  <div>
                    <p className="eyebrow">YOUR FLOOR</p>
                    <h2>School the room.</h2>
                    <p>You won the blind vote. Expose the decisions behind it so the other creators—or the other team—leave with a technique they can use.</p>
                  </div>
                  <label>
                    <span>What were you aiming for?</span>
                    <textarea value={intent} onChange={(event) => setIntent(event.target.value.slice(0, 260))} maxLength={260} placeholder="The reaction, feeling or effect I wanted…" />
                  </label>
                  <label>
                    <span>What move did you make?</span>
                    <textarea value={move} onChange={(event) => setMove(event.target.value.slice(0, 420))} maxLength={420} placeholder="The specific choice, contrast, rhythm, wording or trick…" />
                  </label>
                  <label>
                    <span>What should everyone steal from the technique?</span>
                    <textarea value={lesson} onChange={(event) => setLesson(event.target.value.slice(0, 260))} maxLength={260} placeholder="A principle they can reuse without copying the answer…" />
                  </label>
                  <button className="button button-primary" onClick={() => act("teachback", { intent, move, lesson })} disabled={busy || intent.trim().length < 3 || move.trim().length < 3 || lesson.trim().length < 3}>Teach the room <Sparkles size={17} /></button>
                </section>
              )}

              {mode && (
                <div className="arena-breakdown">
                  <span>WHAT THE ROOM WAS JUDGING</span>
                  <p>{mode.criteria.join(" · ")}. The vote identifies the move that landed; the winner breakdown explains how they got there.</p>
                </div>
              )}

              {state.room.matchFinished ? (
                <MatchFinal state={state} busy={busy} onRematch={() => act("rematch")} />
              ) : state.room.isHost ? (
                <section className="arena-next-round">
                  <div>
                    <span>NEXT ROUND · {state.room.roundNumber + 1}/{state.room.matchLength}</span>
                    <small>{state.room.rotationMode === "AUTO" ? "FACEBACK will rotate to the next game automatically." : state.counts.teachbacks > 0 ? "Winner lesson captured. Pick the next game." : "Pick now, or give the winner the floor first."}</small>
                  </div>
                  {state.room.rotationMode === "HOST" && <ModePicker value={selectedMode} onChange={setSelectedMode} compact />}
                  <button className="button button-primary" onClick={() => act("start", { mode: selectedMode })} disabled={busy}>Start round {state.room.roundNumber + 1} <ArrowRight size={18} /></button>
                </section>
              ) : <div className="arena-waiting">Waiting for the host to start round {state.room.roundNumber + 1}…</div>}
            </div>
          )}
          {error && <p className="arena-error">{error}</p>}
        </section>
      </section>
    </main>
  );
}

type ModeMeta = (typeof GAME_MODES)[number];

function MatchSetup({
  length,
  format,
  rotation,
  timerPreset,
  onLength,
  onFormat,
  onRotation,
  onTimerPreset,
}: {
  length: MatchLength;
  format: MatchFormat;
  rotation: RotationMode;
  timerPreset: TimerPreset;
  onLength: (value: MatchLength) => void;
  onFormat: (value: MatchFormat) => void;
  onRotation: (value: RotationMode) => void;
  onTimerPreset: (value: TimerPreset) => void;
}) {
  return (
    <section className="arena-match-setup">
      <div className="arena-setup-group">
        <span>MATCH LENGTH</span>
        <div className="arena-setup-buttons">
          {MATCH_LENGTHS.map((value) => <button key={value} className={length === value ? "arena-setup-selected" : ""} onClick={() => onLength(value)} type="button"><strong>{value} rounds</strong><small>{value === 3 ? "Fast set" : "Full set"}</small></button>)}
        </div>
      </div>
      <div className="arena-setup-group">
        <span>FORMAT</span>
        <div className="arena-setup-buttons">
          {MATCH_FORMATS.map((value) => <button key={value.id} className={format === value.id ? "arena-setup-selected" : ""} onClick={() => onFormat(value.id)} type="button"><strong>{value.name}</strong><small>{value.description}</small></button>)}
        </div>
      </div>
      <div className="arena-setup-group">
        <span>GAME ROTATION</span>
        <div className="arena-setup-buttons">
          {ROTATION_MODES.map((value) => <button key={value.id} className={rotation === value.id ? "arena-setup-selected" : ""} onClick={() => onRotation(value.id)} type="button"><strong>{value.name}</strong><small>{value.description}</small></button>)}
        </div>
      </div>
      <TimerPicker value={timerPreset} onChange={onTimerPreset} />
    </section>
  );
}

function MatchStatus({ state }: { state: ArenaState }) {
  return (
    <section className="arena-match-status">
      <div><span>MATCH</span><strong>{state.room.matchNumber}</strong></div>
      <div><span>ROUND</span><strong>{state.room.roundNumber}/{state.room.matchLength}</strong></div>
      <div><span>FORMAT</span><strong>{state.room.matchFormat === "TEAMS" ? "TEAMS" : "SOLO"}</strong></div>
      <div><span>PACE</span><strong>{state.room.timerPreset}</strong></div>
      {state.room.matchFormat === "TEAMS" && (
        <div className="arena-team-score-mini">
          <b className="arena-team-signal">SIG {state.room.teamScores.signal}</b>
          <b className="arena-team-static">STA {state.room.teamScores.static}</b>
        </div>
      )}
    </section>
  );
}

function RoundTrack({ state }: { state: ArenaState }) {
  return (
    <div className="arena-round-track" aria-label="Match round history">
      {Array.from({ length: state.room.matchLength }, (_, index) => {
        const roundNumber = index + 1;
        const history = state.roundHistory.find((entry) => entry.roundNumber === roundNumber);
        const active = state.room.roundNumber === roundNumber && !history;
        return (
          <div className={`${history ? "arena-round-done" : ""} ${active ? "arena-round-active" : ""}`} key={roundNumber}>
            <span>{roundNumber}</span>
            <small>{history ? getGameMode(history.mode)?.shortName ?? history.mode : active ? getGameMode(state.round?.mode ?? "")?.shortName ?? "LIVE" : "—"}</small>
          </div>
        );
      })}
    </div>
  );
}

function ModePicker({ value, onChange, compact = false }: { value: ModeChoice; onChange: (mode: ModeChoice) => void; compact?: boolean }) {
  return (
    <div className={`arena-mode-picker ${compact ? "arena-mode-picker-compact" : ""}`}>
      <button className={value === RANDOM_MODE ? "arena-mode-selected" : ""} onClick={() => onChange(RANDOM_MODE)} type="button">
        <span>MIX IT UP</span><strong>Random</strong><small>Let FACEBACK pick.</small>
      </button>
      {GAME_MODES.map((mode) => (
        <button className={value === mode.id ? "arena-mode-selected" : ""} key={mode.id} onClick={() => onChange(mode.id)} type="button">
          <span>{mode.kicker}</span><strong>{mode.name}</strong>{!compact && <small>{mode.description}</small>}
        </button>
      ))}
    </div>
  );
}

function ModeBrief({ mode, compact = false }: { mode: ModeMeta; compact?: boolean }) {
  return (
    <div className={`arena-mode-brief ${compact ? "arena-mode-brief-compact" : ""}`}>
      <div><span>{mode.kicker}</span><strong>{mode.name}</strong></div>
      {!compact && <p>{mode.description}</p>}
      <div className="arena-criteria">{mode.criteria.map((criterion) => <b key={criterion}>{criterion}</b>)}</div>
    </div>
  );
}

function WinnerBreakdown({ teachback, author }: { teachback: Teachback; author: string }) {
  return (
    <section className="arena-winner-breakdown">
      <div className="arena-school-header"><Sparkles size={17} /><span>{author.toUpperCase()} SCHOOLS THE ROOM</span></div>
      <div className="arena-school-grid">
        <article><span>01 · AIM</span><strong>What I wanted</strong><p>{teachback.intent}</p></article>
        <article><span>02 · MOVE</span><strong>What I did</strong><p>{teachback.move}</p></article>
        <article><span>03 · STEAL THIS</span><strong>The reusable principle</strong><p>{teachback.lesson}</p></article>
      </div>
    </section>
  );
}

function MatchFinal({ state, busy, onRematch }: { state: ArenaState; busy: boolean; onRematch: () => void }) {
  const topScore = Math.max(...state.players.map((player) => player.score), 0);
  const champions = state.players.filter((player) => player.score === topScore && topScore > 0);
  const signal = state.room.teamScores.signal;
  const statik = state.room.teamScores.static;
  const teamWinner = signal === statik ? "DRAW" : signal > statik ? TEAM_SIGNAL : TEAM_STATIC;

  return (
    <section className="arena-match-final">
      <div className="arena-final-heading"><Trophy size={24} /><div><span>MATCH {state.room.matchNumber} COMPLETE</span><h2>Final standings.</h2></div></div>
      {state.room.matchFormat === "TEAMS" && (
        <div className="arena-team-final">
          <article className={teamWinner === TEAM_SIGNAL ? "arena-team-champion" : ""}><span>TEAM SIGNAL</span><strong>{signal}</strong>{teamWinner === TEAM_SIGNAL && <small>TEAM CHAMPION</small>}</article>
          <b>VS</b>
          <article className={teamWinner === TEAM_STATIC ? "arena-team-champion" : ""}><span>TEAM STATIC</span><strong>{statik}</strong>{teamWinner === TEAM_STATIC && <small>TEAM CHAMPION</small>}</article>
          {teamWinner === "DRAW" && <p>Team draw. The individual ladder breaks the emotional tie.</p>}
        </div>
      )}
      <div className="arena-final-ladder">
        {state.players.map((player, index) => (
          <article key={player.id} className={player.score === topScore && topScore > 0 ? "arena-final-champion" : ""}>
            <span>{index + 1}</span><div><strong>{player.displayName}</strong>{state.room.matchFormat === "TEAMS" && player.team && <small>{teamLabel(player.team)}</small>}</div><b>{player.score} win{player.score === 1 ? "" : "s"}</b>
          </article>
        ))}
      </div>
      {champions.length > 0 && <p className="arena-champion-line"><Crown size={17} /> {champions.map((player) => player.displayName).join(" + ")} {champions.length === 1 ? "takes" : "share"} the individual match crown.</p>}
      {state.room.isHost ? <button className="button button-primary arena-rematch-button" onClick={onRematch} disabled={busy}>Rematch in this room <RotateCcw size={18} /></button> : <div className="arena-waiting">Match complete. Waiting for the host to call the rematch…</div>}
    </section>
  );
}
