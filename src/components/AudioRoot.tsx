"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { AudioProvider } from "@/components/AudioProvider";
import NowPlaying from "@/components/NowPlaying";

export default function AudioRoot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AudioProvider>
      {children}
      {pathname !== "/login" && <NowPlaying />}
    </AudioProvider>
  );
}
