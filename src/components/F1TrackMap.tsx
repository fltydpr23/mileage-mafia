"use client";

import React, { useEffect, useRef, useState } from "react";

interface Runner {
    name: string;
    yearlyKm: number;
    completion: number;
    rank: number;
    weeklyTarget: number;
    annualTarget: number;
    runHistory: any[];
}

interface F1TrackMapProps {
    runners: Runner[];
    fullNames: Record<string, string>;
    activeRunner?: string;
    hoveredRunner?: string;
    onRunnerSelect?: (name: string) => void;
}

// ─── SVG Circuit path (abstract oval with chicane) ───────────────────────────
const CIRCUIT_PATH = `
  M 200,270
  L 100,270
  C 60,270 45,245 45,210
  L 45,110
  C 45,70 70,45 110,45
  L 170,45
  C 195,45 205,60 205,80
  L 205,110
  C 205,140 220,150 245,150
  L 285,150
  C 310,150 320,135 320,110
  L 320,70
  C 320,50 340,35 365,45
  L 435,75
  C 465,90 475,120 450,150
  L 405,210
  C 385,240 355,270 315,270
  L 255,270
  C 235,270 225,255 225,235
  L 225,210
  C 225,190 210,180 190,180
  C 170,180 160,195 160,215
  C 160,245 175,270 200,270
  Z
`;

function getRunnerColor(nameKey: string) {
    if (nameKey === "Adhi") return "#ef4444";
    if (["SD", "Raja", "Bhat", "Sanjay"].includes(nameKey)) return "#10b981";
    if (["Boba", "Kushal", "Sai"].includes(nameKey)) return "#3b82f6";
    if (["Kumar", "Loaf", "Rishi"].includes(nameKey)) return "#eab308";
    return "#ffffff";
}

export default function F1TrackMap({ runners, fullNames, activeRunner, hoveredRunner, onRunnerSelect }: F1TrackMapProps) {
    const pathRef = useRef<SVGPathElement>(null);
    const [points, setPoints] = useState<{name: string, x: number, y: number}[]>([]);

    useEffect(() => {
        if (!pathRef.current) return;
        const totalLen = pathRef.current.getTotalLength();
        
        // Spread runners along the track based on rank (1st place at 95%, last place at 5%)
        const newPoints = runners.map((r, i) => {
            // Add a small bit of separation logic if multiple runners have same rank/km
            // but for simplicity, we just distribute linearly based on index if ranks tie
            // Actually, best to just use rank (or relative index to avoid overlaps).
            const relativeT = Math.max(0.02, 0.98 - ((i) * (0.96 / Math.max(1, runners.length - 1))));
            const pt = pathRef.current!.getPointAtLength(relativeT * totalLen);
            return {
                name: r.name,
                x: pt.x,
                y: pt.y
            };
        });
        setPoints(newPoints);
    }, [runners]);

    return (
        <div className="relative w-full h-full flex items-center justify-center p-4 lg:p-12">
            <svg viewBox="0 0 500 300" className="w-full h-full overflow-visible" style={{ filter: "drop-shadow(0 0 30px rgba(0,0,0,0.5))" }}>
                {/* Track Base */}
                <path d={CIRCUIT_PATH} fill="none" stroke="#0a0a0a" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
                <path d={CIRCUIT_PATH} fill="none" stroke="#1a1a1a" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                {/* Holographic Centerline */}
                <path 
                    d={CIRCUIT_PATH} 
                    fill="none" 
                    stroke="#00f3ff" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeDasharray="1 12" 
                    className="opacity-50"
                    style={{ filter: "drop-shadow(0 0 4px #00f3ff)" }} 
                />
                
                {/* The actual invisible path for measuring length */}
                <path ref={pathRef} d={CIRCUIT_PATH} fill="none" className="invisible" />

                {/* Runners */}
                {points.map((pt) => {
                    const r = runners.find(x => x.name === pt.name);
                    if (!r) return null;
                    const isActive = activeRunner === pt.name;
                    const isHovered = hoveredRunner === pt.name;
                    const color = getRunnerColor(pt.name);
                    
                    return (
                        <g 
                            key={pt.name} 
                            style={{ 
                                transform: `translate(${pt.x}px, ${pt.y}px)`, 
                                transition: "all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
                                cursor: "pointer" 
                            }}
                            onClick={() => onRunnerSelect?.(pt.name)}
                        >
                            {/* Oversized touch target for mobile */}
                            <circle r={40} fill="transparent" />
                            
                            {/* Pulse background for active runner */}
                            {isActive && (
                                <circle 
                                    r={20} 
                                    fill={color} 
                                    opacity="0.3" 
                                    className="animate-ping"
                                    style={{ filter: `drop-shadow(0 0 10px ${color})` }}
                                />
                            )}
                            
                            {/* Outer Ring */}
                            <circle 
                                r={isActive ? 8 : (isHovered ? 6 : 5)} 
                                fill="#000" 
                                stroke={color}
                                strokeWidth={isActive ? 3 : 2}
                                className="transition-all duration-300"
                                style={{
                                    filter: isActive ? `drop-shadow(0 0 10px ${color})` : "none"
                                }}
                            />
                            
                            {/* Inner Dot */}
                            <circle 
                                r={isActive ? 3 : 2} 
                                fill={color} 
                                className="transition-all duration-300"
                            />
                            
                            {/* Name Label */}
                            <text
                                y={-16}
                                x={0}
                                textAnchor="middle"
                                fill={isActive ? "#fff" : "#999"}
                                fontSize={isActive ? "18px" : "13px"}
                                fontWeight="900"
                                className="font-mono tracking-widest transition-all duration-300 pointer-events-none select-none"
                                style={{
                                    textShadow: "0px 4px 8px rgba(0,0,0,1)",
                                    opacity: isActive || isHovered ? 1 : 0.5
                                }}
                            >
                                {pt.name.substring(0,3).toUpperCase()}
                            </text>
                            
                            {/* Extra Detail Tag for Active Runner */}
                            {isActive && (
                                <g transform="translate(0, 24)">
                                    {/* Holographic backdrop */}
                                    <rect x="-50" y="0" width="100" height="22" fill="#000" fillOpacity="0.8" rx="4" stroke={color} strokeWidth="1" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
                                    <text x="0" y="15" textAnchor="middle" fill="#fff" fontSize="11px" className="font-mono font-bold pointer-events-none select-none tracking-wider">
                                        P{r.rank} · {r.yearlyKm.toFixed(0)}KM
                                    </text>
                                </g>
                            )}
                        </g>
                    );
                })}
            </svg>
            
            {/* Minimalist Hint Overlay */}
            {!activeRunner && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-none opacity-40">
                    <span className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-white">
                        SELECT RUNNER
                    </span>
                </div>
            )}
        </div>
    );
}
