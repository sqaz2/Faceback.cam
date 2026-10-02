import { useEffect, useRef, useState } from "react";
import { renderAvatarPreview } from "@/lib/coke-game/draw";
import type { Appearance, ActorAction, Dir } from "@/lib/coke-game/types";
import { Button } from "./button";

export function AvatarPreview({ appearance }: { appearance: Appearance }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [direction, setDirection] = useState<Dir>(1);
  const [action, setAction] = useState<ActorAction>("idle");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const animate = (now: number) => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (canvas.current) {
        const painted = renderAvatarPreview(
          canvas.current,
          appearance,
          reduced ? 0 : (now - start) / 1000,
          action,
          direction,
        );
        if (painted) setReady(true);
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [appearance, direction, action]);
  return (
    <section aria-label="Character preview" className="my-3">
      <div className="relative">
        <canvas
          ref={canvas}
          role="img"
          aria-label={`Your character, ${action}, view ${direction + 1}`}
          className="h-52 w-full rounded-2xl border border-border bg-ink sm:h-64"
        />
        {!ready && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">
            Loading V-Ego…
          </p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="ink" onClick={() => setDirection(((direction + 3) % 4) as Dir)} aria-label="Rotate left">
          ↶
        </Button>
        <Button variant="ink" onClick={() => setDirection(((direction + 1) % 4) as Dir)} aria-label="Rotate right">
          ↷
        </Button>
        {(["idle", "walk", "sit", "dance"] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={action === value ? "cream" : "ink"}
            aria-pressed={action === value}
            onClick={() => setAction(value)}
          >
            {value === "idle" ? "Stand" : value === "walk" ? "Walk" : value === "sit" ? "Sit" : "Dance"}
          </Button>
        ))}
      </div>
    </section>
  );
}
