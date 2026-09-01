"use client";

import { useState } from "react";
import { ArrowRight, Plus, Users } from "lucide-react";

type PlayLobbyClientProps = {
  displayName: string;
};

export default function PlayLobbyClient({ displayName }: PlayLobbyClientProps) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState("");

  async function connect(action: "create" | "join") {
    setBusy(action);
    setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, code }),
      });
      const payload = (await response.json()) as { room?: { code: string }; error?: string };
      if (!response.ok || !payload.room) throw new Error(payload.error || "Unable to connect.");
      window.location.assign(`/play/${payload.room.code}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to connect.");
      setBusy(null);
    }
  }

  return (
    <div className="play-control-panel">
      <span className="play-panel-number">SIGNED IN · {displayName}</span>
      <div className="play-create-block">
        <h2>Host a room</h2>
        <p>Create an invite and take seat one.</p>
        <button className="play-primary-action" onClick={() => connect("create")} disabled={busy !== null}>
          <Plus size={19} /> {busy === "create" ? "Opening room…" : "Create live room"}
        </button>
      </div>
      <div className="play-divider"><span>OR JOIN</span></div>
      <form
        className="play-join-form"
        onSubmit={(event) => {
          event.preventDefault();
          void connect("join");
        }}
      >
        <label htmlFor="room-code">Room code</label>
        <div>
          <input
            id="room-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            placeholder="ABC234"
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            maxLength={6}
            aria-describedby={error ? "room-error" : undefined}
          />
          <button type="submit" disabled={busy !== null || code.length !== 6} aria-label="Join room">
            {busy === "join" ? <Users size={19} /> : <ArrowRight size={19} />}
          </button>
        </div>
      </form>
      {error && <p className="play-error" id="room-error" role="alert">{error}</p>}
    </div>
  );
}
