"use client";

import React from "react";
import HubClient from "./HubClient";

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
    return <HubClient runners={runners} globalStats={globalStats} />;
}
