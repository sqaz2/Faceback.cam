import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { ArenaRoom } from "../arena-client";

type ArenaRoomPageProps = {
  params: Promise<{ code: string }>;
};

export const metadata: Metadata = {
  title: "Live Room — FACEBACK.CAM",
};

export default async function ArenaRoomPage({ params }: ArenaRoomPageProps) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z0-9]{5}$/.test(code)) notFound();
  await requireChatGPTUser(`/arena/${code}`);
  return <ArenaRoom code={code} />;
}
