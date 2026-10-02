import { Radio, Play, Square, Sparkles, Dices, VolumeX, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/coke-game/button";
import { CLIPS, GENRES, TRACKS } from "@/lib/coke-game/data";
import {
  burnDiscSfx,
  getMix,
  getSpectrum,
  isMixPlaying,
  setMixClip,
  setMixClips,
  setMixGenre,
  sfxClick,
  startMix,
  stopMix,
  surpriseMix,
  toggleTrackMuted,
  unlockAudio,
} from "@/lib/coke-game/audio";
import { useGame } from "@/lib/coke-game/store";
import { cn } from "@/lib/utils";

export function MixerPanel() {
  const addDisc = useGame((s) => s.addDisc);
  const setToast = useGame((s) => s.setToast);
  const setOverlay = useGame((s) => s.setOverlay);
  const discs = useGame((s) => s.discs);
  const [, bump] = useState(0);
  const [title, setTitle] = useState("Untitled Mix");
  const mix = getMix();
  const playing = isMixPlaying();
  const genreMeta = GENRES.find((g) => g.id === mix.genre);

  const refresh = () => bump((n) => n + 1);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => bump((n) => n + 1), 400);
    return () => window.clearInterval(id);
  }, [playing]);

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Studio Mixer</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foam">
            {playing ? "Mix is live" : "Publish a mix"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {playing
              ? "Layered kick / bass / lead with vinyl duck — burn a disc, then Use a jukebox or take the stage."
              : "Build richer genre layers, preview with vinyl ducking, then burn a disc for rooms and stages."}
          </p>
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
            <span className={cn("ml-1.5 text-[10px] uppercase tracking-wider", mix.genre === g.id ? "text-foam/75" : "text-muted")}>
              {g.bpm}
            </span>
          </button>
        ))}
      </div>

      <SpectrumBars playing={playing} genre={mix.genre} bpm={genreMeta?.bpm ?? 118} />

      <div className="grid gap-3">
        {TRACKS.map((track, ti) => {
          const muted = mix.muted?.[ti] ?? false;
          return (
          <div key={track} className={cn("rounded-[16px] border border-border bg-ink-soft p-3", muted && "opacity-55")}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{track}</p>
              <button
                type="button"
                aria-pressed={muted}
                aria-label={muted ? `Unmute ${track}` : `Mute ${track}`}
                title={muted ? "Unmute lane" : "Mute lane"}
                onClick={() => {
                  sfxClick();
                  toggleTrackMuted(ti as 0 | 1 | 2 | 3);
                  refresh();
                }}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold uppercase tracking-wider",
                  muted ? "bg-coke/25 text-foam" : "bg-ink-mid text-cream hover:bg-ink",
                )}
              >
                {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                {muted ? "Muted" : "Mute"}
              </button>
            </div>
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
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-11 flex-1 rounded-[12px] border border-border bg-ink-mid px-3 text-sm text-foam outline-none ring-coke focus:ring-2"
          maxLength={28}
          aria-label="Mix name"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ink"
            onClick={() => {
              sfxClick();
              const pick = <T extends { id: string }>(list: readonly T[]) =>
                list[Math.floor(Math.random() * list.length)]!.id;
              const result = surpriseMix();
              // Resample each lane from the full clip catalog for more variety than the genre defaults.
              setMixClips([
                pick(CLIPS.drums),
                pick(CLIPS.bass),
                pick(CLIPS.melody),
                pick(CLIPS.vox),
              ]);
              setTitle(`${GENRES.find((g) => g.id === result.genre)?.name ?? "Mix"} Drop`);
              unlockAudio();
              stopMix();
              startMix();
              refresh();
              setToast("Surprise mix — tweak lanes or publish it.");
            }}
          >
            <Dices className="size-4" />
            Surprise
          </Button>
          <Button
            variant="cream"
            onClick={() => {
              unlockAudio();
              if (playing) stopMix();
              else startMix();
              refresh();
            }}
          >
            {playing ? <Square className="size-4" /> : <Play className="size-4" />}
            {playing ? "Stop" : "Play mix"}
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
              burnDiscSfx();
              setToast(replaced ? "Disc burned. Oldest mix was replaced — drop it on a jukebox or stage." : "Disc burned. Drop it on a jukebox or take the stage.");
            }}
          >
            <Sparkles className="size-4" />
            Burn disc
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

type Mix = import("@/lib/coke-game/types").Mix;

function SpectrumBars({ playing, genre, bpm }: { playing: boolean; genre: string; bpm: number }) {
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
          const h = 6 + (v / 255) * (playing ? 46 : 28);
          (kids[i] as HTMLElement).style.height = `${h}px`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  return (
    <div
      className={cn(
        "rounded-[14px] border px-3 py-2 transition-colors",
        playing ? "border-coke/70 bg-coke/10 shadow-[0_0_24px_rgba(230,26,39,0.18)]" : "border-border bg-ink-mid",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          {playing ? "Live · kick ducks vinyl · take it to a jukebox/stage" : "Preview meters"}
        </p>
        <p className="text-[10px] font-medium uppercase tracking-wider text-foam/80">
          {genre} · {bpm} bpm
        </p>
      </div>
      <div ref={ref} className="flex h-12 items-end gap-[3px]" aria-hidden>
        {Array.from({ length: 22 }, (_, i) => (
          <span
            key={i}
            className={cn("w-[6px] rounded-full", playing ? "bg-coke" : "bg-coke/70")}
            style={{ height: 6 }}
          />
        ))}
      </div>
    </div>
  );
}
