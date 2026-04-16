"use client";

import React, { useMemo, useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Dynamic import with SSR disabled to prevent Recharts hydration errors
const ScatterChartComponent = dynamic(() => import("recharts").then(mod => {
    const { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } = mod;
    
    function fmtPace(minKm: number) {
        if (!minKm || !Number.isFinite(minKm) || minKm <= 0) return "—";
        const m = Math.floor(minKm);
        const s = Math.round((minKm - m) * 60);
        return `${m}:${String(s).padStart(2, "0")}`;
    }

    const CustomTooltip = ({ active, payload, color }: any) => {
        if (active && payload && payload.length) {
            const pt = payload[0].payload;
            return (
                <div className="bg-neutral-950/90 backdrop-blur-md border border-white/20 p-3 rounded-lg shadow-2xl space-y-1">
                    <div className="text-[10px] uppercase text-neutral-400 font-bold tracking-widest">{pt.date}</div>
                    <div className="flex items-center gap-3 pt-1">
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-white">{pt.dist.toFixed(1)}</span>
                            <span className="text-[10px] text-neutral-500 font-bold">KM</span>
                        </div>
                        <div className="h-6 w-px bg-white/20" />
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black" style={{ color }}>{fmtPace(pt.pace)}</span>
                            <span className="text-[10px] text-neutral-500 font-bold">/KM</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return function Chart({ data, color }: { data: any[], color: string }) {
        return (
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                    <XAxis 
                        type="number" 
                        dataKey="dist" 
                        name="Distance" 
                        unit=" km" 
                        tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                        axisLine={{ stroke: "rgba(255,255,255,0.05)" }}
                        tickLine={false}
                        domain={['dataMin - 1', 'dataMax + 1']}
                        label={{ value: "DISTANCE (KM)", position: 'insideBottom', offset: -15, fill: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: 700, className: "uppercase tracking-widest" }}
                    />
                    <YAxis 
                        type="number" 
                        dataKey="pace" 
                        name="Pace" 
                        tickFormatter={(val) => fmtPace(val)}
                        tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                        axisLine={{ stroke: "rgba(255,255,255,0.05)" }}
                        tickLine={false}
                        reversed={true} 
                        domain={['auto', 'auto']}
                        label={{ value: "PACE (MIN/KM)", angle: -90, position: 'insideLeft', offset: 15, fill: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: 700, className: "uppercase tracking-widest" }}
                    />
                    <ZAxis type="number" range={[40, 40]} />
                    <Tooltip content={<CustomTooltip color={color} />} cursor={{ strokeDasharray: '3 3', stroke: "rgba(255,255,255,0.1)" }} />
                    <Scatter name="Runs" data={data} fill={color} fillOpacity={0.6} className="transition-all duration-300 hover:fill-opacity-100 cursor-pointer" />
                </ScatterChart>
            </ResponsiveContainer>
        );
    };
}), { ssr: false });

export default function PaceScatterMap({ runHistory, color = "#06b6d4" }: { runHistory: any[], color?: string }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const data = useMemo(() => {
        const validRuns = runHistory.filter(r => r.distance > 0 && r.time > 0);
        return validRuns.map((r, i) => {
            const pace = r.time / r.distance;
            return {
                id: i,
                dist: parseFloat(r.distance.toFixed(1)),
                pace: parseFloat(pace.toFixed(2)),
                date: r.date
            };
        });
    }, [runHistory]);

    if (!mounted || !data.length) {
        return (
            <div className="w-full flex items-center justify-center h-[250px] border border-white/5 rounded-xl bg-black/20">
                <span className="text-neutral-600 text-xs uppercase tracking-widest font-black">
                    {!data.length ? "No pace data acquired" : "Initializing telemetery..."}
                </span>
            </div>
        );
    }

    return (
        <div className="w-full relative h-[320px] font-mono">
            <ScatterChartComponent data={data} color={color} />
        </div>
    );
}
