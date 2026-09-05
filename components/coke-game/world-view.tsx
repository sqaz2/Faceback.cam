import {
  Armchair,
  Disc3,
  HelpCircle,
  Map,
  Mic2,
  Music2,
  PackageOpen,
  RotateCw,
  Shirt,
  Volume2,
  VolumeX,
  Hand,
} from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Button } from "@/components/coke-game/button";
import { CATALOG_MAP, SPRITE_URLS, furnitureSpriteUrl } from "@/lib/coke-game/data";
import { renderWorld, type SpriteMap } from "@/lib/coke-game/draw";
import { setMuted as setAudioMuted, sfxClick, unlockAudio } from "@/lib/coke-game/audio";
import { useGame } from "@/lib/coke-game/store";
import {
  clickWorld,
  movePlayerBy,
  occupySeat,
  pickupAt,
  player,
  playerSay,
  selectedFurniture,
  setHover,
  setPlayerAction,
  setPlayerLook,
  startPerformance,
  studioFurniture,
  tick,
  TILE_H,
  TILE_W,
  activateSelectedFurniture,
  world,
} from "@/lib/coke-game/world";
import { cn } from "@/lib/utils";

let sharedSprites: SpriteMap | null = null;

function loadSprites(): SpriteMap {
  if (sharedSprites) return sharedSprites;
  const map: SpriteMap = {};
  for (const id of Object.keys(SPRITE_URLS)) {
    for (let facing = 0; facing < 4; facing++) {
      const key = `${id}_d${facing}`;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = furnitureSpriteUrl(id, facing);
      map[key] = img;
      // Base id aliases to d0 (existing `${sprite}.png`).
      if (facing === 0) map[id] = img;
    }
  }
  sharedSprites = map;
  return sharedSprites;
}

export function WorldView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sprites = useRef<SpriteMap | null>(null);
  const overlay = useGame((s) => s.overlay);
  const placing = useGame((s) => s.placing);
  const placingRot = useGame((s) => s.placingRot);
  const inventory = useGame((s) => s.inventory);
  const setOverlay = useGame((s) => s.setOverlay);
  const placeOwnedItem = useGame((s) => s.placeOwnedItem);
  const grantItem = useGame((s) => s.grantItem);
  const setStudio = useGame((s) => s.setStudio);
  const setPlacing = useGame((s) => s.setPlacing);
  const cyclePlacingRot = useGame((s) => s.cyclePlacingRot);
  const setToast = useGame((s) => s.setToast);
  const muted = useGame((s) => s.muted);
  const setMuted = useGame((s) => s.setMuted);
  const db = useGame((s) => s.db);
  const name = useGame((s) => s.name);
  const toast = useGame((s) => s.toast);
  const chat = useGame((s) => s.chat);
  const roomName = world.room.name;
  const inputRef = useRef<HTMLInputElement>(null);
  const [packing, setPacking] = useState(false);
  const [selectedFurnId, setSelectedFurnId] = useState<string | null>(null);
  const selectedFurnIdRef = useRef<string | null>(null);
  const overlayRef = useRef(overlay);
  const placingRef = useRef(placing);
  const renderFailed = useRef(false);

  useEffect(() => {
    overlayRef.current = overlay;
    placingRef.current = placing;
  }, [overlay, placing]);

  useEffect(() => {
    sprites.current = loadSprites();
    const w = window as unknown as {
      __vego?: {
        world: typeof world;
        occupySeat: typeof occupySeat;
        player: typeof player;
        clickWorld: typeof clickWorld;
        setPlayerLook: typeof setPlayerLook;
      };
    };
    w.__vego = { world, occupySeat, player, clickWorld, setPlayerLook };
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!overlayRef.current) tick(dt);
      if (world.selectedFurnId !== selectedFurnIdRef.current) {
        selectedFurnIdRef.current = world.selectedFurnId;
        setSelectedFurnId(world.selectedFurnId);
      }
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        try {
          const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          renderWorld(ctx, w, h, sprites.current!, placingRef.current, reducedMotion);
          renderFailed.current = false;
        } catch {
          if (!renderFailed.current) {
            renderFailed.current = true;
            setToast("The room could not be drawn. Try reopening it.");
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [setToast]);

  const toWorld = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    return {
      x: mx - canvas.clientWidth / 2 + world.camX,
      y: my - canvas.clientHeight / 2 + world.camY + 20,
    };
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-ink">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full touch-none"
        tabIndex={0}
        role="application"
        aria-label="FACEBACK.CAM room. Use arrow keys or W A S D to walk; use the controls below to interact."
        onKeyDown={(event) => {
          const key = event.key.toLowerCase();
          if (key === "r" && placing) {
            const cat = CATALOG_MAP[placing];
            if (cat?.rotate) {
              event.preventDefault();
              cyclePlacingRot();
              return;
            }
          }
          const direction = key === "arrowup" || key === "w" ? [0, -1]
            : key === "arrowdown" || key === "s" ? [0, 1]
              : key === "arrowleft" || key === "a" ? [-1, 0]
                : key === "arrowright" || key === "d" ? [1, 0]
                  : null;
          if (!direction) return;
          event.preventDefault();
          movePlayerBy(direction[0]!, direction[1]!);
        }}
        onPointerMove={(e) => {
          const p = toWorld(e);
          setHover(p.x, p.y);
        }}
        onPointerDown={(e) => {
          unlockAudio();
          const p = toWorld(e);
          if (packing) {
            const tx = Math.floor(p.x / TILE_W + p.y / TILE_H);
            const ty = Math.floor(p.y / TILE_H - p.x / TILE_W);
            const id = pickupAt(tx, ty);
            if (id) {
              grantItem(id);
              setStudio(studioFurniture());
              setToast("Packed up.");
              sfxClick();
              setPacking(false);
            } else {
              setToast("Tap a furniture item to pack it.");
            }
            return;
          }
          if (placing) {
            const available = inventory[placing] ?? 0;
            if (available <= 0) {
              setPlacing(null);
              setToast("You don't have another one.");
              return;
            }
            const tx = Math.floor(p.x / TILE_W + p.y / TILE_H);
            const ty = Math.floor(p.y / TILE_H - p.x / TILE_W);
            if (placeOwnedItem(placing, tx, ty)) {
              setToast("Placed.");
              sfxClick();
            } else {
              setToast("Can't place there.");
            }
            return;
          }
          clickWorld(p.x, p.y);
          selectedFurnIdRef.current = world.selectedFurnId;
          setSelectedFurnId(world.selectedFurnId);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!world.room.private) return;
          const p = toWorld(e as unknown as PointerEvent<HTMLCanvasElement>);
          const tx = Math.floor(p.x / TILE_W + p.y / TILE_H);
          const ty = Math.floor(p.y / TILE_H - p.x / TILE_W);
          const id = pickupAt(tx, ty);
          if (id) {
            grantItem(id);
            setStudio(studioFurniture());
            setToast("Packed up.");
          }
        }}
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4">
        <div className="pointer-events-auto rounded-[16px] border border-border bg-ink/80 px-3 py-2 backdrop-blur-sm">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{roomName}</p>
          <p className="text-sm font-medium text-foam">{name || "Guest"}</p>
        </div>
        <div className="pointer-events-auto flex items-center gap-2 rounded-[16px] border border-border bg-ink/80 px-3 py-2 backdrop-blur-sm">
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted">dB</span>
          <span className="font-semibold tabular-nums text-foam">{db}</span>
        </div>
      </header>

      {(placing || packing) && (
        <div className="absolute left-1/2 top-16 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-ink/85 px-4 py-2 text-sm text-cream backdrop-blur-sm">
          <span>{packing ? "Tap furniture to pack it" : "Tap a tile to place"}</span>
          {placing && CATALOG_MAP[placing]?.rotate && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-ink-mid px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-foam hover:border-coke"
              onClick={() => cyclePlacingRot()}
              title="Rotate (R)"
            >
              <RotateCw className="size-3.5" />
              Rotate
              <span className="tabular-nums text-muted">{placingRot}</span>
            </button>
          )}
          <button
            type="button"
            className="text-coke"
            onClick={() => {
              setPlacing(null);
              setPacking(false);
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {toast && (
        <div className="absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-full bg-cream px-4 py-2 text-sm font-medium text-ink shadow-lg">
          {toast}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-40 left-3 z-10 max-h-36 w-[min(100%-1.5rem,20rem)] overflow-hidden sm:bottom-28">
        <ul className="flex flex-col gap-1">
          {chat.slice(-5).map((c) => (
            <li
              key={c.id}
              className={cn(
                "truncate rounded-[10px] px-2 py-1 text-xs",
                c.self ? "bg-coke/80 text-foam" : "bg-ink/70 text-cream",
              )}
            >
              <span className="font-medium">{c.name}: </span>
              {c.text}
            </li>
          ))}
        </ul>
      </div>


      {selectedFurnId && (() => {
        const furn = selectedFurniture();
        const cat = furn ? CATALOG_MAP[furn.catalogId] : undefined;
        if (!furn || !cat) return null;
        const canUse = !!(cat.sit || cat.drink || cat.music || cat.stage);
        return (
          <div className="pointer-events-auto absolute bottom-36 right-3 z-20 w-[min(100%-1.5rem,16rem)] rounded-[16px] border border-border bg-ink/90 p-3 shadow-lg backdrop-blur-sm sm:bottom-28">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Furniture</p>
            <p className="mt-0.5 text-sm font-semibold text-foam">{cat.name}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted">{cat.desc}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ink"
                onClick={() => {
                  sfxClick();
                  setOverlay("catalog");
                }}
              >
                Catalogue
              </Button>
              {canUse && (
                <Button
                  size="sm"
                  variant="cream"
                  onClick={() => {
                    sfxClick();
                    unlockAudio();
                    activateSelectedFurniture();
                  }}
                >
                  Use
                </Button>
              )}
            </div>
          </div>
        );
      })()}

      <footer className="absolute inset-x-0 bottom-0 z-10 border-t border-border bg-ink/90 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-sm">
        <form
          className="mx-auto flex max-w-3xl items-center gap-2 px-3"
          onSubmit={(e) => {
            e.preventDefault();
            const el = inputRef.current;
            if (!el?.value.trim()) return;
            playerSay(el.value);
            el.value = "";
          }}
        >
          <input
            ref={inputRef}
            placeholder="Say something…"
            className="h-11 min-w-0 flex-1 rounded-[12px] border border-border bg-ink-mid px-3 text-sm text-foam outline-none ring-coke placeholder:text-muted focus:ring-2"
            maxLength={80}
          />
          <Button type="submit" size="sm" variant="cream" className="hidden sm:inline-flex">
            Send
          </Button>
        </form>
        <nav className="mx-auto mt-2 grid max-w-3xl grid-cols-5 items-center gap-1 px-2 sm:flex sm:justify-between">
          <IconBtn label="Rooms" onClick={() => setOverlay("nav")}>
            <Map className="size-5" />
          </IconBtn>
          <IconBtn label="Mix" onClick={() => setOverlay("mixer")}>
            <Music2 className="size-5" />
          </IconBtn>
          <IconBtn label="Shop" onClick={() => setOverlay("catalog")}>
            <Armchair className="size-5" />
          </IconBtn>
          {world.room.private && (
            <IconBtn
              label={packing ? "Cancel" : "Pack"}
              onClick={() => {
                setPlacing(null);
                setPacking((value) => !value);
              }}
            >
              <PackageOpen className="size-5" />
            </IconBtn>
          )}
          <IconBtn label="Look" onClick={() => setOverlay("wardrobe")}>
            <Shirt className="size-5" />
          </IconBtn>
          <IconBtn label="Dance" onClick={() => setPlayerAction("dance")}>
            <Disc3 className="size-5" />
          </IconBtn>
          <IconBtn label="Wave" onClick={() => setPlayerAction("wave")}>
            <Hand className="size-5" />
          </IconBtn>
          <IconBtn label="Stage" onClick={() => startPerformance()}>
            <Mic2 className="size-5" />
          </IconBtn>
          <IconBtn
            label={muted ? "Unmute" : "Mute"}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setAudioMuted(next);
            }}
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </IconBtn>
          <IconBtn label="Help" onClick={() => setOverlay("help")}>
            <HelpCircle className="size-5" />
          </IconBtn>
        </nav>
      </footer>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        sfxClick();
        unlockAudio();
        onClick();
      }}
      className="flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[12px] px-1 py-1 text-cream hover:bg-foam/10 sm:min-w-11 sm:px-2"
    >
      {children}
      <span className="text-[10px] font-medium tracking-wide text-muted">{label}</span>
    </button>
  );
}
