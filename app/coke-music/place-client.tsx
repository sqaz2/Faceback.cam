"use client";
import Link from "next/link";
import { CokeMusicApp } from "@/components/coke-game/app";
import { useGame } from "@/lib/coke-game/store";
export function CokeMusicPlace() {
  const screen = useGame((s) => s.screen);
  return <main className={`coke-place-shell coke-screen-${screen}`}>
    <header className="coke-place-bar">
      <Link href="/" className="coke-place-brand">FACEBACK<span>.CAM</span></Link>
      <span>Coke Music</span>
    </header>
    <div className="coke-place-game"><CokeMusicApp /></div>
  </main>;
}
