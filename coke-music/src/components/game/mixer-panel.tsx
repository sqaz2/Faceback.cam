import { Radio, Play, Square, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/game/button";
import { CLIPS, GENRES, TRACKS } from "@/lib/game/data";
import {
  getMix,
  getSpectrum,
  isMixPlaying,
  setMixClip,
  setMixClips,
  setMixGenre,
  sfxClick,
  sfxWin,
  startMix,
  stopMix,
  unlockAudio,
} from "@/lib/game/audio";
import { useGame } from "@/lib/game/store";
import { cn } from "@/lib/utils";

export function MixerPanel() {
  const addDisc = useGame((s) => s.addDisc);
  const setToast = useGame((s) => s.setToast);
  const setOverlay = useGame((s) => s.setOverlay);
  const discs = useGame((s) => s.discs);
  const [, bump] = useState(0);
  const [title, setTitle] = useState("Untitled Mix");
  const mix = getMix();

  const refresh = () => bump((n) => n + 1);

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Studio Mixer</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foam">Publish a mix</h2>
          <p className="mt-1 text-sm text-muted">Build with loops, preview it live, then publish it for rooms and stages.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOverlay(null)}>
          Close
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {GENRES.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => {
              sfxClick();
              setMixGenre(g.id);
              refresh();
            }}
            className={cn(
              "h-9 rounded-full px-3 text-sm font-medium",
              mix.genre === g.id ? "bg-coke text-foam" : "bg-ink-mid text-cream hover:bg-ink-soft",
            )}
          >
            {g.name}
          </button>
        ))}
      </div>

      <SpectrumBars />

      <div className="grid gap-3">
        {TRACKS.map((track, ti) => (
          <div key={track} className="rounded-[16px] border border-border bg-ink-soft p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted">{track}</p>
            <div className="flex flex-wrap gap-2">
              {CLIPS[track].map((c) => {
                const on = mix.clips[ti] === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      sfxClick();
                      setMixClip(ti as 0 | 1 | 2 | 3, c.id);
                      refresh();
                    }}
                    className={cn(
                      "h-10 min-w-[4.5rem] rounded-[12px] px-3 text-sm font-medium",
                      on ? "bg-cream text-ink" : "bg-ink-mid text-cream hover:bg-ink",
                    )}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-11 flex-1 rounded-[12px] border border-border bg-ink-mid px-3 text-sm text-foam outline-none ring-coke focus:ring-2"
          maxLength={28}
          aria-label="Mix name"
        />
        <div className="flex gap-2">
          <Button
            variant="cream"
            onClick={() => {
              unlockAudio();
              if (isMixPlaying()) stopMix();
              else startMix();
              refresh();
            }}
          >
            {isMixPlaying() ? <Square className="size-4" /> : <Play className="size-4" />}
            {isMixPlaying() ? "Stop" : "Play"}
          </Button>
          <Button
            onClick={() => {
              if (!mix.clips.some(Boolean)) {
                setToast("Pick at least one clip.");
                return;
              }
              const replaced = addDisc({
                id: `${Date.now()}`,
                name: title.trim() || "Untitled Mix",
                genre: mix.genre,
                clips: [...mix.clips] as Mix["clips"],
                createdAt: Date.now(),
              });
              sfxWin();
              setToast(replaced ? "Mix published. Your oldest mix was replaced." : "Mix published. Play it in a room or on a stage.");
            }}
          >
            <Sparkles className="size-4" />
            Publish mix
          </Button>
        </div>
      </div>

      {discs.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted">Your published mixes</p>
          <ul className="flex flex-col gap-2">
            {discs.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-[14px] border border-border bg-ink-mid px-3 py-2 text-left hover:bg-ink-soft"
                  onClick={() => {
                    setMixGenre(d.genre);
                    setMixClips(d.clips);
                    setTitle(d.name);
                    unlockAudio();
                    stopMix();
                    startMix();
                    refresh();
                  }}
                >
                  <Radio className="size-4 text-coke" />
                  <span className="flex-1 text-sm font-medium text-foam">{d.name}</span>
                  <span className="text-xs uppercase tracking-wider text-muted">{d.genre}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type Mix = import("@/lib/game/types").Mix;

function SpectrumBars() {
  const ref = useRef<HTMLDivElement>(null);
  const buf = useRef(new Uint8Array(32));

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (el && getSpectrum(buf.current)) {
        const kids = el.children;
        for (let i = 0; i < kids.length; i++) {
          const v = buf.current[i + 2] ?? 0;
          const h = 6 + (v / 255) * 42;
          (kids[i] as HTMLElement).style.height = `${h}px`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={ref}
      className="flex h-12 items-end gap-[3px] rounded-[14px] border border-border bg-ink-mid px-3 py-1.5"
      aria-hidden
    >
      {Array.from({ length: 22 }, (_, i) => (
        <span
          key={i}
          className="w-[6px] rounded-full bg-coke/85"
          style={{ height: 6 }}
        />
      ))}
    </div>
  );
}
