"use client";

import React, { useEffect, useState } from "react";
import HubClient from "./HubClient";
import F1LeaderboardClient from "./F1LeaderboardClient";

interface Runner {
    name: string;
    yearlyKm: number;
    completion: number;
    rank: number;
    weeklyTarget: number;
    annualTarget: number;
    runHistory: any[];
}

interface LeaderboardWrapperProps {
    runners: Runner[];
    globalStats: any;
}

export default function LeaderboardWrapper({ runners, globalStats }: LeaderboardWrapperProps) {
    const [isMobile, setIsMobile] = useState<boolean | null>(null);

    useEffect(() => {
        // Run once on mount to get initial screen size
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();

        // Listen for resize events
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Prevent hydration mismatch by rendering nothing until layout is known
    if (isMobile === null) return null;

    if (isMobile) {
        return <F1LeaderboardClient runners={runners} globalStats={globalStats} />;
    }

    return <HubClient runners={runners} globalStats={globalStats} />;
}
