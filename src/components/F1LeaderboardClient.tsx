"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Share_Tech_Mono } from "next/font/google";
import Link from "next/link";
import F1TrackMap from "./F1TrackMap";

const shareTech = Share_Tech_Mono({
    weight: "400",
    subsets: ["latin"],
});

interface Runner {
    name: string;
    yearlyKm: number;
    completion: number;
    rank: number;
    weeklyTarget: number;
    annualTarget: number;
    runHistory: any[];
}

interface F1LeaderboardClientProps {
    runners: Runner[];
    globalStats: any;
}

const FULL_NAMES: Record<string, string> = {
    "Sai": "Sai",
    "Loaf": "LOAF",
    "SD": "SD",
    "Adhi": "ADHI",
    "Kushal": "KUSHAL",
    "Raja": "RAJA",
    "Boba": "Boba",
    "Bhat": "Bhat",
    "Kumar": "KUMAR",
    "Sanjay": "SANJAY",
    "Rishi": "RISHI",
};

export default function F1LeaderboardClient({ runners, globalStats }: F1LeaderboardClientProps) {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [selectedRunner, setSelectedRunner] = useState<Runner | null>(runners[0] || null);

    useEffect(() => {
        const stored = sessionStorage.getItem("mm_pw_ok");
        if (!stored) {
            router.push("/");
        } else {
            setIsAuthenticated(true);
        }
    }, [router]);

    if (!isAuthenticated) return null; // Avoid flashing the dashboard

    return (
        <div className={`w-full h-screen bg-[#09090b] text-white flex flex-col overflow-hidden ${shareTech.className}`}>
            {/* TOP HEADER (Blood & Chrome) */}
            <header className="bg-zinc-950 flex flex-col md:flex-row md:items-center justify-between shadow-[0_4px_15px_-3px_rgba(220,38,38,0.2)] border-b border-red-600/50 z-20 relative px-4 py-2 md:h-16 shrink-0 gap-2 md:gap-8">
                <div className="flex items-center justify-between md:justify-start gap-4 md:gap-8 w-full md:w-auto">
                    {/* Logo Area */}
                    <div className="flex items-center gap-4">
                        <div className="text-3xl font-black italic tracking-tighter text-red-500 filter drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">MM</div>
                        {/* Live Indicator (Hidden on smallest screens to save space) */}
                        <div className="hidden sm:flex flex-col justify-center border-l border-zinc-800 pl-4 h-full">
                            <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Global Track</span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(239,68,68,1)]" />
                                <span className="text-xs font-bold tracking-widest text-red-400 drop-shadow-[0_0_2px_rgba(239,68,68,0.5)]">
                                    {globalStats.isManual ? "MANUAL STATS" : "LIVE TARGETS"}
                                </span>
                            </div>
                        </div>
                    </div>
                    {/* Right Actions (Mobile) */}
                    <button onClick={() => { sessionStorage.removeItem("mm_pw_ok"); router.push("/"); }} className="md:hidden text-xs font-bold border border-zinc-700 px-3 py-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-500 transition-colors">EXIT</button>
                </div>

                {/* Main Nav Tabs - Scrollable horizontally on mobile */}
                <div className="flex items-end h-full overflow-x-auto no-scrollbar md:pt-4 w-full md:w-auto -mx-4 px-4 md:mx-0 md:px-0">
                    <button onClick={() => router.push('/pot')} className="px-4 md:px-6 pb-2 md:pb-3 text-xs md:text-sm font-bold tracking-widest text-white/50 hover:text-white border-b-4 border-transparent hover:border-red-600/50 transition-colors uppercase whitespace-nowrap">Pot</button>
                    <button onClick={() => router.push('/races')} className="px-4 md:px-6 pb-2 md:pb-3 text-xs md:text-sm font-bold tracking-widest text-white/50 hover:text-white border-b-4 border-transparent hover:border-red-600/50 transition-colors uppercase whitespace-nowrap">Upcoming Races</button>
                    <button className="px-4 md:px-6 pb-2 md:pb-3 text-xs md:text-sm font-bold tracking-widest text-white border-b-4 border-red-600 uppercase text-shadow-sm shadow-red-500/50 whitespace-nowrap">Leaderboard</button>
                    <button className="px-4 md:px-6 pb-2 md:pb-3 text-xs md:text-sm font-bold tracking-widest text-white/50 hover:text-white border-b-4 border-transparent hover:border-red-600/50 transition-colors uppercase whitespace-nowrap">Telemetry</button>
                </div>

                {/* Right Actions (Desktop) */}
                <div className="hidden md:flex items-center gap-4">
                    <button onClick={() => { sessionStorage.removeItem("mm_pw_ok"); router.push("/"); }} className="text-xs font-bold border border-zinc-700 px-4 py-2 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-500 transition-colors">EXIT</button>
                </div>
            </header>

            {/* MAIN CONTENT SPLIT */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* LEFT SIDEBAR (Glassmorphism Leaderboard & Intel) */}
                <div className="w-80 bg-zinc-900/80 backdrop-blur-md flex flex-col border-r border-zinc-800 shrink-0 shadow-2xl z-10">

                    {/* Header for list */}
                    <div className="flex text-[10px] text-neutral-500 font-bold px-4 py-2 border-b border-neutral-800 uppercase tracking-widest">
                        <span className="w-8 text-center">POS</span>
                        <span className="flex-1">DRIVER</span>
                        <span className="w-12 text-right">DIST</span>
                    </div>

                    {/* Scrollable List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {runners.map((r, idx) => {
                            const isSelected = selectedRunner?.name === r.name;
                            const fullName = FULL_NAMES[r.name] || r.name;
                            return (
                                <button
                                    key={r.name}
                                    onClick={() => setSelectedRunner(r)}
                                    className={`w-full flex items-center px-4 py-2 ${isSelected ? 'bg-neutral-800' : 'hover:bg-neutral-800/50'} border-b border-neutral-800/50 transition-colors cursor-pointer text-left`}
                                >
                                    <span className={`w-8 text-center text-sm font-black ${isSelected ? 'text-white' : 'text-neutral-400'}`}>{idx + 1}</span>
                                    <div className="flex-1 flex items-center gap-3">
                                        <div className={`w-1 h-4 ${isSelected ? 'bg-red-500' : 'bg-transparent'}`} />
                                        <div className="flex flex-col justify-center">
                                            <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-neutral-300'}`}>{fullName}</span>
                                        </div>
                                    </div>
                                    <span className={`w-12 text-right text-xs font-bold ${isSelected ? 'text-red-400' : 'text-neutral-400'}`}>{r.yearlyKm.toFixed(0)}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* F1 Dial / Selected Runner Info */}
                    {selectedRunner && (
                        <div className="h-64 bg-zinc-950/80 backdrop-blur-md border-t border-zinc-800 p-4 flex flex-col items-center">
                            <div className="text-xl font-black mb-4 truncate w-full text-center tracking-widest text-shadow-sm shadow-red-500/20">{FULL_NAMES[selectedRunner.name] || selectedRunner.name}</div>

                            {/* Circular Gauge */}
                            <div className="w-32 h-32 rounded-full border-[2px] border-zinc-800 flex items-center justify-center relative shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] mb-4">
                                <div className="absolute inset-0 rounded-full border-[2px] border-red-600 rounded-tr-none rounded-br-none -rotate-45 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">DISTANCE</span>
                                    <span className="text-3xl font-black text-white">{selectedRunner.yearlyKm.toFixed(0)}</span>
                                    <span className="text-[10px] text-red-500 uppercase tracking-widest mt-1">KM LOGGED</span>
                                </div>
                            </div>

                            <button onClick={() => router.push(`/runners/${encodeURIComponent(selectedRunner.name)}`)} className="w-full mt-auto bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-white font-bold py-2.5 rounded transition-all flex items-center justify-center gap-2 shadow-lg">
                                <span className="bg-red-600/20 text-red-500 px-1.5 py-0.5 rounded text-[10px] tracking-widest border border-red-500/30">INTEL</span>
                                <span className="tracking-widest text-sm uppercase text-zinc-300 hover:text-white">VIEW DOSSIER</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* RIGHT PANEL (Map View) */}
                <div className="flex-1 relative bg-[#09090b]">
                    <F1TrackMap runners={runners} fullNames={FULL_NAMES} />
                </div>
            </div>
        </div>
    );
}
