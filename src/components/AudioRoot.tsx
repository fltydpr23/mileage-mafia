"use client";

import React from "react";
import { AudioProvider } from "@/components/AudioProvider";
import NowPlaying from "@/components/NowPlaying";

export default function AudioRoot({ children }: { children: React.ReactNode }) {
  return (
    <AudioProvider>
      {children}
      <NowPlaying />
    </AudioProvider>
  );
}
