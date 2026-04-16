"use client";

import React, { useEffect, useState } from "react";
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

interface KatanaTrackViewProps {
    runners: Runner[];
    activeRunner: Runner | null;
    hoveredRunner: Runner | null;
}

// Sprite mapping
const SPRITE_MAP: Record<string, string> = {
    "loaf": "/images/runners/sprite-loaf.png",
    "sd":   "/images/runners/sprite-sd.png",
    "bhat": "/images/runners/sprite-bhat.png",
    "boba": "/images/runners/sprite-boba.png",
};
const getSprite = (name: string) => SPRITE_MAP[name.toLowerCase()] ?? SPRITE_MAP["loaf"];

const RANK_COLORS = ["#FFD700","#E8E8E8","#CD7F32","#00f5ff","#ff2d9b","#A3FF75","#FFA07A","#ff6b6b","#f9ca24","#6ab04c","#a29bfe"];

const SECTORS = [
    { pct: 25,  label: "S I",   color: "#34d399" },
    { pct: 50,  label: "S II",  color: "#a78bfa" },
    { pct: 75,  label: "S III", color: "#60a5fa" },
    { pct: 100, label: "FINISH", color: "#FFD700" },
];

// ── Layout constants (viewBox 1920×600) ──
const VW = 1920, VH = 600;
// The sidebar covers first ~320px, so road starts after it
const GROUND_Y   = 350;   // very top of the road region
const ROAD_TOP   = 360;
const ROAD_BOT   = 520;
const ROAD_H     = ROAD_BOT - ROAD_TOP;   // 160px — very visible
const CENTRE_Y   = (ROAD_TOP + ROAD_BOT) / 2;
// Track X range — starts just past the sidebar
const TRACK_X0   = 420;   // past the 320px sidebar
const TRACK_X1   = VW - 60;

export default function KatanaTrackView({ runners, activeRunner, hoveredRunner }: KatanaTrackViewProps) {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick(t => (t + 1) % 6), 200);
        return () => clearInterval(id);
    }, []);

    const getRunnerX = (pct: number) =>
        TRACK_X0 + (TRACK_X1 - TRACK_X0) * (Math.min(pct, 100) / 100);

    return (
        <div className="absolute inset-0 overflow-hidden select-none" style={{ background: "#080415" }}>
            {/* ─── FULL-SCREEN SVG SCENE ─── */}
            <svg
                viewBox={`0 0 ${VW} ${VH}`}
                className="absolute inset-0 w-full h-full"
                style={{ imageRendering: "pixelated" }}
                preserveAspectRatio="xMidYMid slice"
            >
                <defs>
                    <filter id="glow-pink">
                        <feGaussianBlur stdDeviation="6" result="blur"/>
                        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
                    </filter>
                    <filter id="glow-cyan">
                        <feGaussianBlur stdDeviation="5" result="blur"/>
                        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
                    </filter>
                    <filter id="glow-gold">
                        <feGaussianBlur stdDeviation="4" result="blur"/>
                        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
                    </filter>
                </defs>

                {/* ──────── SKY ──────── */}
                <rect x="0" y="0" width={VW} height={GROUND_Y} fill="#0f0620" />
                {/* Sky gradient bands */}
                <rect x="0" y="0" width={VW} height="80" fill="rgba(30,10,60,0.6)" />
                <rect x="0" y={GROUND_Y - 120} width={VW} height="120" fill="rgba(100,20,80,0.25)" />
                <rect x="0" y={GROUND_Y - 40} width={VW} height="40" fill="rgba(0,0,0,0.6)" />

                {/* ──────── CITY BUILDINGS ──────── */}
                {/* Layer 1: Far (small, low opacity) */}
                {[100,250,380,510,640,790,940,1060,1190,1330,1460,1590,1720,1840].map((bx, i) => {
                    const h = [90,130,70,160,100,140,110,80,150,90,120,75,160,85][i] ?? 100;
                    const w = [45,65,40,70,55,80,50,40,65,50,70,38,72,48][i] ?? 50;
                    return <rect key={"fb"+bx} x={bx} y={GROUND_Y - h - 60} width={w} height={h + 64}
                        fill={i%2===0 ? "#120830" : "#1a0f3d"} />;
                })}

                {/* Layer 2: Close buildings (taller, more detail) */}
                {[60,180,290,440,600,750,900,1040,1200,1350,1480,1620,1760,1900].map((bx, i) => {
                    const h = [150,200,120,260,160,220,180,140,240,155,200,130,270,160][i] ?? 160;
                    const w = [55,80,50,95,65,90,60,50,85,60,85,50,95,65][i] ?? 60;
                    const fill = i%3===0 ? "#0d0625" : i%3===1 ? "#160a35" : "#0f0828";
                    return <g key={"b"+bx}>
                        <rect x={bx} y={GROUND_Y - h} width={w} height={h} fill={fill} />
                        {/* Windows */}
                        {[0,1,2,3].map(wr =>
                            [0,1].map(wc => (
                                <rect key={`w${bx}${wr}${wc}`}
                                    x={bx + 8 + wc*22} y={GROUND_Y - h + 20 + wr * 32}
                                    width="12" height="10"
                                    fill={tick % 6 === (i+wr) % 6 ? (i%2===0 ? "#ff2d9b" : "#00f5ff") : "#1a0a40"}
                                    opacity="0.7" />
                            ))
                        )}
                    </g>;
                })}

                {/* ──────── NEON HORIZONTAL SIGNS ──────── */}
                {[
                    [120, 260, 80, "#ff2d9b", "glow-pink"],
                    [250, 220, 90, "#00f5ff", "glow-cyan"],
                    [430, 270, 60, "#a855f7", "glow-pink"],
                    [630, 230, 100, "#ff2d9b", "glow-pink"],
                    [800, 185, 85, "#00f5ff", "glow-cyan"],
                    [1000, 245, 70, "#FFD700", "glow-gold"],
                    [1180, 195, 80, "#a855f7", "glow-pink"],
                    [1360, 210, 90, "#00f5ff", "glow-cyan"],
                    [1530, 185, 95, "#ff2d9b", "glow-pink"],
                    [1660, 175, 100, "#00f5ff", "glow-cyan"],
                    [1830, 200, 70, "#a855f7", "glow-pink"],
                ].map(([nx, ny, nw, nc, nf]) => (
                    <rect key={String(nx)} x={Number(nx)} y={Number(ny)} width={Number(nw)} height={5}
                        fill={String(nc)} opacity="0.9" filter={`url(#${String(nf)})`} />
                ))}

                {/* ──────── GROUND STRIP ──────── */}
                {/* Transition between buildings and road */}
                <rect x="0" y={GROUND_Y} width={VW} height={ROAD_TOP - GROUND_Y} fill="#050208" />

                {/* ──────── THE ROAD ──────── */}
                {/* Main asphalt — high contrast medium-grey so sprites stand out */}
                <rect x="0" y={ROAD_TOP} width={VW} height={ROAD_H} fill="#232232" />

                {/* Road surface texture: alternating lighter/darker bands */}
                {Array.from({ length: 8 }).map((_, i) => (
                    <rect key={"band"+i} x="0" y={ROAD_TOP + i*(ROAD_H/8)} width={VW} height={ROAD_H/8 - 1}
                        fill={i%2===0 ? "#292840" : "#1f1e30"} />
                ))}

                {/* TOP curb — bright neon pink */}
                <rect x="0" y={ROAD_TOP} width={VW} height="8" fill="#ff2d9b" />
                <rect x="0" y={ROAD_TOP} width={VW} height="4" fill="#ff2d9b" opacity="0.6" filter="url(#glow-pink)" />

                {/* BOTTOM curb — bright neon cyan */}
                <rect x="0" y={ROAD_BOT - 8} width={VW} height="8" fill="#00f5ff" />
                <rect x="0" y={ROAD_BOT - 4} width={VW} height="4" fill="#00f5ff" opacity="0.6" filter="url(#glow-cyan)" />

                {/* Centre dashed line */}
                {Array.from({ length: 32 }).map((_, i) => (
                    <rect key={"dl"+i} x={i * 68} y={CENTRE_Y - 4} width="44" height="8" fill="rgba(255,255,255,0.12)" />
                ))}

                {/* ──────── START LINE (chequered) ──────── */}
                {Array.from({ length: 10 }).map((_, row) =>
                    Array.from({ length: 2 }).map((_, col) => (
                        <rect key={`start-${row}-${col}`}
                            x={TRACK_X0 - 20 + col * 12} y={ROAD_TOP + row * (ROAD_H / 10)}
                            width="12" height={ROAD_H / 10}
                            fill={(row + col) % 2 === 0 ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)"} />
                    ))
                )}
                <text x={TRACK_X0 - 8} y={ROAD_TOP - 14}
                    fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="monospace" fontWeight="900">
                    START
                </text>

                {/* ──────── SECTOR CHECKPOINTS ──────── */}
                {SECTORS.map(gate => {
                    const gx = getRunnerX(gate.pct);
                    return (
                        <g key={gate.pct}>
                            {/* Vertical line through the road */}
                            <rect x={gx - 1} y={ROAD_TOP} width="3" height={ROAD_H}
                                fill={gate.color} opacity="0.4" />
                            {/* Flag pole */}
                            <rect x={gx - 2} y={ROAD_TOP - 80} width="4" height="80"
                                fill={gate.color} opacity="0.95" />
                            {/* Flag banner */}
                            <rect x={gx - 2} y={ROAD_TOP - 88} width="48" height="22"
                                fill={gate.color} />
                            <text x={gx + 22} y={ROAD_TOP - 73} textAnchor="middle"
                                fill="#000" fontSize="9" fontFamily="monospace" fontWeight="900">
                                {gate.label}
                            </text>
                        </g>
                    );
                })}

                {/* ──────── RUNNER SPRITES ──────── */}
                {[...runners].sort((a, b) => (b.rank ?? 99) - (a.rank ?? 99)).map((runner, i) => {
                    const isActive = activeRunner?.name === runner.name;
                    const isHovered = hoveredRunner?.name === runner.name;
                    const rx = getRunnerX(runner.completion);
                    const rankColor = RANK_COLORS[(runner.rank - 1) % RANK_COLORS.length] ?? "#7EC8E3";

                    // Vertical lane: distribute runners evenly within road height
                    const laneCount = Math.min(runners.length, 4);
                    const laneIdx = i % laneCount;
                    const laneH = ROAD_H / laneCount;
                    const spriteH = isActive ? 96 : isHovered ? 88 : 76;
                    const spriteW = spriteH;
                    const spriteY = ROAD_TOP + laneIdx * laneH + (laneH - spriteH) / 2;
                    // Always place within visible track, never behind the sidebar
                    const minX = TRACK_X0;
                    const spriteX = Math.max(minX, runner.completion > 96 ? rx - spriteW - 4 : rx - spriteW / 2);

                    return (
                        <g key={runner.name}>
                            {/* Neon ground glow */}
                            <ellipse cx={spriteX + spriteW / 2} cy={ROAD_BOT - 4}
                                rx={spriteW * 0.4} ry="6"
                                fill={rankColor} opacity={isActive ? 0.45 : 0.15}
                                filter="url(#glow-pink)" />

                            {/* Sprite */}
                            <image
                                href={getSprite(runner.name)}
                                x={spriteX} y={spriteY}
                                width={spriteW} height={spriteH}
                                style={{ imageRendering: "pixelated" }}
                                opacity={isActive ? 1 : isHovered ? 0.95 : 0.8}
                            />

                            {/* Rank chip — painted above sprite */}
                            <rect x={spriteX} y={spriteY - 18} width="22" height="16"
                                fill="#000" stroke={rankColor} strokeWidth="2" />
                            <text x={spriteX + 11} y={spriteY - 6}
                                textAnchor="middle" fill={rankColor}
                                fontSize="9" fontFamily="monospace" fontWeight="900">
                                #{runner.rank}
                            </text>

                            {/* Name tooltip for active/hovered */}
                            {(isActive || isHovered) && (
                                <g>
                                    <rect x={spriteX - 2} y={spriteY - 34}
                                        width={runner.name.length * 7 + 12} height="16"
                                        fill="#000" stroke={rankColor} strokeWidth="1" />
                                    <text x={spriteX + 4} y={spriteY - 22}
                                        fill={rankColor} fontSize="9"
                                        fontFamily="monospace" fontWeight="900">
                                        {runner.name.toUpperCase()}
                                    </text>
                                </g>
                            )}
                        </g>
                    );
                })}

                {/* ──────── GROUND (below road) ──────── */}
                <rect x="0" y={ROAD_BOT} width={VW} height={VH - ROAD_BOT} fill="#050208" />
                {/* Ground tile pattern */}
                {Array.from({ length: 48 }).map((_, i) => (
                    <rect key={"gt"+i} x={i * 40} y={ROAD_BOT + 8} width="40" height="12"
                        fill={i%2===0 ? "#0e0b1e" : "#09071a"} />
                ))}
            </svg>

            {/* ─── CRT SCANLINES ─── */}
            <div className="absolute inset-0 pointer-events-none z-10" style={{
                backgroundImage: `repeating-linear-gradient(
                    0deg,
                    rgba(0,0,0,0.35) 0px,
                    rgba(0,0,0,0.35) 1px,
                    transparent 1px,
                    transparent 4px
                )`,
            }} />

            {/* ─── RGB FRINGE (VHS) ─── */}
            <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.03] mix-blend-screen"
                style={{ background: "linear-gradient(90deg,#f00 0%,transparent 2%,transparent 98%,#00f 100%)" }} />

            {/* ─── BOTTOM MINI-PROGRESS BAR ─── */}
            <div className="absolute bottom-0 left-0 right-0 h-5 z-20 flex items-center gap-1 px-3"
                style={{ background: "#000", borderTop: "2px solid #a855f7" }}>
                {[...runners].sort((a,b) => a.rank - b.rank).map((r, i) => {
                    const rankColor = RANK_COLORS[i % RANK_COLORS.length];
                    return (
                        <div key={r.name} className="flex items-center gap-0.5 shrink-0">
                            <span className="text-[6px] font-mono uppercase" style={{ color: rankColor }}>
                                {r.name}
                            </span>
                            <div className="h-[6px] w-[50px] bg-[#111]" style={{ border: `1px solid ${rankColor}40` }}>
                                <div className="h-full" style={{ width: `${r.completion}%`, background: rankColor }} />
                            </div>
                            <span className="text-[6px] font-mono text-neutral-600">{r.completion.toFixed(0)}%</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
