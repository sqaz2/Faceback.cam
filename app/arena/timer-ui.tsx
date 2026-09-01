"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { TIMER_PRESETS, type TimerPreset } from "./match-config";

export function RoundClock({
  deadline,
  serverNow,
  phase,
  overtimeText,
}: {
  deadline: string | null | undefined;
  serverNow: string;
  phase: "CREATE" | "VOTE";
  overtimeText: string;
}) {
  const seconds = useCountdown(deadline, serverNow);
  const overtime = Boolean(deadline) && seconds <= 0;
  return (
    <div className={`arena-clock ${overtime ? "arena-clock-overtime" : ""}`}>
      <span><Clock size={14} /> {overtime ? "OVERTIME" : phase}</span>
      <strong>{overtime ? "00:00" : formatSeconds(seconds)}</strong>
      <small>{overtime ? overtimeText : "Server-controlled clock"}</small>
    </div>
  );
}

export function TimerPicker({ value, onChange }: { value: TimerPreset; onChange: (value: TimerPreset) => void }) {
  return (
    <div className="arena-setup-group">
      <span>ROUND CLOCK</span>
      <div className="arena-setup-buttons arena-timer-options">
        {TIMER_PRESETS.map((preset) => (
          <button key={preset.id} className={value === preset.id ? "arena-setup-selected" : ""} onClick={() => onChange(preset.id)} type="button">
            <strong>{preset.name}</strong>
            <small>{preset.description}</small>
          </button>
        ))}
      </div>
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
