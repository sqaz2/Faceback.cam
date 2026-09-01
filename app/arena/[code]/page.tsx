import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { ArenaRoom } from "../arena-client";
import { normalizeArenaRoomCode } from "../room-code";

type ArenaRoomPageProps = {
  params: Promise<{ code: string }>;
};

export const metadata: Metadata = {
  title: "Live Room — FACEBACK.CAM",
};

export default async function ArenaRoomPage({ params }: ArenaRoomPageProps) {
  const { code: rawCode } = await params;
  const code = normalizeArenaRoomCode(decodeURIComponent(rawCode));
  if (!code) notFound();
  await requireChatGPTUser(`/arena/${code}`);
  return <ArenaRoom code={code} />;
}
