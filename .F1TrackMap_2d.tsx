"use client";

import React, { useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MapControls, Line, Html, Grid, OrbitControls, Tube, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { useRouter } from "next/navigation";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

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

// Mimicking an F1 track loop (e.g., Hungaroring-ish)
const TRACK_POINTS = [
    new THREE.Vector3(-10, 0, 10),
    new THREE.Vector3(-8, 0, 2),
    new THREE.Vector3(-10, 0, -8),
    new THREE.Vector3(-2, 0, -10),
    new THREE.Vector3(2, 0, -5),
    new THREE.Vector3(6, 0, -8),
    new THREE.Vector3(10, 0, -2),
    new THREE.Vector3(8, 0, 4),
    new THREE.Vector3(2, 0, 10),
    new THREE.Vector3(-4, 0, 8),
    new THREE.Vector3(-10, 0, 10), // close loop
];

function getRunnerColor(nameKey: string) {
    if (nameKey === "Adhi") return "#ef4444"; // Red
    if (["SD", "Raja", "Bhat", "Sanjay"].includes(nameKey)) return "#10b981"; // Green
    if (["Boba", "Kushal", "Sai"].includes(nameKey)) return "#3b82f6"; // Blue
    if (["Kumar", "Loaf", "Rishi"].includes(nameKey)) return "#eab308"; // Yellow
    return "#ffffff";
}

function RunnerBlob({ runner, curve, maxCompletion, index, fullName, activeRunner, hoveredRunner, onRunnerSelect }: { runner: Runner, curve: THREE.Curve<THREE.Vector3>, maxCompletion: number, index: number, fullName: string, activeRunner?: string, hoveredRunner?: string, onRunnerSelect?: (name: string) => void }) {
    const router = useRouter();
    // Internal popup state removed, we now rely entirely on `isActive` from HUD

    // F1 Telemetry maps show progress along the track. User requested rank-based positioning.
    const relativeT = Math.max(0.01, 0.95 - (runner.rank * 0.07));
    const position = curve.getPointAt(relativeT);

    // Offset slightly for overlaps
    const offset = new THREE.Vector3((index % 3 - 1) * 0.3, 0, (index % 2 - 0.5) * 0.3);
    const finalPos = position.clone().add(offset);

    const color = getRunnerColor(runner.name);
    const abbrev = runner.name.substring(0, 3).toUpperCase();

    const isActive = activeRunner === runner.name;
    const isHovered = hoveredRunner === runner.name;
    const blobScale = isActive ? 1.6 : (isHovered ? 1.3 : 1.0);
    const glowIntensity = isActive ? 6 : (isHovered ? 4 : 2);

    return (
        <group position={[finalPos.x, 0, finalPos.z]}>
            {/* The Blob with glowing emissive material */}
            <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                scale={[blobScale, blobScale, blobScale]}
                onClick={(e) => { e.stopPropagation(); onRunnerSelect?.(runner.name); }}
                onPointerOver={() => document.body.style.cursor = 'pointer'}
                onPointerOut={() => document.body.style.cursor = 'grab'}
            >
                <circleGeometry args={[0.6, 32]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glowIntensity} toneMapped={false} />
            </mesh>
            {/* Outline for the blob for F1 style */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} scale={[blobScale, blobScale, blobScale]}>
                <ringGeometry args={[0.6, 0.8, 32]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.2} toneMapped={false} />
            </mesh>

            {/* Label attached to the blob (Only opens if actively selected from HUD) */}
            {isActive && (
                <Html center position={[0, 1.5, 0]} zIndexRange={[100, 0]}>
                    <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-800 text-white p-3 rounded-lg shadow-2xl flex flex-col gap-2 min-w-[150px] animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: color, color: color }} />
                            <span className="text-sm font-black uppercase tracking-wider">{fullName}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-zinc-500 font-bold">DIST</span>
                            <span className="font-bold font-mono">{runner.yearlyKm.toFixed(0)} KM</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-zinc-500 font-bold">RANK</span>
                            <span className="font-bold font-mono text-crimson">P{runner.rank}</span>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/runners/${encodeURIComponent(runner.name.toLowerCase())}`); }}
                            className="w-full mt-2 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold py-1.5 rounded transition-colors uppercase tracking-widest border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)] hover:shadow-[0_0_15px_rgba(239,68,68,0.6)]"
                        >
                            View Dossier
                        </button>
                    </div>
                </Html>
            )}

            {/* Mini pill label is always visible but extremely non-intrusive */}
            {!isActive && (
                <Html center position={[0, 0.5, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
                    <div className="bg-white/95 backdrop-blur-sm border border-zinc-800 rounded-full shadow-lg flex items-center pr-2 pl-1 py-0.5 gap-1 opacity-80 shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
                        <div className="w-1.5 h-3.5 rounded-sm" style={{ backgroundColor: color }} />
                        <span className="text-[9px] font-black uppercase text-black tracking-widest" style={{ fontFamily: 'sans-serif' }}>
                            {abbrev}
                        </span>
                    </div>
                </Html>
            )}
        </group>
    );
}

function Scene({ runners, fullNames, activeRunner, hoveredRunner, onRunnerSelect }: F1TrackMapProps) {
    const trackCurve = useMemo(() => new THREE.CatmullRomCurve3(TRACK_POINTS, true, "centripetal"), []);
    const maxCompletion = useMemo(() => runners.length > 0 ? Math.max(100, ...runners.map(r => r.completion)) : 100, [runners]);

    return (
        <>
            <color attach="background" args={["#050505"]} />
            {/* 3D camera controls for immersive viewing */}
            <OrbitControls 
               enablePan={false} 
               maxPolarAngle={Math.PI / 2.1} 
               minPolarAngle={Math.PI / 6} 
               maxDistance={80}
               minDistance={10}
               autoRotate={false}
               enableDamping
            />

            <ambientLight intensity={0.5} />
            <spotLight position={[0, 40, 0]} intensity={800} color="#dc2626" distance={80} angle={1.2} penumbra={1} castShadow />
            
            {/* High-tech infinite floor grid */}
            <Grid 
                position={[0, -0.5, 0]} 
                args={[100, 100]} 
                cellSize={1} 
                cellThickness={1.5} 
                cellColor="#27272a" 
                sectionSize={5} 
                sectionThickness={2} 
                sectionColor="#3f3f46" 
                fadeDistance={45} 
                infiniteGrid 
            />

            {/* Atmospherics */}
            <Sparkles count={400} scale={40} size={1.5} speed={0.4} opacity={0.3} color="#dc2626" />
            <Sparkles count={400} scale={40} size={1} speed={0.2} opacity={0.2} color="#ffffff" />

            {/* Post-Processing fixed Bloom for elements with emissive materials or toneMapped={false} */}
            <EffectComposer>
                <Bloom luminanceThreshold={1} mipmapBlur intensity={2.0} radius={0.5} />
            </EffectComposer>

            {/* F1 Style Volumetric Track Base */}
            <Tube args={[trackCurve, 200, 0.4, 16, true]}>
                <meshPhysicalMaterial 
                    color="#141414" 
                    roughness={0.2} 
                    metalness={0.8}
                    clearcoat={1}
                    transmission={0.8}
                    thickness={1.5}
                    transparent
                    opacity={0.8}
                />
            </Tube>
            {/* F1 Style Track Inner Path (Crimson Center Line Glow) */}
            <Line
                points={trackCurve.getPoints(200)}
                color="#dc2626"
                lineWidth={3}
                position={[0, 0.05, 0]}
                toneMapped={false}
            />

            {/* Render Runner Blobs */}
            {runners.map((runner, idx) => (
                <RunnerBlob
                    key={runner.name}
                    runner={runner}
                    curve={trackCurve}
                    maxCompletion={maxCompletion}
                    index={idx}
                    fullName={fullNames[runner.name] || runner.name}
                    activeRunner={activeRunner}
                    hoveredRunner={hoveredRunner}
                    onRunnerSelect={onRunnerSelect}
                />
            ))}
        </>
    );
}

export default function F1TrackMap(props: F1TrackMapProps) {
    return (
        <div className="w-full h-full relative cursor-grab active:cursor-grabbing hover:cursor-grab">
            <Canvas camera={{ position: [0, 20, 25], fov: 40 }} shadows>
                <Scene {...props} />
            </Canvas>
        </div>
    );
}
