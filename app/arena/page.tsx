import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import { ArenaLobby } from "./arena-client";

export const metadata: Metadata = {
  title: "Creative Arena — FACEBACK.CAM",
  description: "Fast live creativity rounds: make, vote blind, reveal the winner, study what worked.",
};

export default async function ArenaPage() {
  await requireChatGPTUser("/arena");
  return <ArenaLobby />;
}
