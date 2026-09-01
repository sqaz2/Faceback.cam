"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Radio,
  Share2,
  Sparkles,
  UserRound,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";

type Player = {
  displayName: string;
  handle: string;
  seat: number;
  ready: boolean;
  online: boolean;
  isHost: boolean;
  isSelf: boolean;
};

type Room = {
  code: string;
  status: "lobby" | "live" | "ended";
  maxPlayers: number;
  isHost: boolean;
  canStart: boolean;
  players: Player[];
};

type RoomClientProps = {
  code: string;
  userDisplayName: string;
  signOutHref: string;
};

export default function RoomClient({ code, userDisplayName, signOutHref }: RoomClientProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollInFlight = useRef(false);

  const callRoom = useCallback(async (action: "join" | "heartbeat" | "ready" | "start", ready?: boolean) => {
    const joining = action === "join";
    const response = await fetch(joining ? "/api/rooms" : `/api/rooms/${code}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(joining ? { action: "join", code } : { action, ready }),
    });
    const payload = (await response.json()) as { room?: Room; error?: string };
    if (!response.ok || !payload.room) throw new Error(payload.error || "Unable to reach the room.");
    setRoom(payload.room);
    setError("");
    return payload.room;
  }, [code]);

  useEffect(() => {
    let active = true;
    const initialJoin = window.setTimeout(() => {
      void callRoom("join").catch((joinError) => {
        if (active) setError(joinError instanceof Error ? joinError.message : "Unable to join.");
      });
    }, 0);

    const interval = window.setInterval(() => {
      if (!active || pollInFlight.current) return;
      pollInFlight.current = true;
      void callRoom("heartbeat")
        .catch((heartbeatError) => {
          if (active) setError(heartbeatError instanceof Error ? heartbeatError.message : "Connection interrupted.");
        })
        .finally(() => {
          pollInFlight.current = false;
        });
    }, 1500);

    return () => {
      active = false;
      window.clearTimeout(initialJoin);
      window.clearInterval(interval);
    };
  }, [callRoom]);

  const self = useMemo(() => room?.players.find((player) => player.isSelf), [room]);
  const seats = useMemo(
    () => Array.from({ length: room?.maxPlayers ?? 6 }, (_, index) => room?.players.find((player) => player.seat === index + 1) ?? null),
    [room],
  );

  async function runAction(action: "ready" | "start", ready?: boolean) {
    setActionBusy(true);
    try {
      await callRoom(action, ready);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update the room.");
    } finally {
      setActionBusy(false);
    }
  }

  async function shareRoom() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `FACEBACK room ${code}`, text: `Join my FACEBACK QUICKFIRE room: ${code}`, url });
        return;
      } catch {
        return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (error && !room) {
    return (
      <main className="room-shell room-error-shell">
        <div className="room-fatal">
          <WifiOff size={32} />
          <p className="eyebrow">ROOM {code}</p>
          <h1>Couldn&apos;t take a seat.</h1>
          <p>{error}</p>
          <Link className="button button-light" href="/play"><ArrowLeft size={18} /> Return to rooms</Link>
        </div>
      </main>
    );
  }

  return (
    <main className={`room-shell ${room?.status === "live" ? "room-is-live" : ""}`}>
      <header className="room-topbar">
        <Link className="wordmark" href="/">
          FACEBACK<span>.CAM</span>
        </Link>
        <div className="room-top-actions">
          <span className={`room-connection ${error ? "connection-trouble" : ""}`}>
            {error ? <WifiOff size={14} /> : <Wifi size={14} />}
            {error ? "RECONNECTING" : "LIVE LINK"}
          </span>
          <a href={signOutHref} target="_top">Sign out</a>
        </div>
      </header>

      <section className="room-heading">
        <div>
          <p className="eyebrow"><span className="record-dot" /> {room?.status === "live" ? "PERFORMANCE LIVE" : "ASSEMBLE THE ROOM"}</p>
          <h1>{room?.status === "live" ? "The room is synchronized." : "Creators, take your seats."}</h1>
          <p>
            {room?.status === "live"
              ? "The host started the room and every connected screen received the same state."
              : `Signed in as ${userDisplayName}. Share the code, then ready up when the room is assembled.`}
          </p>
        </div>
        <div className="room-code-card">
          <span>ROOM CODE</span>
          <strong>{code}</strong>
          <button onClick={() => void shareRoom()}>
            {copied ? <Check size={17} /> : <Share2 size={17} />}
            {copied ? "Invite copied" : "Share invite"}
          </button>
        </div>
      </section>

      <section className="room-stage" aria-label="Room seats">
        <div className="room-stage-line">
          <span><Radio size={15} /> {room?.players.length ?? 0}/{room?.maxPlayers ?? 6} CONNECTED</span>
          <span>QUICKFIRE STUDIO · ROOM {code}</span>
        </div>
        <div className="seat-grid">
          {seats.map((player, index) => (
            <article className={`seat-card seat-${index + 1} ${player ? "seat-taken" : "seat-empty"} ${player?.isSelf ? "seat-self" : ""}`} key={index}>
              <span className="seat-number">0{index + 1}</span>
              {player ? (
                <>
                  <div className="seat-avatar">{initials(player.displayName)}</div>
                  <div className="seat-identity">
                    <strong>{player.displayName}</strong>
                    <span>{player.handle ? `@${player.handle}` : player.isSelf ? "Profile can be added later" : "FACEBACK creator"}</span>
                  </div>
                  <div className="seat-status-row">
                    <span className={player.online ? "status-online" : "status-offline"}>
                      {player.online ? <Wifi size={13} /> : <WifiOff size={13} />}
                      {player.online ? "Here" : "Away"}
                    </span>
                    <span className={player.ready ? "status-ready" : "status-waiting"}>
                      {player.ready ? <Check size={13} /> : <Radio size={13} />}
                      {player.ready ? "Ready" : "Waiting"}
                    </span>
                  </div>
                  <div className="seat-labels">
                    {player.isHost && <span>HOST</span>}
                    {player.isSelf && <span>YOU</span>}
                    {player.handle && (
                      <Link href={`/@${player.handle}`} target="_blank" aria-label={`Open ${player.displayName}'s profile`}>
                        <ExternalLink size={13} />
                      </Link>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-seat-copy">
                  <UserRound size={25} />
                  <strong>OPEN SEAT</strong>
                  <span>Share {code}</span>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="room-control-deck">
        {room?.status === "live" ? (
          <div className="room-live-message">
            <Sparkles size={28} />
            <div>
              <span>CONNECTION TEST PASSED</span>
              <h2>Everyone is facing the same stage.</h2>
              <p>The prompt, timer, performances, votes and winner reveal can now run through this room.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="room-ready-copy">
              <span>YOUR STATUS</span>
              <h2>{self?.ready ? "You’re ready to perform." : "Ready when you are."}</h2>
              <p>{room?.isHost ? "Everyone must be online and ready before you start." : "The host starts once every creator is ready."}</p>
            </div>
            <div className="room-control-buttons">
              <button
                className={`ready-button ${self?.ready ? "is-ready" : ""}`}
                onClick={() => void runAction("ready", !self?.ready)}
                disabled={actionBusy || !self}
              >
                {self?.ready ? <Check size={19} /> : <Zap size={19} />}
                {self?.ready ? "Ready" : "Ready up"}
              </button>
              {room?.isHost && (
                <button
                  className="start-room-button"
                  onClick={() => void runAction("start")}
                  disabled={actionBusy || !room.canStart}
                >
                  <Radio size={19} /> {actionBusy ? "Syncing…" : "Start room"}
                </button>
              )}
            </div>
          </>
        )}
      </section>

      <footer className="room-footer">
        <Link href="/play"><ArrowLeft size={15} /> Rooms</Link>
        <span>{error || "Room state refreshes automatically."}</span>
        <button onClick={() => void navigator.clipboard.writeText(code)}><Copy size={14} /> Copy code</button>
      </footer>
    </main>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}` : name.slice(0, 2)).toUpperCase();
}
