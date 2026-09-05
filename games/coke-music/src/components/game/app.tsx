import { useEffect, useMemo, useRef, useState } from "react";
import { Dices, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MixerPanel } from "@/components/game/mixer-panel";
import { UncoverMusic, VegaSan } from "@/components/game/minigames";
import { Wordmark } from "@/components/game/wordmark";
import { WorldView } from "@/components/game/world-view";
import {
  ACCESSORIES,
  BOTTOM_STYLES,
  CATALOG,
  CATALOG_CATEGORIES,
  CLOTH_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  randomAppearance,
  ROOMS,
  SKINS,
  TOP_STYLES,
} from "@/lib/game/data";
import { renderAvatarPreview, renderOptionPreview } from "@/lib/game/draw";
import { sfxClick, sfxCoin, unlockAudio } from "@/lib/game/audio";
import { useGame } from "@/lib/game/store";
import { world } from "@/lib/game/world";
import { cn } from "@/lib/utils";
import type { Appearance } from "@/lib/game/types";

export function CokeMusicApp() {
  const hydrate = useGame((s) => s.hydrate);
  const screen = useGame((s) => s.screen);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink text-cream">
      {screen === "splash" && <Splash />}
      {screen === "create" && <CreateVego />}
      {screen === "world" && (
        <>
          <WorldView />
          <Overlays />
        </>
      )}
    </div>
  );
}

function Splash() {
  const hasSave = useGame((s) => s.hasSave);
  const name = useGame((s) => s.name);
  const enter = useGame((s) => s.enter);
  const setScreen = useGame((s) => s.setScreen);
  const reset = useGame((s) => s.reset);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <img
        src="/art/splash.jpg?v=3"
        alt=""
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/20" />
      <div className="relative z-10 flex flex-1 flex-col justify-end px-5 pb-10 pt-16 sm:px-10 sm:pb-14">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-cream/80">Est. 2002 · Studios open</p>
        <Wordmark light className="mt-3 text-5xl sm:text-7xl" />
        <p className="mt-3 max-w-md text-base text-cream/85">
          Mix a track. Burn a disc. Hang in the Red Room. A tribute to the isometric cola lounge.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          {hasSave && (
            <Button
              size="lg"
              onClick={() => {
                unlockAudio();
                enter();
              }}
            >
              Continue as {name || "V-Ego"}
            </Button>
          )}
          <Button
            size="lg"
            variant={hasSave ? "cream" : "primary"}
            onClick={() => {
              unlockAudio();
              if (hasSave) reset();
              else setScreen("create");
            }}
          >
            {hasSave ? "New V-Ego" : "Enter the studios"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreateVego() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const name = useGame((s) => s.name);
  const setName = useGame((s) => s.setName);
  const appearance = useGame((s) => s.appearance);
  const setAppearance = useGame((s) => s.setAppearance);
  const enter = useGame((s) => s.enter);

  useEffect(() => {
    let raf = 0;
    let t0 = performance.now();
    const loop = (now: number) => {
      const t = (now - t0) / 1000;
      if (canvasRef.current) renderAvatarPreview(canvasRef.current, appearance, t, "idle", { scale: 3.2 });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [appearance]);

  const patch = (p: Partial<Appearance>) => setAppearance({ ...appearance, ...p });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Create your V-Ego</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foam">First impressions</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Every wardrobe option shows a live chibi preview — pick hair, clothes, and extras with clear labels.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,300px)_1fr]">
        <div className="flex flex-col gap-3">
          <canvas
            ref={canvasRef}
            className="h-80 w-full rounded-[24px] border border-border bg-ink-soft sm:h-[22rem]"
          />
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 16))}
              placeholder="Your handle"
              className="mt-1 h-11 w-full rounded-[12px] border border-border bg-ink-soft px-3 text-foam outline-none ring-coke focus:ring-2"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ink"
              onClick={() => {
                sfxClick();
                setAppearance(randomAppearance());
              }}
            >
              <Dices className="size-4" />
              Shuffle
            </Button>
            <Button
              size="lg"
              onClick={() => {
                unlockAudio();
                if (!name.trim()) setName("V-Ego");
                enter("red-room");
              }}
            >
              Walk in
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <Swatch label="Skin" values={SKINS} value={appearance.skin} onPick={(i) => patch({ skin: i })} large />
          <LookGrid
            label="Hair"
            options={HAIR_STYLES.map((label, i) => ({
              label,
              on: appearance.hair === i,
              look: { ...appearance, hair: i },
              onClick: () => patch({ hair: i }),
            }))}
          />
          <Swatch
            label="Hair color"
            values={HAIR_COLORS}
            value={appearance.hairColor}
            onPick={(i) => patch({ hairColor: i })}
            large
          />
          <LookGrid
            label="Top"
            options={TOP_STYLES.map((label, i) => ({
              label,
              on: appearance.top === i,
              look: { ...appearance, top: i },
              onClick: () => patch({ top: i }),
            }))}
          />
          <Swatch label="Top color" values={CLOTH_COLORS} value={appearance.topColor} onPick={(i) => patch({ topColor: i })} large />
          <LookGrid
            label="Bottom"
            options={BOTTOM_STYLES.map((label, i) => ({
              label,
              on: appearance.bottom === i,
              look: { ...appearance, bottom: i },
              onClick: () => patch({ bottom: i }),
            }))}
          />
          <Swatch
            label="Bottom color"
            values={CLOTH_COLORS}
            value={appearance.bottomColor}
            onPick={(i) => patch({ bottomColor: i })}
            large
          />
          <Swatch
            label="Shoes"
            values={CLOTH_COLORS}
            value={appearance.shoeColor}
            onPick={(i) => patch({ shoeColor: i })}
            large
          />
          <LookGrid
            label="Extra"
            options={ACCESSORIES.map((label, i) => ({
              label,
              on: appearance.accessory === i,
              look: { ...appearance, accessory: i },
              onClick: () => patch({ accessory: i }),
            }))}
          />
        </div>
      </div>
    </div>
  );
}

function Overlays() {
  const overlay = useGame((s) => s.overlay);
  const setOverlay = useGame((s) => s.setOverlay);
  useEffect(() => {
    if (!overlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOverlay(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlay, setOverlay]);
  if (!overlay) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Dismiss overlay"
        className="absolute inset-0 bg-ink/60"
        onClick={() => setOverlay(null)}
      />
      <div className="relative z-10 flex max-h-[88dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-[24px] border border-border bg-ink-soft shadow-2xl sm:max-w-xl sm:rounded-[24px]">
        {overlay === "nav" && <Navigator />}
        {overlay === "mixer" && <MixerPanel />}
        {overlay === "catalog" && <Catalog />}
        {overlay === "wardrobe" && <Wardrobe />}
        {overlay === "vega" && <VegaSan />}
        {overlay === "uncover" && <UncoverMusic />}
        {overlay === "help" && <Help />}
      </div>
    </div>
  );
}

function Navigator() {
  const enter = useGame((s) => s.enter);
  const setOverlay = useGame((s) => s.setOverlay);
  const lastRoom = useGame((s) => s.lastRoom);
  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Navigator</p>
          <h2 className="mt-1 text-2xl font-semibold text-foam">Pick a studio</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOverlay(null)}>
          Close
        </Button>
      </div>
      <ul className="mt-4 grid gap-2">
        {ROOMS.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => {
                sfxClick();
                enter(r.id);
                setOverlay(null);
              }}
              className={cn(
                "flex w-full flex-col rounded-[16px] border px-4 py-3 text-left",
                lastRoom === r.id ? "border-coke bg-coke/15" : "border-border bg-ink-mid hover:bg-ink",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foam">
                <MapPin className="size-4 text-coke" />
                {r.name}
                {r.doubleDb && (
                  <span className="rounded-full bg-coke px-2 py-0.5 text-[10px] uppercase tracking-wider text-foam">
                    2× dB
                  </span>
                )}
              </span>
              <span className="mt-1 text-xs text-muted">{r.city} · {r.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="ink" onClick={() => setOverlay("vega")}>
          V-Ego San
        </Button>
        <Button variant="ink" onClick={() => setOverlay("uncover")}>
          Uncover
        </Button>
      </div>
    </div>
  );
}

function Catalog() {
  const db = useGame((s) => s.db);
  const buy = useGame((s) => s.buy);
  const inventory = useGame((s) => s.inventory);
  const setPlacing = useGame((s) => s.setPlacing);
  const setOverlay = useGame((s) => s.setOverlay);
  const setToast = useGame((s) => s.setToast);
  const inStudio = world.room.private;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [tab, setTab] = useState<"shop" | "owned">("shop");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATALOG.filter((c) => {
      if (tab === "owned" && !(inventory[c.id] > 0)) return false;
      if (category !== "all" && c.category !== category) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.desc.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      );
    });
  }, [query, category, tab, inventory]);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Inventory</p>
          <h2 className="mt-1 text-2xl font-semibold text-foam">Furnish the lounge</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOverlay(null)}>
          Close
        </Button>
      </div>
      <p className="mt-1 text-sm tabular-nums text-muted">{db} dB · owned items can be placed in My Studio</p>

      <div className="mt-3 flex gap-2">
        <Button size="sm" variant={tab === "shop" ? "primary" : "ink"} onClick={() => setTab("shop")}>
          Catalog
        </Button>
        <Button size="sm" variant={tab === "owned" ? "primary" : "ink"} onClick={() => setTab("owned")}>
          Owned
        </Button>
      </div>

      <label className="relative mt-3 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or category…"
          className="h-10 w-full rounded-[12px] border border-border bg-ink px-9 text-sm text-foam outline-none ring-coke placeholder:text-muted focus:ring-2"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {CATALOG_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={cn(
              "h-8 rounded-full px-3 text-xs font-medium",
              category === c.id ? "bg-cream text-ink" : "bg-ink-mid text-cream hover:bg-ink",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <ul className="mt-4 grid gap-2">
        {filtered.length === 0 && (
          <li className="rounded-[16px] border border-border bg-ink-mid px-3 py-6 text-center text-sm text-muted">
            No furniture matches “{query || category}”.
          </li>
        )}
        {filtered.map((c) => {
          const owned = inventory[c.id] ?? 0;
          return (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-[16px] border border-border bg-ink-mid px-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foam">{c.name}</p>
                <p className="text-[11px] uppercase tracking-wider text-coke/90">{c.category}</p>
                <p className="text-xs text-muted">{c.desc}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Button
                  size="sm"
                  variant={db >= c.price ? "primary" : "ink"}
                  onClick={() => {
                    if (buy(c.id, c.price)) {
                      sfxCoin();
                      setToast(`Bought ${c.name}`);
                    } else setToast("Not enough decibels.");
                  }}
                >
                  {c.price} dB
                </Button>
                {owned > 0 && (
                  <button
                    type="button"
                    className="text-[11px] text-cream/80 hover:text-foam"
                    onClick={() => {
                      if (!inStudio) {
                        setToast("Place furniture in My Studio.");
                        return;
                      }
                      setPlacing(c.id);
                    }}
                  >
                    Place · {owned}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Wardrobe() {
  const appearance = useGame((s) => s.appearance);
  const setAppearance = useGame((s) => s.setAppearance);
  const setOverlay = useGame((s) => s.setOverlay);
  const persist = useGame((s) => s.persist);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    let t0 = performance.now();
    const loop = (now: number) => {
      const t = (now - t0) / 1000;
      if (canvasRef.current) renderAvatarPreview(canvasRef.current, appearance, t, "dance", { scale: 2.6 });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [appearance]);

  const patch = (p: Partial<Appearance>) => {
    setAppearance({ ...appearance, ...p });
    persist();
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Wardrobe</p>
          <h2 className="mt-1 text-2xl font-semibold text-foam">Tune the look</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOverlay(null)}>
          Close
        </Button>
      </div>
      <canvas ref={canvasRef} className="mt-3 h-52 w-full rounded-[20px] border border-border bg-ink" />
      <div className="mt-4 flex flex-col gap-4">
        <Swatch values={SKINS} value={appearance.skin} onPick={(i) => patch({ skin: i })} label="Skin" large />
        <LookGrid
          label="Hair"
          options={HAIR_STYLES.map((label, i) => ({
            label,
            on: appearance.hair === i,
            look: { ...appearance, hair: i },
            onClick: () => patch({ hair: i }),
          }))}
        />
        <Swatch values={HAIR_COLORS} value={appearance.hairColor} onPick={(i) => patch({ hairColor: i })} label="Hair color" large />
        <LookGrid
          label="Top"
          options={TOP_STYLES.map((label, i) => ({
            label,
            on: appearance.top === i,
            look: { ...appearance, top: i },
            onClick: () => patch({ top: i }),
          }))}
        />
        <Swatch values={CLOTH_COLORS} value={appearance.topColor} onPick={(i) => patch({ topColor: i })} label="Top color" large />
        <LookGrid
          label="Bottom"
          options={BOTTOM_STYLES.map((label, i) => ({
            label,
            on: appearance.bottom === i,
            look: { ...appearance, bottom: i },
            onClick: () => patch({ bottom: i }),
          }))}
        />
        <Swatch values={CLOTH_COLORS} value={appearance.bottomColor} onPick={(i) => patch({ bottomColor: i })} label="Bottom color" large />
        <Swatch values={CLOTH_COLORS} value={appearance.shoeColor} onPick={(i) => patch({ shoeColor: i })} label="Shoes" large />
        <LookGrid
          label="Extra"
          options={ACCESSORIES.map((label, i) => ({
            label,
            on: appearance.accessory === i,
            look: { ...appearance, accessory: i },
            onClick: () => patch({ accessory: i }),
          }))}
        />
      </div>
    </div>
  );
}

function Help() {
  const setOverlay = useGame((s) => s.setOverlay);
  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">How it works</p>
          <h2 className="mt-1 text-2xl font-semibold text-foam">Welcome to the studios</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOverlay(null)}>
          Close
        </Button>
      </div>
      <ul className="mt-4 space-y-3 text-sm leading-relaxed text-cream/90">
        <li>Tap the floor to walk. Tap a sofa or chair (or the tiles next to it) to sit on the cushion — two-seaters have room for someone next to you. Furniture blocks its tiles; you cannot walk through a sofa or plant.</li>
        <li>Drinking cola and getting thumbs-up on a set earns <b className="text-foam">decibels</b>.</li>
        <li>
          Open <b className="text-foam">Mix</b> to stack drum, bass, melody, and vox clips. Burn a disc, then hit Stage.
        </li>
        <li>The Red Room pays double. My Studio is yours — buy furniture from the searchable inventory, then place it.</li>
        <li>V-Ego San and Uncover the Music live in the navigator. Right-click furniture in your studio to pack it up.</li>
      </ul>
      <Button className="mt-6 w-full" onClick={() => setOverlay(null)}>
        Got it
      </Button>
    </div>
  );
}

function LookGrid({
  label,
  options,
}: {
  label: string;
  options: { label: string; on: boolean; look: Appearance; onClick: () => void }[];
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((opt) => (
          <LookTile key={opt.label} {...opt} />
        ))}
      </div>
    </div>
  );
}

function LookTile({
  label,
  on,
  look,
  onClick,
}: {
  label: string;
  on: boolean;
  look: Appearance;
  onClick: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const lookRef = useRef(look);
  lookRef.current = look;
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (ref.current) renderOptionPreview(ref.current, lookRef.current, 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col overflow-hidden rounded-[16px] border text-left transition",
        on ? "border-cream bg-cream/10 ring-2 ring-cream/40" : "border-border bg-ink-mid hover:bg-ink",
      )}
    >
      <canvas ref={ref} className="h-24 w-full bg-[#241014]" />
      <span className="px-2 py-1.5 text-center text-xs font-semibold text-foam">{label}</span>
    </button>
  );
}

function Swatch({
  label,
  values,
  value,
  onPick,
  large,
}: {
  label: string;
  values: readonly string[];
  value: number;
  onPick: (i: number) => void;
  large?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((c, i) => (
          <button
            key={c + i}
            type="button"
            aria-label={`${label} ${i + 1}`}
            onClick={() => onPick(i)}
            className={cn(
              "rounded-full border-2",
              large ? "size-9" : "size-8",
              value === i ? "border-foam" : "border-transparent",
            )}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
