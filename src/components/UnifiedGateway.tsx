"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { DotGothic16 } from "next/font/google";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Tube, Float } from "@react-three/drei";
import * as THREE from "three";
import { useAudio } from "@/components/AudioProvider";

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

// Minimalistic 3D track background
function TrackBackground() {
    const curve = useMemo(() => {
        return new THREE.CatmullRomCurve3([
            new THREE.Vector3(-4, 0, 2),
            new THREE.Vector3(-2, 1, -3),
            new THREE.Vector3(2, 0, -4),
            new THREE.Vector3(4, -1, 1),
            new THREE.Vector3(1, 1, 3),
            new THREE.Vector3(-2, -1, 4),
        ], true);
    }, []);

    const tubeRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (tubeRef.current) {
            tubeRef.current.rotation.y = state.clock.getElapsedTime() * 0.1;
            tubeRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.05) * 0.2;
        }
    });

    return (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
            <Tube ref={tubeRef} args={[curve, 100, 0.05, 8, true]}>
                <meshStandardMaterial 
                    color="#ef4444" 
                    emissive="#dc2626" 
                    emissiveIntensity={2} 
                    wireframe 
                    transparent 
                    opacity={0.3} 
                />
            </Tube>
            <ambientLight intensity={0.2} />
            <pointLight position={[0, 0, 0]} intensity={1} color="#ef4444" />
        </Float>
    );
}

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
                activeItem.scrollIntoView({ block: "center", behavior: "smooth" });
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
        if (submitting) return;

        if (!pw.trim()) {
            setAuthErr(true);
            setTimeout(() => setAuthErr(false), 450);
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
                setAuthErr(true);
                setTimeout(() => setAuthErr(false), 650);
                requestAnimationFrame(() => pwRef.current?.focus());
                return;
            }

            try { sessionStorage.setItem("mm_pw_ok", "1"); } catch {}
            setStep(1); // Proceed to Alias
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
        <main className="relative w-full h-screen bg-[#050505] overflow-hidden flex items-center justify-center font-mono select-none" onKeyDown={handleKeyNav} tabIndex={0}>
            {/* 3D Background */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
                <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
                    <TrackBackground />
                </Canvas>
            </div>

            {/* CRT/Scanline Overlays */}
            <div className="absolute inset-0 z-10 pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)] opacity-80" />
            </div>

            {/* Main Terminal Container */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-20 w-full max-w-[500px] bg-neutral-950/80 backdrop-blur-xl border border-white/10 p-8 shadow-[0_0_50px_rgba(220,38,38,0.05)]"
            >
                {/* Header Sequence */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="h-4 w-4 bg-red-600 animate-pulse" style={{ clipPath: "polygon(0 0, 100% 0, 100% 80%, 80% 100%, 0 100%)" }} />
                        <span className="text-xs tracking-[0.3em] font-bold text-red-500 uppercase">Race Control</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 tracking-widest uppercase">Sys.Init</span>
                </div>

                <div className="min-h-[220px]">
                    <AnimatePresence mode="popLayout">
                        {/* STEP 0: AUTHORIZATION (Password) */}
                        {step === 0 && (
                            <motion.form
                                key="auth"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                onSubmit={handleAuth}
                                className="flex flex-col items-center justify-center h-full gap-8"
                            >
                                <div className={clsx("text-center space-y-2", dotGothic.className)}>
                                    <div className="text-3xl sm:text-4xl tracking-widest text-white uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">MILEAGE MAFIA</div>
                                    <div className="text-xs text-red-500 tracking-[0.2em] font-bold">SYNDICATE UPLINK REQUIRED</div>
                                </div>
                                <div className="relative flex items-center justify-start w-full max-w-[320px]">
                                    <span className="absolute -left-6 text-red-500 animate-pulse">&gt;</span>
                                    <input 
                                        ref={pwRef}
                                        type="password"
                                        value={pw}
                                        onChange={e => setPw(e.target.value)}
                                        disabled={submitting}
                                        placeholder="ENTER OPERATIVE CODE"
                                        className={clsx(
                                            "w-full bg-transparent outline-none text-white tracking-[0.3em] pb-2 border-b border-neutral-800 focus:border-red-500 transition-colors uppercase placeholder:text-neutral-700 placeholder:text-sm",
                                            authErr && "border-red-500 text-red-500 animate-[shake_0.2s_ease-in-out_0s_2]"
                                        )}
                                    />
                                    <button type="submit" className="hidden" />
                                </div>
                            </motion.form>
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
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[160px] overflow-y-auto pr-1 pb-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
                                    {RUNNER_NAMES.map((name, i) => (
                                        <button 
                                            key={name} 
                                            onClick={() => { setRunnerIdx(i); setRunner(name); localStorage.setItem("mm_runner_name", name); setStep(2); }}
                                            className={clsx(
                                                "py-3 border uppercase transition-all flex flex-col justify-center items-center rounded-sm",
                                                i === runnerIdx 
                                                    ? "bg-red-600 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] relative z-10" 
                                                    : "bg-black/50 border-white/5 text-zinc-500 hover:text-white hover:bg-white/5 hover:border-white/20"
                                            )}
                                        >
                                            <span className="text-[10px] font-bold tracking-[0.15em]">{name}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="text-[8px] text-zinc-600 text-center uppercase tracking-widest pt-1">Select an alias to proceed</div>
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
                                <div className="text-xs text-zinc-500 tracking-widest uppercase">Select Audio Protocol</div>
                                <div ref={scrollRef} className="flex-1 overflow-hidden space-y-4 h-[120px] flex flex-col relative" style={{ maskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)" }}>
                                    {RADIO_STATIONS.map((s, i) => (
                                        <div 
                                            key={s.id} 
                                            onClick={() => { setStationIdx(i); handleRadioSelect(); }}
                                            className={clsx(
                                                "text-lg tracking-[0.2em] transition-all cursor-pointer flex items-center gap-3 shrink-0",
                                                i === stationIdx ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]" : "text-zinc-600 hover:text-zinc-400"
                                            )}
                                        >
                                            <span className={clsx("text-sm", i === stationIdx ? "opacity-100" : "opacity-0")}>▶</span>
                                            {s.label}
                                        </div>
                                    ))}
                                </div>
                                <div className="text-[9px] text-zinc-600 text-right uppercase pt-2 border-t border-white/5">Use arrow keys (↑↓) or click</div>
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
            `}</style>
        </main>
    );
}
