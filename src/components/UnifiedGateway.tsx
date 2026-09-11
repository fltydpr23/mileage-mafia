"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { DotGothic16 } from "next/font/google";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Tube, Float } from "@react-three/drei";
import * as THREE from "three";
import { useAudio } from "@/components/AudioProvider";
import InfiniteNightTrack from "./InfiniteNightTrack";

const dotGothic = DotGothic16({ subsets: ["latin"], weight: "400" });

const RUNNER_NAMES = [
    "Adhi", "Loaf", "SD", "Raja", "Kushal",
    "Sanjay", "Sai", "Bhat", "Kumar", "Boba", "Rishi",
];

const RADIO_STATIONS = [
    { id: "techno", label: "TECHNO BNKR" },
    { id: "tamil", label: "TAMIL HEAT" },
    { id: "hiphop", label: "BEAST MODE HIP HOP" },
];

function clsx(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(" ");
}

// Track background moved to InfiniteNightTrack.tsx

export default function UnifiedGateway() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { startStation } = useAudio();

    // Steps: 0: Password, 1: Alias, 2: Strava, 3: Audio, 4: Booting
    const [step, setStep] = useState(0);
    
    // Auth State
    const [pw, setPw] = useState("");
    const pwRef = useRef<HTMLInputElement>(null);
    const [authErr, setAuthErr] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [stamping, setStamping] = useState(false);
    const [flashing, setFlashing] = useState(false);

    // Flow State
    const [runnerIdx, setRunnerIdx] = useState(0);
    const [stationIdx, setStationIdx] = useState(0);
    const [runner, setRunner] = useState("");

    const scrollRef = useRef<HTMLDivElement>(null);

    // Keep active item in view (for keyboards or external scroll)
    useEffect(() => {
        if (!scrollRef.current) return;
        if (step === 1 || step === 3) {
            const activeItem = scrollRef.current.children[step === 1 ? runnerIdx : stationIdx] as HTMLElement;
            if (activeItem) {
                activeItem.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
            }
        }
    }, [runnerIdx, stationIdx, step]);

    useEffect(() => {
        if (step === 0 && pwRef.current) {
            pwRef.current.focus();
        }
    }, [step]);

    // Handle OAuth success callback
    useEffect(() => {
        if (searchParams.get("success") === "1") {
            const runnerParam = searchParams.get("runner");
            if (runnerParam) {
                setRunner(runnerParam);
                try {
                    localStorage.setItem("mm_runner_name", runnerParam);
                    sessionStorage.setItem("mm_pw_ok", "1");
                    localStorage.setItem("mm_initiation_done", "1");
                } catch {}
            }
            // Wipe the search params from URL so refreshing doesn't loop us
            window.history.replaceState({}, "", "/");
            // Jump straight to the dashboard; initiation is complete
            router.push("/leaderboard");
        }
    }, [searchParams, router]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting || stamping) return;

        if (!pw.trim()) {
            setFlashing(true);
            setTimeout(() => setFlashing(false), 350);
            setPw("");
            requestAnimationFrame(() => pwRef.current?.focus());
            return;
        }

        setSubmitting(true);
        setAuthErr(false);

        try {
            const res = await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: pw }),
            });

            const data = await res.json().catch(() => ({ ok: false }));
            if (!data.ok) {
                setPw("");
                setFlashing(true);
                setTimeout(() => setFlashing(false), 350);
                requestAnimationFrame(() => pwRef.current?.focus());
                return;
            }

            try { sessionStorage.setItem("mm_pw_ok", "1"); } catch {}
            // Stamp ceremony before proceeding
            setStamping(true);
            setTimeout(() => {
                setStamping(false);
                setStep(1);
            }, 900);
        } finally {
            setSubmitting(false);
        }
    };

    const handleKeyNav = (e: React.KeyboardEvent) => {
        if (step === 1) {
            if (e.key === "ArrowUp") setRunnerIdx(p => (p > 0 ? p - 1 : RUNNER_NAMES.length - 1));
            if (e.key === "ArrowDown") setRunnerIdx(p => (p < RUNNER_NAMES.length - 1 ? p + 1 : 0));
            if (e.key === "Enter") {
                setRunner(RUNNER_NAMES[runnerIdx]);
                localStorage.setItem("mm_runner_name", RUNNER_NAMES[runnerIdx]);
                setStep(2);
            }
        } else if (step === 3) {
            if (e.key === "ArrowUp") setStationIdx(p => (p > 0 ? p - 1 : RADIO_STATIONS.length - 1));
            if (e.key === "ArrowDown") setStationIdx(p => (p < RADIO_STATIONS.length - 1 ? p + 1 : 0));
            if (e.key === "Enter") handleRadioSelect();
        }
    };

    const handleStravaSelect = (connect: boolean) => {
        if (connect && runner) {
            window.location.href = `/api/strava/runner-connect?runner=${encodeURIComponent(runner)}&returnTo=landing`;
        } else {
            setStep(3); // Skip straight to radio
        }
    };

    const handleRadioSelect = () => {
        const stationId = RADIO_STATIONS[stationIdx].id as import("@/components/AudioProvider").StationId;
        localStorage.setItem("mm_radio_station", stationId);
        localStorage.setItem("mm_initiation_done", "1");
        setStep(4);
        startStation(stationId).catch(() => {});
        setTimeout(() => {
            router.push("/leaderboard");
        }, 1500);
    };

    return (
        <main className="relative w-full min-h-[100dvh] bg-[#050505] overflow-hidden flex items-center justify-center font-mono select-none" onKeyDown={handleKeyNav} tabIndex={0}>
            {/* 3D Background */}
            <InfiniteNightTrack />

            {/* CRT/Scanline Overlays */}
            <div className="absolute inset-0 z-10 pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)] opacity-80" />
            </div>

            {/* Main Terminal Container */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={clsx(
                    "relative z-20 w-full",
                    step === 0
                        ? "max-w-[540px]"
                        : "max-w-[500px] bg-neutral-950/80 backdrop-blur-xl border border-white/10 p-8 shadow-[0_0_50px_rgba(220,38,38,0.05)]"
                )}
            >
                {/* Header Sequence — hidden on step 0 (The Door uses full-bleed) */}
                {step !== 0 && (
                    <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-8">
                        <div className="flex items-center gap-3">
                            <div className="h-4 w-4 bg-red-600 animate-pulse" style={{ clipPath: "polygon(0 0, 100% 0, 100% 80%, 80% 100%, 0 100%)" }} />
                            <span className="text-xs tracking-[0.3em] font-bold text-red-500 uppercase">Race Control</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 tracking-widest uppercase">Sys.Init</span>
                    </div>
                )}

                <div className="min-h-[220px]">
                    <AnimatePresence mode="popLayout">
                        {/* STEP 0: THE DOOR */}
                        {step === 0 && (
                            <motion.div
                                key="auth"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, scale: 0.97 }}
                                transition={{ duration: 0.5 }}
                                className="relative flex flex-col items-center justify-center gap-10 py-14"
                            >
                                {/* Red flash overlay */}
                                <div
                                    className="pointer-events-none absolute inset-0 transition-opacity duration-100"
                                    style={{ background: "rgba(220,38,38,0.14)", opacity: flashing ? 1 : 0 }}
                                />

                                {/* Stamp overlay — slides in on correct password */}
                                {stamping && (
                                    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                                        <div
                                            className={clsx("flex flex-col items-center gap-1.5 px-10 py-6 mm-stamp", dotGothic.className)}
                                            style={{
                                                border: "2px solid rgba(220,38,38,0.85)",
                                                boxShadow: "0 0 40px rgba(220,38,38,0.45), inset 0 0 24px rgba(220,38,38,0.12)",
                                                background: "rgba(0,0,0,0.75)",
                                            }}
                                        >
                                            <span className="text-6xl text-red-500 leading-none tracking-widest">MM</span>
                                            <span className="text-[11px] font-mono text-red-500 tracking-[0.55em] mt-1">VERIFIED</span>
                                        </div>
                                    </div>
                                )}

                                {/* Logo */}
                                <div className="text-center space-y-2 select-none">
                                    <div
                                        className={clsx("text-6xl sm:text-7xl tracking-[0.12em] text-white uppercase leading-none", dotGothic.className)}
                                        style={{ textShadow: "0 0 60px rgba(220,38,38,0.4), 0 0 120px rgba(220,38,38,0.15)" }}
                                    >
                                        MM
                                    </div>
                                    <div
                                        className={clsx("text-lg sm:text-xl tracking-[0.35em] text-white/80 uppercase mt-1", dotGothic.className)}
                                        style={{ textShadow: "0 0 20px rgba(220,38,38,0.2)" }}
                                    >
                                        MILEAGE MAFIA
                                    </div>
                                </div>

                                {/* Authorized access only */}
                                <div className="text-[9px] font-mono text-zinc-700 tracking-[0.5em] uppercase select-none">
                                    AUTHORIZED ACCESS ONLY
                                </div>

                                {/* Password input */}
                                <form onSubmit={handleAuth} className="flex flex-col items-center gap-0 w-full max-w-[300px]">
                                    <div className="relative flex items-center gap-3 w-full py-3">
                                        {/* Prompt marker */}
                                        <span className="text-red-600 animate-pulse font-mono text-xl leading-none shrink-0 select-none">›</span>

                                        {/* Visual dots + cursor over invisible real input */}
                                        <div className="relative flex-1">
                                            <input
                                                ref={pwRef}
                                                type="password"
                                                value={pw}
                                                onChange={e => setPw(e.target.value)}
                                                disabled={submitting || stamping}
                                                autoComplete="off"
                                                autoCorrect="off"
                                                autoCapitalize="off"
                                                spellCheck={false}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-text"
                                                aria-label="Access code"
                                            />
                                            {/* Rendered dots + blinking cursor */}
                                            <div className="flex items-center gap-2 min-h-[28px] pointer-events-none select-none">
                                                {Array.from({ length: pw.length }).map((_, i) => (
                                                    <span key={i} className="w-[6px] h-[6px] rounded-full bg-white/85 inline-block shrink-0" />
                                                ))}
                                                <span className="inline-block text-white/70 font-mono text-lg leading-none mm-blink">_</span>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Underline — turns red while flashing */}
                                    <div
                                        className="w-full h-px transition-colors duration-100"
                                        style={{ background: flashing ? "rgba(220,38,38,0.7)" : "rgba(255,255,255,0.08)" }}
                                    />
                                    <button type="submit" className="hidden" />
                                </form>
                            </motion.div>
                        )}

                        {/* STEP 1: ALIAS IDENTIFICATION */}
                        {step === 1 && (
                            <motion.div
                                key="alias"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="flex flex-col h-full gap-4"
                            >
                                <div className="text-[10px] text-zinc-500 tracking-[0.2em] uppercase font-bold text-center border-b border-white/10 pb-2">Select Operative Alias</div>
                                <div ref={scrollRef} className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-4 pt-2 -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
                                    {RUNNER_NAMES.map((name, i) => (
                                        <motion.button 
                                            key={name} 
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => { setRunnerIdx(i); setRunner(name); localStorage.setItem("mm_runner_name", name); setStep(2); }}
                                            className={clsx(
                                                "shrink-0 w-28 py-4 border uppercase transition-all flex flex-col justify-center items-center rounded-md snap-center",
                                                i === runnerIdx 
                                                    ? "bg-red-600 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] relative z-10" 
                                                    : "bg-black/50 border-white/5 text-zinc-500 active:bg-white/10"
                                            )}
                                        >
                                            <span className="text-xs font-bold tracking-[0.15em]">{name}</span>
                                        </motion.button>
                                    ))}
                                </div>
                                <div className="text-[8px] text-zinc-600 text-center uppercase tracking-widest pt-1">Swipe & select to proceed</div>
                            </motion.div>
                        )}

                        {/* STEP 2: STRAVA UPLINK */}
                        {step === 2 && (
                            <motion.div
                                key="strava"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="flex flex-col justify-center items-center h-[200px] gap-6 text-center"
                            >
                                <div className="space-y-2">
                                    <div className="text-sm font-bold text-red-500 tracking-widest uppercase animate-pulse">Telemetry Required</div>
                                    <div className="text-xs text-zinc-400 tracking-widest uppercase leading-loose max-w-[300px]">Link Strava to sync mileage data with the syndicate network.</div>
                                </div>
                                <div className="flex gap-4 w-full justify-center">
                                    <button onClick={() => handleStravaSelect(false)} className="px-6 py-2 border border-neutral-700 text-zinc-400 text-xs tracking-widest hover:bg-neutral-800 transition-colors uppercase">Skip</button>
                                    <button onClick={() => handleStravaSelect(true)} className="px-6 py-2 bg-red-600 text-white font-bold text-xs tracking-widest hover:bg-red-500 transition-colors uppercase">Connect</button>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 3: AUDIO PROTOCOL */}
                        {step === 3 && (
                            <motion.div
                                key="audio"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="flex flex-col h-full gap-4"
                            >
                                <div className="text-[10px] text-zinc-500 tracking-[0.2em] uppercase font-bold text-center border-b border-white/10 pb-2">Select Audio Protocol</div>
                                <div ref={scrollRef} className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 pt-2 -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
                                    {RADIO_STATIONS.map((s, i) => (
                                        <motion.button 
                                            key={s.id} 
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => { setStationIdx(i); handleRadioSelect(); }}
                                            className={clsx(
                                                "shrink-0 w-40 h-24 border transition-all flex flex-col justify-center items-center rounded-lg snap-center",
                                                i === stationIdx 
                                                    ? "bg-cyan-900/40 border-cyan-400 text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)] relative z-10" 
                                                    : "bg-black/50 border-white/5 text-zinc-500 active:bg-white/10"
                                            )}
                                        >
                                            <span className={clsx("text-xl mb-1", i === stationIdx ? "opacity-100" : "opacity-50")}>
                                                {s.id === 'techno' ? '🔊' : s.id === 'tamil' ? '🔥' : '💥'}
                                            </span>
                                            <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-center px-2">{s.label}</span>
                                        </motion.button>
                                    ))}
                                </div>
                                <div className="text-[8px] text-zinc-600 text-center uppercase tracking-widest pt-1">Swipe & select to proceed</div>
                            </motion.div>
                        )}

                        {/* STEP 4: BOOTING */}
                        {step === 4 && (
                            <motion.div
                                key="boot"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center h-[200px] gap-4"
                            >
                                <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-red-500 animate-spin" />
                                <div className="text-xs text-red-500 tracking-[0.3em] font-bold uppercase animate-pulse">Decrypting Telemetry...</div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            <style>{`
                @keyframes shake {
                    0% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    50% { transform: translateX(5px); }
                    75% { transform: translateX(-5px); }
                    100% { transform: translateX(0); }
                }

                /* Blinking cursor */
                .mm-blink {
                    animation: mmBlink 1s steps(1, end) infinite;
                }
                @keyframes mmBlink {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0; }
                }

                /* Stamp press-in */
                .mm-stamp {
                    animation: mmStamp 900ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
                }
                @keyframes mmStamp {
                    0%   { opacity: 0; transform: rotate(-14deg) scale(1.5); }
                    35%  { opacity: 1; transform: rotate(-6deg)  scale(1.0); }
                    72%  { opacity: 1; transform: rotate(-6deg)  scale(1.0); }
                    100% { opacity: 0; transform: rotate(-6deg)  scale(0.96); }
                }
            `}</style>
        </main>
    );
}
