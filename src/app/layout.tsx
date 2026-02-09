import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import AuthGate from "@/components/AuthGate";
import { AudioProvider } from "@/components/AudioProvider";
import Link from "next/link";
import NowPlaying from "@/components/NowPlaying";

const geistSans = Geist({
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mileage Mafia",
  description: "Mileage Mafia leaderboard + runner pages",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-neutral-950">
      <body className={`${geistSans.className} ${geistMono.variable} antialiased bg-neutral-950 text-white min-h-screen`}>
        <AudioProvider>
          <AuthGate>{children}</AuthGate>
        </AudioProvider>
      </body>
    </html>
  );
}
