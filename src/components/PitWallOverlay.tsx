"use client";

import React from "react";
import { motion } from "motion/react";

export default function PitWallOverlay() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[100] mix-blend-screen overflow-hidden">
      {/* Heavy Film Grain */}
      <div 
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* CRT Scanlines */}
      <div 
        className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))]"
        style={{
          backgroundSize: "100% 4px, 6px 100%",
        }}
      />

      {/* Edge Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.6)_100%)] opacity-80" />

      {/* Subtle Chromatic Aberration Overlay (Red & Cyan split on edges) */}
      <div className="absolute inset-0 shadow-[inset_4px_0_10px_rgba(255,0,0,0.1),inset_-4px_0_10px_rgba(0,255,255,0.1)] opacity-50" />
    </div>
  );
}
