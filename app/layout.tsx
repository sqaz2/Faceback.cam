import type { Metadata } from "next";
import "./globals.css";
import "./arena.css";
import "./arena-modes.css";
import "./arena-match.css";
import "./arena-public.css";

export const metadata: Metadata = {
  title: {
    default: "FACEBACK.CAM — Creators And Machines",
    template: "%s · FACEBACK.CAM",
  },
  description:
    "A creator-led home for people who use AI, make things with it, and challenge the logic behind the anti-AI backlash.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
