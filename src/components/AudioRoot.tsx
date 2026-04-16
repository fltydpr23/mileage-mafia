"use client";

import React from "react";
import { AudioProvider } from "@/components/AudioProvider";

export default function AudioRoot({ children }: { children: React.ReactNode }) {
  return (
    <AudioProvider>
      {children}
    </AudioProvider>
  );
}
