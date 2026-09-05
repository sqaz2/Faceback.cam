import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { sfxClick, sfxLose, sfxWin } from "@/lib/game/audio";
import { useGame } from "@/lib/game/store";
import { cn } from "@/lib/utils";

const RPS = ["rock", "paper", "scissors"] as const;
type Hand = (typeof RPS)[number];

function beats(a: Hand, b: Hand) {
  return (a === "rock" && b === "scissors") || (a === "paper" && b === "rock") || (a === "scissors" && b === "paper");
}

export function VegaSan() {
  const addDb = useGame((s) => s.addDb);
  const grantItem = useGame((s) => s.grantItem);
  const setOverlay = useGame((s) => s.setOverlay);
  const setToast = useGame((s) => s.setToast);
  const [you, setYou] = useState(0);
  const [them, setThem] = useState(0);
  const [last, setLast] = useState<{ a: Hand; b: Hand; r: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);

  const play = (a: Hand) => {
    if (over) return;
    sfxClick();
    const b = RPS[Math.floor(Math.random() * 3)]!;
    let r = "tie";
    let y = you;
    let t = them;
    if (beats(a, b)) {
      y += 1;
      r = "win";
    } else if (beats(b, a)) {
      t += 1;
      r = "lose";
    }
    setYou(y);
    setThem(t);
    setLast({ a, b, r });
    if (y >= 2) {
      setOver("You take the ring.");
      sfxWin();
      addDb(30);
      const next = streak + 1;
      setStreak(next);
      if (next % 2 === 0) {
        grantItem("plant");
        setToast("+30 dB and a palm plant.");
      } else setToast("+30 dB");
    } else if (t >= 2) {
      setOver("Pinned. Shake it off.");
      sfxLose();
      addDb(8);
      setStreak(0);
      setToast("+8 dB for showing up");
    }
  };

  return (
    <div className="flex h-full flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">V-Ego San</p>
          <h2 className="mt-1 text-2xl font-semibold text-foam">Best of three</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOverlay(null)}>
          Close
        </Button>
      </div>
      <p className="text-sm text-muted">Sumo rules, playground hands. Consecutive wins pay furniture.</p>
      <div className="flex items-center justify-center gap-8 text-center">
        <Score label="You" n={you} />
        <span className="text-muted">vs</span>
        <Score label="House" n={them} />
      </div>
      {last && (
        <p className="text-center text-sm text-cream">
          You played <b className="text-foam">{last.a}</b> — they played <b className="text-foam">{last.b}</b>
          {" · "}
          {last.r === "win" ? "Point." : last.r === "lose" ? "Down." : "Stalemate."}
        </p>
      )}
      {over ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-lg font-semibold text-foam">{over}</p>
          <Button
            onClick={() => {
              setYou(0);
              setThem(0);
              setLast(null);
              setOver(null);
            }}
          >
            Rematch
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {RPS.map((h) => (
            <Button key={h} variant="ink" className="h-16 capitalize" onClick={() => play(h)}>
              {h}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function Score({ label, n }: { label: string; n: number }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="font-semibold tabular-nums text-3xl text-foam">{n}</p>
    </div>
  );
}

const PAIRS = ["kick", "snare", "bass", "keys", "hat", "vox", "bell", "tom"];

export function UncoverMusic() {
  const addDb = useGame((s) => s.addDb);
  const setOverlay = useGame((s) => s.setOverlay);
  const setToast = useGame((s) => s.setToast);
  const deck = useMemo(() => {
    const d = [...PAIRS, ...PAIRS].sort(() => Math.random() - 0.5);
    return d;
  }, []);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [lock, setLock] = useState(false);
  const [left, setLeft] = useState(50);
  const [done, setDone] = useState(false);
  const settled = useRef(false);
  const pendingFlip = useRef<number | null>(null);

  const finish = useCallback((won: boolean, points: number) => {
    if (settled.current) return;
    settled.current = true;
    setDone(true);
    if (won) sfxWin();
    else sfxLose();
    addDb(points);
    setToast(won ? `+${points} dB — full set` : `Time. +${points} dB`);
  }, [addDb, setToast]);

  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [done]);

  useEffect(() => () => {
    if (pendingFlip.current != null) window.clearTimeout(pendingFlip.current);
  }, []);

  useEffect(() => {
    if (done || left > 0) return;
    finish(false, matched.length * 6);
  }, [left, done, matched.length, finish]);

  const flip = (i: number) => {
    if (lock || done || open.includes(i) || matched.includes(deck[i]!)) return;
    sfxClick();
    const next = [...open, i];
    setOpen(next);
    if (next.length === 2) {
      setLock(true);
      const [a, b] = next;
      const same = deck[a!] === deck[b!];
      pendingFlip.current = window.setTimeout(() => {
        pendingFlip.current = null;
        if (settled.current) return;
        if (same) {
          const m = [...matched, deck[a!]!];
          setMatched(m);
          if (m.length === PAIRS.length) {
            finish(true, 48);
          }
        }
        setOpen([]);
        setLock(false);
      }, 620);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Uncover the Music</p>
          <h2 className="mt-1 text-2xl font-semibold text-foam">Match the stems</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOverlay(null)}>
          Close
        </Button>
      </div>
      <div className="flex justify-between text-sm text-muted">
        <span>
          Matched <b className="tabular-nums text-foam">{matched.length}</b> / {PAIRS.length}
        </span>
        <span className="tabular-nums text-foam">{Math.max(0, left)}s</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {deck.map((card, i) => {
          const up = open.includes(i) || matched.includes(card);
          return (
            <button
              key={i}
              type="button"
              onClick={() => flip(i)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-[14px] text-xs font-semibold uppercase tracking-wide",
                up ? "bg-cream text-ink" : "bg-ink-mid text-transparent hover:bg-ink-soft",
              )}
            >
              {up ? card : "•"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
