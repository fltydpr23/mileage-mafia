"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";

interface Runner {
    name: string;
    yearlyKm: number;
    completion: number;
    rank: number;
    weeklyTarget: number;
    annualTarget: number;
    runHistory: any[];
}

interface KatanaLeaderboardPanelProps {
    runners: Runner[];
    globalStats: {
        totalRunners: number;
        totalKm: number;
        totalTargetKm: number;
        totalPot: number;
        oathPot: number;
        penaltyFund: number;
        isManual?: boolean;
    };
    activeRunner: Runner | null;
    setActiveRunner: (r: Runner | null) => void;
    hoveredRunner: Runner | null;
    setHoveredRunner: (r: Runner | null) => void;
    povHold: boolean;
}

const SPRITE_MAP: Record<string, string> = {
    "loaf":   "/images/runners/sprite-loaf.png",
    "sd":     "/images/runners/sprite-sd.png",
    "bhat":   "/images/runners/sprite-bhat.png",
    "boba":   "/images/runners/sprite-boba.png",
};
const getSprite = (name: string) => SPRITE_MAP[name.toLowerCase()] ?? SPRITE_MAP["loaf"];

const RANK_LABELS = ["", "UNDERBOSS", "CAPO", "SOLDIER", "ASSOCIATE"];
const RANK_COLORS = ["", "#FFD700", "#C0C0C0", "#CD7F32", "#7EC8E3"];

function fmtKm(n: number) {
    if (!Number.isFinite(n)) return "0";
    return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1);
}

function getSector(pct: number) {
    if (pct < 25) return { label: "SECTOR I",   color: "#34d399" };
    if (pct < 50) return { label: "SECTOR II",  color: "#a78bfa" };
    if (pct < 75) return { label: "SECTOR III", color: "#60a5fa" };
    return { label: "SECTOR IV", color: "#FFD700" };
}

// 8-bit pixel border CSS
const PIXEL_BORDER = `
    box-shadow:
        0 -2px 0 0 #000,
        0 2px 0 0 #000,
        -2px 0 0 0 #000,
        2px 0 0 0 #000;
`;

export default function KatanaLeaderboardPanel({
    runners,
    globalStats,
    activeRunner,
    setActiveRunner,
    hoveredRunner,
    setHoveredRunner,
    povHold,
}: KatanaLeaderboardPanelProps) {
    const sorted = [...runners].sort((a, b) => (a.rank || 99) - (b.rank || 99));

    return (
        <motion.div
            className="absolute inset-0 z-10 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: povHold ? 0 : 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
        >
            {/* ─── SIDEBAR ─── */}
            <motion.div
                className="absolute left-0 top-[72px] bottom-[2rem] w-[320px] flex flex-col pointer-events-auto overflow-hidden"
                style={{ imageRendering: "pixelated" }}
                initial={{ x: -340 }}
                animate={{ x: povHold ? -340 : 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }} // staccato 8-bit slide
            >
                {/* Pixel-art frame */}
                <div className="absolute inset-0 border-2 border-r-4 pointer-events-none z-20"
                    style={{ borderColor: "#a855f7", boxShadow: "inset 0 0 0 2px #000, 0 0 16px rgba(168,85,247,0.5)" }} />

                <div className="absolute inset-0" style={{ background: "rgba(5,2,14,0.96)" }} />

                {/* Header */}
                <div className="relative z-10 px-3 py-2 border-b-2 border-purple-600 flex items-center justify-between"
                    style={{ background: "#0f0826" }}>
                    <div>
                        <div className="text-[8px] text-purple-400 font-mono tracking-[0.3em]">// MILEAGE MAFIA //</div>
                        <div className="text-white font-mono font-black text-sm tracking-wide" style={{ textShadow: "2px 2px 0 #7c3aed" }}>
                            NEO_SYNDICATE
                        </div>
                        <div className="text-[7px] font-mono text-cyan-400 tracking-widest mt-0.5">TARGETS_LIST.EXE</div>
                    </div>
                    <div className="text-2xl animate-pulse" style={{ imageRendering: "pixelated" }}>⚔</div>
                </div>

                {/* Stats row */}
                <div className="relative z-10 flex text-center text-[8px] font-mono border-b border-purple-900 divide-x divide-purple-900"
                    style={{ background: "#080516" }}>
                    <div className="flex-1 py-2">
                        <div className="text-purple-500">KM_TOTAL</div>
                        <div className="text-yellow-400 font-black">{fmtKm(globalStats.totalKm)}</div>
                    </div>
                    <div className="flex-1 py-2">
                        <div className="text-purple-500">CONTRACT</div>
                        <div className="text-cyan-400 font-black">¥{globalStats.totalPot.toLocaleString()}</div>
                    </div>
                    <div className="flex-1 py-2">
                        <div className="text-purple-500">RUNNERS</div>
                        <div className="text-white font-black">{globalStats.totalRunners}</div>
                    </div>
                </div>

                {/* Runner list */}
                <div className="relative z-10 flex-1 overflow-y-auto px-2 py-2 space-y-2"
                    style={{ scrollbarWidth: "none" }}>
                    {sorted.map((runner, i) => {
                        const isActive = activeRunner?.name === runner.name;
                        const isHovered = hoveredRunner?.name === runner.name;
                        const sector = getSector(runner.completion);
                        const rankColor = RANK_COLORS[Math.min(runner.rank, 4)] ?? "#7EC8E3";
                        const label = RANK_LABELS[Math.min(runner.rank, 4)] ?? "ASSOCIATE";

                        // Gap to previous runner (battle)
                        const above = sorted[i - 1];
                        const gapKm = above
                            ? Math.max(0, (above.completion / 100) * above.annualTarget - runner.yearlyKm)
                            : null;

                        return (
                            <motion.button
                                key={runner.name}
                                className="w-full text-left relative"
                                initial={{ x: -40, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: i * 0.06, duration: 0.15, ease: "linear" }}
                                onClick={() => setActiveRunner(isActive ? null : runner)}
                                onMouseEnter={() => setHoveredRunner(runner)}
                                onMouseLeave={() => setHoveredRunner(null)}
                            >
                                {/* Pixel-art card */}
                                <div style={{
                                    background: isActive ? "#1a0a3e" : "#0d0820",
                                    border: `2px solid ${isActive ? rankColor : "#2d1b69"}`,
                                    boxShadow: isActive ? `0 0 12px ${rankColor}60, inset 0 0 0 1px #000` : "inset 0 0 0 1px #000",
                                    imageRendering: "pixelated",
                                }}>
                                    <div className="flex gap-2 p-2">
                                        {/* Pixel Sprite */}
                                        <div className="relative w-14 h-14 shrink-0 border-2"
                                            style={{ border: `2px solid ${rankColor}80`, background: "#0a0618" }}>
                                            <Image
                                                src={getSprite(runner.name)}
                                                alt={runner.name}
                                                fill
                                                className="object-contain"
                                                style={{ imageRendering: "pixelated" }}
                                            />
                                            {/* Rank overlay chip */}
                                            <div className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[7px] font-black font-mono z-10"
                                                style={{ background: rankColor, color: "#000" }}>
                                                {runner.rank}
                                            </div>
                                        </div>

                                        {/* Data */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-1">
                                                <div className="text-white font-black font-mono text-[11px] tracking-wide truncate"
                                                    style={{ textShadow: `1px 1px 0 ${rankColor}` }}>
                                                    {runner.name.toUpperCase()}
                                                </div>
                                                <div className="text-[7px] font-mono shrink-0" style={{ color: rankColor }}>
                                                    {label}
                                                </div>
                                            </div>

                                            {/* Progress bar */}
                                            <div className="mt-1 h-2 border border-purple-800" style={{ background: "#04020d" }}>
                                                <div className="h-full transition-all"
                                                    style={{ width: `${runner.completion}%`, background: sector.color }} />
                                            </div>
                                            <div className="flex justify-between mt-0.5 font-mono text-[7px]">
                                                <span style={{ color: sector.color }}>{sector.label}</span>
                                                <span className="text-white">{fmtKm(runner.yearlyKm)} km</span>
                                            </div>

                                            {/* Battle gap */}
                                            {gapKm !== null && gapKm > 0 && (
                                                <div className="font-mono text-[7px] text-rose-400 mt-0.5">
                                                    ↑ -{fmtKm(gapKm)} to #{runner.rank - 1}
                                                </div>
                                            )}
                                            {runner.rank === 1 && (
                                                <div className="font-mono text-[7px] text-yellow-400 mt-0.5">♚ LEADING</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded section */}
                                    <AnimatePresence>
                                        {isActive && (
                                            <motion.div
                                                key="expanded"
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-2 pb-2 border-t border-purple-900 pt-2 space-y-1">
                                                    <div className="grid grid-cols-2 gap-1 font-mono text-[8px]">
                                                        <div style={{ background: "#080516", border: "1px solid #2d1b69", padding: "4px 6px" }}>
                                                            <div className="text-purple-500">ANNUAL_TGT</div>
                                                            <div className="text-white font-black">{fmtKm(runner.annualTarget)} km</div>
                                                        </div>
                                                        <div style={{ background: "#080516", border: "1px solid #2d1b69", padding: "4px 6px" }}>
                                                            <div className="text-purple-500">WEEKLY_TGT</div>
                                                            <div className="text-white font-black">{runner.weeklyTarget > 0 ? `${fmtKm(runner.weeklyTarget)} km` : "N/A"}</div>
                                                        </div>
                                                    </div>
                                                    <Link
                                                        href={`/runners/${runner.name.toLowerCase()}`}
                                                        className="block w-full text-center font-mono text-[9px] font-black py-1.5 mt-1 border-2 transition-all"
                                                        style={{ background: rankColor, color: "#000", border: `2px solid #000`, boxShadow: `3px 3px 0 ${rankColor}50` }}
                                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = "translate(2px,2px)"}
                                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = ""}
                                                    >
                                                        ▶ OPEN DOSSIER
                                                    </Link>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.button>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="relative z-10 px-3 py-2 border-t-2 border-purple-800 font-mono text-[7px] flex justify-between"
                    style={{ background: "#0f0826" }}>
                    <span className="text-purple-600">★ CLASSIFIED ★</span>
                    <span className="animate-pulse text-cyan-600">{globalStats.isManual ? "MANUAL_UPLINK" : "LIVE"}</span>
                </div>
            </motion.div>
        </motion.div>
    );
}
