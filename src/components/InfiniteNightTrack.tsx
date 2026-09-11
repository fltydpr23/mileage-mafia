"use client";

import React, { useRef } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import * as THREE from 'three';

const InfiniteGridMaterial = {
    uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color("#ef4444") },
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vPos;
        uniform float uTime;
        void main() {
            vUv = uv;
            vec3 pos = position;
            float elevation = sin(pos.x * 2.0 + uTime * 0.5) * 0.1 + cos(pos.y * 2.0 + uTime * 0.5) * 0.1;
            pos.z += elevation;
            vPos = pos;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        varying vec3 vPos;
        uniform float uTime;
        uniform vec3 uColor;
        void main() {
            vec2 gridUv = vUv * vec2(40.0, 100.0);
            gridUv.y -= uTime * 5.0; // speed
            
            vec2 grid = fract(gridUv);
            float lineX = smoothstep(0.0, 0.05, grid.x) * smoothstep(1.0, 0.95, grid.x);
            float lineY = smoothstep(0.0, 0.03, grid.y) * smoothstep(1.0, 0.97, grid.y);
            float lines = 1.0 - (lineX * lineY);
            
            float depthFade = smoothstep(0.9, 0.1, vUv.y);
            float sideFade = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
            float intensity = lines * depthFade * sideFade;
            
            gl_FragColor = vec4(uColor, intensity * 0.8);
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
};

extend({ InfiniteGridMaterialGateway: shaderMaterial(InfiniteGridMaterial) });

declare global {
    namespace JSX {
        interface IntrinsicElements {
            infiniteGridMaterialGateway: any;
        }
    }
}
function shaderMaterial(material: any) {
    return class extends THREE.ShaderMaterial {
        constructor() {
            super(material);
        }
    }
}

function Highway() {
    const materialRef = useRef<any>(null);
    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, -20]}>
            <planeGeometry args={[40, 100, 64, 64]} />
            {/* @ts-ignore */}
            <infiniteGridMaterialGateway
                ref={materialRef}
                transparent={true}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
            />
        </mesh>
    );
}

export default function InfiniteNightTrack() {
    return (
        <div className="absolute inset-0 z-0 pointer-events-none">
            <Canvas
                gl={{ antialias: true, alpha: false }}
                camera={{ position: [0, 2, 8], fov: 60 }}
            >
                <color attach="background" args={['#050505']} />
                <fog attach="fog" args={['#050505', 10, 40]} />
                <Highway />
            </Canvas>
        </div>
    );
}
