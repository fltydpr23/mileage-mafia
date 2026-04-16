"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";

interface Runner {
    name: string;
    yearlyKm: number;
    completion: number;
    rank: number;
    weeklyTarget: number;
    annualTarget: number;
    runHistory: any[];
}

interface IsometricTrackProps {
    runners: Runner[];
}

export default function IsometricTrack({ runners }: IsometricTrackProps) {
    // We'll take the top 10 runners for the track to keep it clean
    const trackRunners = useMemo(() => runners.slice(0, 10), [runners]);

    // Define a simple winding path in a 400x400 space
    // This will be transformed isometrically
    const pathData = "M 50,350 C 50,200 150,200 150,350 C 150,500 250,500 250,350 C 250,200 350,200 350,350";

    // Total length of the path (approximate for SVG)
    // We'll use a simple linear interpolation for completion -> path position
    // for a more "accurate" feel, though exact SVG path length mapping is complex in CSS only.

    return (
        <div className="relative w-full overflow-hidden py-20 px-4 sm:px-10 bg-neutral-900/20 rounded-[2.5rem] ring-1 ring-white/5 backdrop-blur-sm">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.05),transparent_70%)]" />

            <div className="flex items-center gap-3 mb-12 relative z-10 px-4">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                <h2 className="text-[11px] font-bold tracking-widest uppercase text-neutral-400 italic">Sector Trace // Tactical View</h2>
            </div>

            <div className="relative h-[400px] w-full flex items-center justify-center perspective-[1000px]">
                {/* Isometric Container */}
                <div
                    className="relative w-[600px] h-[600px] transition-transform duration-1000"
                    style={{
                        transform: "rotateX(60deg) rotateZ(-35deg)",
                        transformStyle: "preserve-3d"
                    }}
                >
                    {/* Grid Background */}
                    <div className="absolute inset-0 border border-emerald-500/10 [background-image:linear-gradient(to_right,rgba(16,185,129,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.05)_1px,transparent_1px)] [background-size:40px_40px] pointer-events-none" />

                    {/* SVG Path */}
                    <svg
                        viewBox="0 0 400 400"
                        className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
                        style={{ filter: "drop-shadow(0 0 10px rgba(16,185,129,0.3))" }}
                    >
                        <path
                            d={pathData}
                            fill="none"
                            stroke="rgba(16, 185, 129, 0.2)"
                            strokeWidth="12"
                            strokeLinecap="round"
                        />
                        <path
                            d={pathData}
                            fill="none"
                            stroke="rgba(16, 185, 129, 0.4)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeDasharray="4 8"
                        />
                    </svg>

                    {/* Markers (Runners) */}
                    {trackRunners.map((runner, idx) => {
                        // Find max completion to normalize progress for better visualization
                        const maxCompletion = Math.max(...trackRunners.map(r => r.completion), 0.1);

                        // Use relative progress (0 to 1) normalized against the leader
                        // This ensures they are spread along the track even if everyone has low %
                        const relativeProgress = runner.completion / maxCompletion;

                        // Map relativeProgress (0-1) to X and Y along the winding path
                        // We'll use a more aggressive winding to match the visual better
                        const progress = relativeProgress;

                        // X: 50 -> 350
                        const x = 50 + progress * 300;
                        // Y: starts at bottom (350) and winds up with sine waves
                        const y = 350 - progress * 300 + Math.sin(progress * Math.PI * 2) * 60;

                        // Add a small randomized offset based on rank to prevent perfect overlapping 
                        // of runners with identical completion
                        const offset = (idx * 4) % 12 - 6;

                        const isTop = idx === 0;

                        return (
                            <motion.div
                                key={runner.name}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{
                                    opacity: 1,
                                    scale: 1,
                                    x: `${((x + offset) / 400) * 100}%`,
                                    y: `${((y + offset) / 400) * 100}%`
                                }}
                                transition={{ delay: idx * 0.1, duration: 1.5, ease: "circOut" }}
                                className="absolute"
                                style={{
                                    left: 0,
                                    top: 0,
                                    transformStyle: "preserve-3d"
                                }}
                            >
                                {/* 3D Puck / Marker */}
                                <div className="relative -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
                                    {/* Vertical Beam */}
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-[1px] h-12 bg-gradient-to-t from-emerald-500/80 to-transparent" />

                                    {/* Floating Tag */}
                                    <div className="absolute -top-20 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg whitespace-nowrap pointer-events-none"
                                        style={{ transform: "rotateZ(35deg) rotateX(-60deg) translateY(-20px)" }}
                                    >
                                        <p className="text-white text-[10px] font-bold tracking-tight">{runner.name}</p>
                                        <p className="text-emerald-400 text-[9px] font-medium uppercase tracking-widest">{runner.yearlyKm} KM</p>
                                    </div>

                                    {/* Puck Base */}
                                    <div className={`w-8 h-8 rounded-full border-2 bg-black flex items-center justify-center text-[10px] font-black tracking-tighter transition-all duration-300 group-hover:scale-125
                    ${isTop
                                            ? "border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] text-emerald-400"
                                            : "border-white/20 text-white/50"
                                        }`}
                                    >
                                        {idx + 1}
                                    </div>

                                    {/* Pulsing Shadow under puck */}
                                    <div className={`absolute -inset-4 rounded-full blur-xl -z-10 transition-opacity duration-300
                    ${isTop ? "bg-emerald-500/20 opacity-100" : "bg-white/5 opacity-0 group-hover:opacity-100"}`}
                                    />
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-8 px-4 flex justify-between items-end border-t border-white/5 pt-6">
                <div>
                    <p className="text-neutral-500 text-[9px] font-black uppercase tracking-[0.2em] mb-1">Navigation System</p>
                    <p className="text-white/60 text-xs font-medium">Trajectory view based on annual completion data.</p>
                </div>
                <div className="text-right">
                    <p className="text-neutral-500 text-[9px] font-black uppercase tracking-[0.2em] mb-1">Current Sector</p>
                    <p className="text-emerald-400 text-xs font-bold font-mono tracking-wider">TH-04 // ACTIVE</p>
                </div>
            </div>
        </div>
    );
}
