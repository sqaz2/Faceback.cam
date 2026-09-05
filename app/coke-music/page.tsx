import type { Metadata } from "next";
import { CokeMusicPlace } from "./place-client";

export const metadata: Metadata = {
  title: "Coke Music · FACEBACK.CAM",
  description: "Enter the Coke Music listening rooms on FACEBACK.CAM.",
};

export default function CokeMusicPage() {
  return <CokeMusicPlace />;
}
