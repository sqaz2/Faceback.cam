import { createFileRoute } from "@tanstack/react-router";
import { CokeMusicApp } from "@/components/game/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <CokeMusicApp />;
}
