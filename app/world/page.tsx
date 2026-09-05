import type { Metadata } from "next";
import { CokeMusicPlace } from "./place-client";

export const metadata: Metadata = {
  title: "World · FACEBACK.CAM",
  description: "Enter the live creator world on FACEBACK.CAM.",
};

export default function WorldPage() {
  return <CokeMusicPlace />;
}
