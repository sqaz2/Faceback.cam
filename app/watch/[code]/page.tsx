import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpectatorRoom } from "../watch-client";

type WatchPageProps = {
  params: Promise<{ code: string }>;
};

export const metadata: Metadata = {
  title: "Watch Creative Arena",
  description: "Watch a FACEBACK.CAM creative match live without joining the room.",
};

export default async function WatchPage({ params }: WatchPageProps) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z0-9]{5}$/.test(code)) notFound();
  return <SpectatorRoom code={code} />;
}
