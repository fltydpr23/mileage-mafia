"use client";

import React, { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, MeshTransmissionMaterial, Environment, Float, Preload, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { motion } from "motion/react";

interface HolographicCardProps {
  name: string;
  yearlyKm: number;
  rank: string;
  onClickDossier: () => void;
}

function CardMesh({ name, yearlyKm, rank, onClickDossier }: HolographicCardProps) {
  const meshRef = useRef<THREE.Group>(null);
  const mouse = useRef(new THREE.Vector2());

  // Handle mouse move for parallax tilt
  useFrame(({ mouse: r3fMouse }) => {
    if (!meshRef.current) return;
    
    // Smooth lerp to mouse position
    meshRef.current.rotation.x = THREE.MathUtils.lerp(
      meshRef.current.rotation.x,
      (r3fMouse.y * Math.PI) / 10,
      0.05
    );
    meshRef.current.rotation.y = THREE.MathUtils.lerp(
      meshRef.current.rotation.y,
      (r3fMouse.x * Math.PI) / 10,
      0.05
    );
  });

  return (
    <Float floatIntensity={1} rotationIntensity={0.2} speed={2}>
      <group ref={meshRef}>
        <RoundedBox args={[3, 4.5, 0.1]} radius={0.1} smoothness={4}>
          <MeshTransmissionMaterial
            backside
            samples={4}
            thickness={0.5}
            chromaticAberration={0.4}
            anisotropy={0.3}
            distortion={0.1}
            distortionScale={0.5}
            temporalDistortion={0.1}
            clearcoat={1}
            attenuationDistance={0.5}
            attenuationColor="#ff0000"
            color="#1a1a1a"
          />
        </RoundedBox>

        {/* 3D Space HTML Overlay for perfect text rendering */}
        <Html transform position={[0, 0, 0.06]} zIndexRange={[100, 0]} className="pointer-events-none">
          <div className="w-[280px] h-[420px] flex flex-col p-6 items-center justify-between text-white pointer-events-auto selection:bg-red-500/30">
            {/* Header */}
            <div className="w-full flex justify-between items-start">
              <div className="text-[10px] font-bold text-red-500 tracking-[0.3em] uppercase">Driver</div>
              <div className="text-xl font-black text-zinc-500 tracking-widest">{rank || "N/A"}</div>
            </div>

            {/* Name */}
            <div className="text-4xl font-black uppercase tracking-widest text-shadow-sm shadow-red-500/20 my-4 text-center">
              {name}
            </div>

            {/* Stats */}
            <div className="flex flex-col items-center justify-center relative w-full mb-4 group">
                <div className="absolute inset-0 bg-red-600/5 blur-xl group-hover:bg-red-600/10 transition-colors duration-500 rounded-full" />
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1 relative">Distance</span>
                <span className="text-6xl font-black text-white relative drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                  <motion.span
                    key={yearlyKm}
                    initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  >
                    {yearlyKm.toFixed(0)}
                  </motion.span>
                </span>
                <span className="text-[10px] text-red-500 uppercase tracking-widest mt-1 relative">KM Logged</span>
            </div>

            {/* Action */}
            <button 
              onClick={onClickDossier} 
              className="w-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:border-white/30 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-2xl cursor-pointer pointer-events-auto"
            >
              <span className="bg-red-600/20 text-red-500 px-1.5 py-0.5 rounded text-[10px] tracking-widest border border-red-500/30">INTEL</span>
              <span className="tracking-widest text-sm uppercase text-zinc-200">View Dossier</span>
            </button>
          </div>
        </Html>
      </group>
    </Float>
  );
}

export default function HolographicCard(props: HolographicCardProps) {
  return (
    <div className="w-full h-full relative cursor-crosshair">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]} // Performance optimization
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} castShadow />
        <Environment preset="city" />
        <CardMesh {...props} />
        <Preload all />
      </Canvas>
    </div>
  );
}
