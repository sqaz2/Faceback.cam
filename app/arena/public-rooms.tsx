"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Bot, Radio, Users } from "lucide-react";

type PublicRoom = {
  code: string;
  phase: "lobby" | "results";
  maxPlayers: number;
  matchFormat: string;
  matchNumber: number;
  hostName: string;
  playerCount: number;
  botCount: number;
  joinUrl: string;
};

export function PublicRooms() {
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/arena/public", { cache: "no-store" });
    const data = (await response.json()) as { rooms?: PublicRoom[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to load public rooms");
    setRooms(data.rooms || []);
  }, []);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const poll = async () => {
      try {
        await load();
        if (active) setError("");
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to refresh public rooms");
      } finally {
        if (active) {
          setLoading(false);
          timer = window.setTimeout(poll, 5000);
        }
      }
    };
    void poll();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [load]);

  return (
    <section className="public-rooms-section section-pad" id="live-rooms">
      <div className="public-rooms-heading">
        <div>
          <p className="eyebrow"><Radio size={16} /> Joinable now</p>
          <h2>Public Arena rooms.</h2>
          <p>Public is the default. Open rooms appear here automatically and still have a shareable player link.</p>
        </div>
        <Link className="button button-dark" href="/arena">Create a public room <ArrowRight size={18} /></Link>
      </div>

      {loading ? (
        <div className="public-room-empty">Checking for live rooms…</div>
      ) : rooms.length > 0 ? (
        <div className="public-room-grid" aria-live="polite">
          {rooms.map((room) => (
            <article className="public-room-card" key={room.code}>
              <div className="public-room-card-top"><span><i /> OPEN</span><b>ROOM {room.code}</b></div>
              <h3>{room.phase === "lobby" ? "Waiting for players" : "Between rounds"}</h3>
              <p>Hosted by {room.hostName} · Match {room.matchNumber}</p>
              <div className="public-room-facts">
                <span><Users size={15} /> {room.playerCount}/{room.maxPlayers}</span>
                <span><Bot size={15} /> {room.botCount} CPU</span>
                <span>{room.matchFormat === "TEAMS" ? "TEAMS" : "SOLO"}</span>
              </div>
              <Link className="button button-primary" href={room.joinUrl}>Join this room <ArrowRight size={17} /></Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="public-room-empty">
          <strong>No public rooms are waiting right now.</strong>
          <span>Start one and it will appear here while you are in the lobby.</span>
        </div>
      )}
      {error && <p className="public-room-error">{error}</p>}
    </section>
  );
}
