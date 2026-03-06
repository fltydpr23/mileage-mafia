"use client";

import React, { useMemo, useState, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Line, Html, Environment } from "@react-three/drei";
import * as THREE from "three";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";

interface Runner {
    name: string;
    yearlyKm: number;
    completion: number;
    rank: number;
    weeklyTarget: number;
    annualTarget: number;
}

interface TronTrack3DProps {
    runners: Runner[];
    activeRunner?: Runner | null;
    setActiveRunner?: (runner: Runner | null) => void;
    hoveredRunner?: Runner | null;
    setHoveredRunner?: (runner: Runner | null) => void;
    isWarping?: boolean;
    isEntrancePOV?: boolean;
    showTrack?: boolean;
}

// Custom curving track path
const TRACK_POINTS = [
    new THREE.Vector3(-10, 0, 10),
    new THREE.Vector3(-5, 0, 5),
    new THREE.Vector3(0, 0, 8),
    new THREE.Vector3(5, 0, 0),
    new THREE.Vector3(2, 0, -5),
    new THREE.Vector3(-2, 0, -8),
    new THREE.Vector3(-8, 0, -4),
    new THREE.Vector3(-10, 0, -10),
    new THREE.Vector3(0, 0, -12),
    new THREE.Vector3(8, 0, -10),
    new THREE.Vector3(12, 0, 0),
    new THREE.Vector3(10, 0, 10),
];

const trackCurve = new THREE.CatmullRomCurve3(TRACK_POINTS, false, "centripetal");
const trackTubeGeometry = new THREE.TubeGeometry(trackCurve, 200, 0.15, 8, false);

function CameraAnimationController({ activeRunner, runners, maxCompletion, isWarping, isEntrancePOV }: { activeRunner?: Runner | null, runners: Runner[], maxCompletion: number, isWarping?: boolean, isEntrancePOV?: boolean }) {
    const warpRef = useRef(0);

    useFrame((state) => {
        if (!state.controls) return;

        // Hyperspace warp effect
        if (isWarping) {
            warpRef.current += 0.003; // accelerate
            const t = (state.clock.elapsedTime * 0.1 + warpRef.current) % 1;
            const lookAtT = (t + 0.05) % 1;

            const position = trackCurve.getPointAt(t);
            const lookAtPos = trackCurve.getPointAt(lookAtT);

            state.camera.position.lerp(position, 0.1);
            // @ts-ignore
            state.controls.target.lerp(lookAtPos, 0.1);

            // Widen FOV for speed effect
            if (state.camera instanceof THREE.PerspectiveCamera) {
                state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, 100, 0.05);
                state.camera.updateProjectionMatrix();
            }
            return;
        }

        if (activeRunner && runners.length > 0) {
            const index = runners.findIndex(r => r.name === activeRunner.name);
            if (index !== -1) {
                const relativeProgress = activeRunner.completion / maxCompletion;
                const t = Math.max(0.01, Math.min(0.99, relativeProgress));
                const position = trackCurve.getPointAt(t);
                const tangent = trackCurve.getTangentAt(t).normalize();
                const offsetAxis = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();
                const lateralOffset = ((index % 3) - 1) * 0.4;
                const finalPos = position.clone().add(offsetAxis.multiplyScalar(lateralOffset));
                finalPos.y += 0.5;

                // @ts-ignore - lerp exists on target
                state.controls.target.lerp(finalPos, 0.05);

                // Offset camera position for a close-up angled view
                let cameraOffset;
                if (isEntrancePOV) {
                    // Tight chase-cam from behind
                    cameraOffset = new THREE.Vector3(0, 0.4, -2.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), tangent.y);
                } else {
                    cameraOffset = new THREE.Vector3(3, 4, 6);
                }
                const idealCameraPos = finalPos.clone().add(cameraOffset);
                state.camera.position.lerp(idealCameraPos, 0.05);

                // Reset FOV if came back from warp
                if (state.camera instanceof THREE.PerspectiveCamera) {
                    state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, isEntrancePOV ? 70 : 50, 0.1);
                    state.camera.updateProjectionMatrix();
                }
            }
        } else {
            // Idle camera sweep for empty track (login page)
            const t = (state.clock.elapsedTime * 0.02) % 1;
            const position = trackCurve.getPointAt(t);
            const lookAtPos = trackCurve.getPointAt((t + 0.05) % 1);

            const cameraOffset = new THREE.Vector3(3, 4, 6);
            state.camera.position.lerp(position.clone().add(cameraOffset), 0.02);
            // @ts-ignore
            state.controls.target.lerp(lookAtPos, 0.02);

            if (state.camera instanceof THREE.PerspectiveCamera) {
                state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, 50, 0.1);
                state.camera.updateProjectionMatrix();
            }
        }
    });
    return null;
}

function Scene({
    runners,
    activeRunner,
    setActiveRunner,
    hoveredRunner,
    setHoveredRunner,
    isWarping,
    isEntrancePOV,
    showTrack = true
}: TronTrack3DProps) {

    // Normalize runners relative to leader
    const maxCompletion = runners.length > 0 ? Math.max(...runners.map((r) => r.completion), 0.1) : 1;

    return (
        <>
            <color attach="background" args={["#050505"]} />
            <CameraAnimationController activeRunner={activeRunner} runners={runners} maxCompletion={maxCompletion} isWarping={isWarping} isEntrancePOV={isEntrancePOV} />

            {/* Fog for depth */}
            <fog attach="fog" args={["#000000", 10, 40]} />

            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1.5} color="#00ffff" />
            <directionalLight position={[-10, 10, -5]} intensity={1} color="#ff00ff" />

            {/* Grid Floor */}
            <Grid
                position={[0, -0.2, 0]}
                args={[50, 50]}
                cellSize={1}
                cellThickness={1}
                cellColor="#004444"
                sectionSize={5}
                sectionThickness={1.5}
                sectionColor="#00ffff"
                fadeDistance={30}
                fadeStrength={1}
            />

            {/* THE DATA TUNNEL ENCLOSURE */}
            {showTrack !== false && (
                <mesh geometry={trackTubeGeometry}>
                    <meshStandardMaterial
                        color="#001133"
                        emissive="#00aaff"
                        emissiveIntensity={1.5}
                        wireframe={true}
                        toneMapped={false}
                        transparent
                        opacity={0.15}
                    />
                </mesh>
            )}

            {/* TRACK CORE ENERGY STREAM */}
            {showTrack !== false && (
                <>
                    <Line
                        points={trackCurve.getPoints(200)}
                        color="#ffffff"
                        lineWidth={4}
                        transparent
                        opacity={0.8}
                        toneMapped={false}
                    />
                    {/* INNER GLOW HALO */}
                    <Line
                        points={trackCurve.getPoints(100)}
                        color="#00ffff"
                        lineWidth={12}
                        transparent
                        opacity={0.2}
                        toneMapped={false}
                    />
                </>
            )}

            {/* Dummy Runners for Warp Speed populated effect on Login page */}
            {isWarping && runners.length === 0 && Array.from({ length: 11 }).map((_, i) => {
                const t = (i / 11);
                const pos = trackCurve.getPointAt(t);
                const tangent = trackCurve.getTangentAt(t).normalize();
                const offsetAxis = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();
                const lateralOffset = ((i % 3) - 1) * 0.4;
                const finalPos = pos.clone().add(offsetAxis.multiplyScalar(lateralOffset));
                finalPos.y += 0.5;

                return (
                    <mesh key={`dummy-${i}`} position={[finalPos.x, finalPos.y, finalPos.z]}>
                        <sphereGeometry args={[0.2, 16, 16]} />
                        <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} wireframe />
                    </mesh>
                );
            })}

            {/* Runners */}
            {runners.slice(0, 10).map((runner, i) => {
                // Map relative progress to curve t parameter
                const relativeProgress = runner.completion / maxCompletion;
                // Keep t between 0 and 1. We map it so 0 is end of curve and 1 is start, 
                // or 0 is start (-10,10) and 1 is end (10,10). Let's say 1 is end.
                const t = Math.max(0.01, Math.min(0.99, relativeProgress));

                const position = trackCurve.getPointAt(t);
                const tangent = trackCurve.getTangentAt(t).normalize();

                // Add slight rank-based lateral offset to avoid complete overlaps
                const offsetAxis = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();
                const lateralOffset = ((i % 3) - 1) * 0.4; // slight spread
                const finalPos = position.clone().add(offsetAxis.multiplyScalar(lateralOffset));
                finalPos.y += 0.5; // Hover above track

                const isLeader = i === 0;

                return (
                    <group
                        key={runner.name}
                        position={[finalPos.x, finalPos.y, finalPos.z]}
                        onClick={(e: any) => {
                            e.stopPropagation();
                            setActiveRunner?.(activeRunner?.name === runner.name ? null : runner);
                        }}
                        onPointerOver={(e: any) => {
                            e.stopPropagation();
                            setHoveredRunner?.(runner);
                        }}
                        onPointerOut={() => {
                            setHoveredRunner?.(null);
                        }}
                    >
                        {/* The F1 Runner Sphere */}
                        <mesh>
                            <sphereGeometry args={[0.3, 32, 32]} />
                            <meshStandardMaterial
                                color={isLeader ? "#FACC15" : "#00ffff"}
                                emissive={isLeader ? "#FACC15" : "#00ffff"}
                                emissiveIntensity={3}
                                wireframe={!isLeader}
                                toneMapped={false}
                            />
                        </mesh>

                        {/* Leader Crown */}
                        {isLeader && (
                            <Html position={[0, 0.8, 0]} center zIndexRange={[100, 0]}>
                                <div className="text-xl animate-bounce drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] filter">
                                    👑
                                </div>
                            </Html>
                        )}

                        {/* Vertical tether beam */}
                        <Line
                            points={[[0, -0.5, 0], [0, 0, 0]]}
                            color={isLeader ? "#FACC15" : "#00ffff"}
                            lineWidth={1}
                            transparent
                            opacity={0.5}
                        />

                        {/* Always visible minimal name tag & Hover Stats */}
                        <Html position={[0, isLeader ? 1.2 : 0.6, 0]} center zIndexRange={[100, 0]}>
                            <div className={`pointer-events-none flex flex-col items-center justify-center transition-all duration-300 ${activeRunner?.name === runner.name || hoveredRunner?.name === runner.name
                                ? "scale-125 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                                : "scale-100 opacity-80"
                                }`}>
                                <div className="rounded px-1.5 py-0.5 bg-black/90 border border-white/10 text-[9px] font-black text-white whitespace-nowrap backdrop-blur-md uppercase tracking-wider flex items-center gap-1.5">
                                    <span className={isLeader ? "text-yellow-400" : "text-cyan-400"}>P{i + 1}</span>
                                    {runner.name.substring(0, 3)}
                                </div>

                                <AnimatePresence>
                                    {hoveredRunner?.name === runner.name && activeRunner?.name !== runner.name && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            className="mt-1 bg-black/80 border border-white/20 rounded px-2 py-1 backdrop-blur-md"
                                        >
                                            <p className="text-[8px] font-mono text-cyan-300 font-bold tracking-widest">{runner.yearlyKm} KM</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </Html>

                        {/* Expandable Dashboard Portal */}
                        <AnimatePresence>
                            {activeRunner?.name === runner.name && (
                                <Html position={[1, 1, 0]} center zIndexRange={[100, 0]}>
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8, x: -20 }}
                                        animate={{ opacity: 1, scale: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.8, x: -20 }}
                                        className="w-48 p-4 rounded-xl bg-neutral-950/90 backdrop-blur-xl border border-cyan-500/30 shadow-[0_0_30px_rgba(0,255,255,0.1)] text-white relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-transparent" />
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="text-[9px] font-bold tracking-widest text-cyan-500 uppercase">Agent Ident</p>
                                                <p className="text-lg font-black tracking-tight leading-none mt-1">{runner.name}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-bold tracking-widest text-neutral-500 uppercase">Rank</p>
                                                <p className="text-sm font-bold text-white">0{i + 1}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <div className="flex justify-between text-[10px] font-medium text-neutral-400 mb-1">
                                                    <span>Sector Sweep</span>
                                                    <span className="text-white tabular-nums">{runner.yearlyKm} km</span>
                                                </div>
                                                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(0,255,255,0.8)]"
                                                        style={{ width: `${runner.completion}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-cyan-400 text-xs font-bold font-mono tracking-widest">{runner.completion.toFixed(1)}% PWR</span>
                                            </div>
                                        </div>

                                        <Link
                                            href={`/runners/${encodeURIComponent(runner.name)}`}
                                            className="mt-4 block w-full text-center py-2 bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-500/50 rounded text-[10px] font-bold tracking-[0.2em] text-cyan-300 hover:text-white transition-colors uppercase"
                                        >
                                            View Dossier →
                                        </Link>
                                    </motion.div>
                                </Html>
                            )}
                        </AnimatePresence>
                    </group>
                );
            })}

            {/* Controls */}
            <OrbitControls
                makeDefault
                enablePan={true}
                enableZoom={true}
                enableRotate={true}
                maxPolarAngle={Math.PI / 2 - 0.05} // don't go below floor
                minDistance={5}
                maxDistance={40}
            />
        </>
    );
}

export default function TronTrack3D(props: TronTrack3DProps) {
    return (
        <div className="relative w-full h-full bg-neutral-950 rounded-[2.5rem] 2xl:rounded-[3rem] ring-1 ring-white/5 overflow-hidden group">

            {/* UI Overlay */}
            {props.runners.length > 0 && (
                <div className="absolute top-6 left-6 z-10 pointer-events-none">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_8px_rgba(0,255,255,0.6)]" />
                        <h2 className="text-[11px] font-bold tracking-widest uppercase text-cyan-400 italic">Telemetry Live</h2>
                    </div>
                    <p className="text-xs text-neutral-400 font-medium">Interactive Driver Tracking. Drag to rotate. Scroll to zoom.</p>
                </div>
            )}

            <Canvas camera={{ position: [0, 15, 20], fov: 45 }}>
                <Scene {...props} />
            </Canvas>

            {/* Cursor hint overlay that fades on hover */}
            {props.runners.length > 0 && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/40 opacity-100 group-hover:opacity-0 transition-opacity duration-500">
                    <div className="px-4 py-2 rounded-full border border-white/10 bg-black/60 backdrop-blur-md flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/70"><path d="m15 18-6-6 6-6" /></svg>
                        <span className="text-xs font-bold uppercase tracking-widest text-white/70">Interact</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/70"><path d="m9 18 6-6-6-6" /></svg>
                    </div>
                </div>
            )}
        </div>
    );
}
