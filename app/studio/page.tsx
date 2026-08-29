import type { Metadata } from "next";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import StudioClient from "./studio-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Creator studio",
  description: "Build and manage your FACEBACK.CAM creator page.",
};

export default function StudioPage() {
  return <AuthenticatedStudio />;
}

async function AuthenticatedStudio() {
  const user = await requireChatGPTUser("/studio");
  return (
    <StudioClient
      user={{ displayName: user.displayName, email: user.email }}
      signOutHref={chatGPTSignOutPath("/")}
    />
  );
}
