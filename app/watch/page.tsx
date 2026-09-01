import type { Metadata } from "next";
import { WatchLobby } from "./watch-lobby";

export const metadata: Metadata = {
  title: "Watch Creative Arena",
  description: "Watch a FACEBACK.CAM creative match live without joining or voting.",
};

export default function WatchLobbyPage() {
  return <WatchLobby />;
}
