import { useEffect, useState } from "react";
import { useGame } from "@/lib/game/store";
import { randomAppearance, TOP_STYLES, BOTTOM_STYLES, CLOTH_COLORS, ACCESSORIES } from "@/lib/game/data";
import type { Appearance } from "@/lib/game/types";
import { Button } from "./button";

type Outfit = Pick<Appearance, "top" | "topColor" | "bottom" | "bottomColor" | "shoeColor" | "accessory">;
const limits = { top: TOP_STYLES.length, topColor: CLOTH_COLORS.length, bottom: BOTTOM_STYLES.length, bottomColor: CLOTH_COLORS.length, shoeColor: CLOTH_COLORS.length, accessory: ACCESSORIES.length };
function valid(value: unknown): value is Outfit {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return Object.entries(limits).every(([key, limit]) => Number.isInteger(item[key]) && Number(item[key]) >= 0 && Number(item[key]) < limit);
}
function clothes(a: Appearance): Outfit {
  return { top: a.top, topColor: a.topColor, bottom: a.bottom, bottomColor: a.bottomColor, shoeColor: a.shoeColor, accessory: a.accessory };
}
const KEY = "faceback-coke-outfits-v1";
export function OutfitTools() {
  const appearance = useGame((s) => s.appearance);
  const setAppearance = useGame((s) => s.setAppearance);
  const persist = useGame((s) => s.persist);
  const [slots, setSlots] = useState<(Outfit | null)[]>([null, null, null]);
  const [message, setMessage] = useState("");
  const [previous, setPrevious] = useState<Outfit | null>(null);
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(KEY) || "null");
      // Loading device-owned slots is the effect's external synchronization step.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(stored)) setSlots([0, 1, 2].map((i) => valid(stored[i]) ? stored[i] : null));
    } catch { setMessage("Saved outfits could not be loaded on this device."); }
  }, []);
  function wear(outfit: Outfit) {
    setPrevious(clothes(appearance));
    setAppearance({ ...appearance, ...outfit });
    setMessage(persist() ? "Outfit applied." : "Outfit changed, but could not be saved on this device.");
  }
  function save(index: number) {
    if (slots[index] && !window.confirm(`Replace outfit ${index + 1}?`)) return;
    const next = slots.map((slot, i) => i === index ? clothes(appearance) : slot);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setSlots(next);
      setMessage(`Outfit ${index + 1} saved on this device.`);
    } catch { setMessage("This device could not save the outfit. Your previous slots are unchanged."); }
  }
  return <section className="rounded-xl border border-border p-3" aria-label="Outfits">
    <h3 className="text-base font-semibold">Your outfits</h3>
    <p className="my-2 text-sm text-muted">Change clothes while keeping your skin and hair. Slots stay on this device.</p>
    <div className="flex flex-wrap gap-2">
      <Button variant="ink" onClick={() => wear(clothes(randomAppearance()))}>Shuffle clothes</Button>
      <Button variant="ink" disabled={!previous} onClick={() => previous && wear(previous)}>Undo outfit</Button>
    </div>
    <div className="mt-3 grid gap-2">
      {slots.map((slot, i) => <div className="flex flex-wrap items-center gap-2" key={i}>
        <span className="min-w-16 text-sm">Look {i + 1}</span>
        <Button size="sm" variant="cream" disabled={!slot} onClick={() => slot && wear(slot)}>{slot ? "Wear" : "Empty"}</Button>
        <Button size="sm" variant="ink" onClick={() => save(i)}>{slot ? "Replace" : "Save here"}</Button>
      </div>)}
    </div>
    <p role="status" className="mt-2 text-sm">{message}</p>
  </section>;
}
