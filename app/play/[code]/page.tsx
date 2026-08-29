import type { Metadata } from "next";
import { chatGPTSignOutPath, requireChatGPTUser } from "../../chatgpt-auth";
import RoomClient from "./room-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live Quickfire room",
  description: "Join a synchronized FACEBACK creative room.",
};

type RoomPageProps = {
  params: Promise<{ code: string }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;
  const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return <AuthenticatedRoom code={normalizedCode} />;
}

async function AuthenticatedRoom({ code }: { code: string }) {
  const user = await requireChatGPTUser(`/play/${code}`);
  return (
    <RoomClient
      code={code}
      userDisplayName={user.displayName}
      signOutHref={chatGPTSignOutPath("/play")}
    />
  );
}
