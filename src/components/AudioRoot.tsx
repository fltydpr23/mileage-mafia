"use client";

import React from "react";
import { AudioProvider } from "@/components/AudioProvider";

import NowPlaying from "@/components/NowPlaying";

export default function AudioRoot({ children }: { children: React.ReactNode }) {
  return (
    <AudioProvider>
      {children}
      {/* Mobile Music Player (centered bottom pill on mobile) */}
      <div className="fixed bottom-4 left-0 right-0 z-[100] sm:hidden flex justify-center items-center pointer-events-none">
          <div className="pointer-events-auto bg-black/80 backdrop-blur-2xl border border-white/10 rounded-full p-1 shadow-2xl flex items-center justify-center">
              <NowPlaying />
          </div>
      </div>
    </AudioProvider>
  );
}
