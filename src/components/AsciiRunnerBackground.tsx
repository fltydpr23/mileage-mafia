"use client";

import React, { useEffect, useState } from "react";

const RUNNER_FRAMES = [
    [
        "      __ ",
        "    _(  )",
        "   / |\\\\/ ",
        "  /  |   ",
        " /  / \\  ",
        "    |  | ",
        "   /  /  ",
        "  (  (   "
    ].join("\n"),
    [
        "      __ ",
        "     (  )",
        "     /|\\\\ ",
        "    / | \\\\",
        "   /  |  ",
        "   | / \\ ",
        "   //   |",
        "  (/   / "
    ].join("\n"),
    [
        "      __ ",
        "     (  )",
        "    _|\\\\_ ",
        "   / |   ",
        "  / /|   ",
        "    | \\  ",
        "   /  /  ",
        "  (  (   "
    ].join("\n"),
    [
        "      __ ",
        "     (  )",
        "      |\\\\_",
        "      | \\\\",
        "    / |  ",
        "   / / \\ ",
        "   | \\  |",
        "   (  \\/ "
    ].join("\n")
];

export default function AsciiRunnerBackground({ isZooming }: { isZooming: boolean }) {
    const [frameIndex, setFrameIndex] = useState(0);
    const [noise, setNoise] = useState("");
    const [roadOffset, setRoadOffset] = useState(0);

    // Runner Animation Loop
    useEffect(() => {
        const interval = setInterval(() => {
            setFrameIndex((prev) => (prev + 1) % RUNNER_FRAMES.length);
        }, 120);
        return () => clearInterval(interval);
    }, []);

    // Road Animation Loop
    useEffect(() => {
        const roadInterval = setInterval(() => {
            setRoadOffset((prev) => (prev + 1) % 4);
        }, 60);
        return () => clearInterval(roadInterval);
    }, []);

    // Matrix Noise Generation Loop
    useEffect(() => {
        const generateNoise = () => {
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%\"'#&_(),.;:?!\\|{}<>[]^~";
            let result = "";
            // Keep resolution manageable so we don't freeze the browser
            const cols = Math.floor(window.innerWidth / 20) || 50;
            const rows = Math.floor(window.innerHeight / 20) || 30;

            for (let i = 0; i < rows; i++) {
                for (let j = 0; j < cols; j++) {
                    if (Math.random() > 0.85) {
                        result += chars.charAt(Math.floor(Math.random() * chars.length));
                    } else {
                        result += " ";
                    }
                }
                result += "\n";
            }
            return result;
        };

        // Initial paint
        if (typeof window !== "undefined") {
            setNoise(generateNoise());
        }

        const noiseInterval = setInterval(() => {
            setNoise(generateNoise());
        }, 100);

        return () => clearInterval(noiseInterval);
    }, []);

    // Road pattern generator based on offset
    const getRoad = () => {
        const pattern = [
            "/ / / / / / / / / / / / / / / / /",
            " / / / / / / / / / / / / / / / / ",
            "  / / / / / / / / / / / / / / / /",
            "/  / / / / / / / / / / / / / / / "
        ];
        return `
${pattern[roadOffset]}
---------------------------------
${pattern[(roadOffset + 2) % 4]}
        `;
    };

    return (
        <div
            className={`absolute inset-0 bg-[#050505] overflow-hidden flex flex-col items-center justify-center transition-all duration-[1500ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isZooming ? "scale-[15] opacity-0 blur-md translate-z-[100px]" : "scale-100 opacity-100 blur-0"
                }`}
            style={{ perspective: "1000px" }}
        >
            {/* Background Matrix Noise */}
            <pre className="absolute inset-0 text-[#00ff41]/20 font-mono text-[14px] leading-[20px] whitespace-pre p-4 pointer-events-none overflow-hidden select-none">
                {noise}
            </pre>

            {/* Central Animated Runner */}
            <div className="relative z-10 p-8 pt-12 rounded-xl bg-black/60 shadow-[0_0_60px_rgba(0,255,65,0.15)] border border-[#00ff41]/20 backdrop-blur-sm flex flex-col items-center select-none perspective-[500px]">

                {/* Holographic glowing text effect */}
                <pre className="text-[#00ff41] font-mono whitespace-pre text-[32px] md:text-[40px] leading-[28px] md:leading-[36px] drop-shadow-[0_0_15px_rgba(0,255,65,0.9)] font-bold text-center relative z-20">
                    {RUNNER_FRAMES[frameIndex]}
                </pre>

                {/* Animated Floor/Road */}
                <pre className="text-[#00ff41]/50 font-mono whitespace-pre text-lg mt-6 drop-shadow-[0_0_5px_rgba(0,255,65,0.4)] text-center transform scale-y-50 rotate-x-[60deg]">
                    {getRoad()}
                </pre>
            </div>
        </div>
    );
}
