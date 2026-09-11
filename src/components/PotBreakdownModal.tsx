"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface PotBreakdownModalProps {
    isOpen: boolean;
    onClose: () => void;
    globalStats: {
        totalPot: number;
        oathPot: number;
        penaltyFund: number;
        zeroKmFinesTotal?: number;
    };
}

export default function PotBreakdownModal({ isOpen, onClose, globalStats }: PotBreakdownModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const zeroKmFines = globalStats.zeroKmFinesTotal ?? 19500;
    const briberyPenalties = 1000;
    const oathPot = globalStats.oathPot ?? 12000;
    const totalPot = globalStats.totalPot ?? (oathPot + zeroKmFines + briberyPenalties);

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 pointer-events-auto">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                    />

                    {/* Popover Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 15 }}
                        transition={{ type: "spring", stiffness: 350, damping: 28 }}
                        className="relative w-full max-w-sm bg-[#0c0c0e] border border-white/15 rounded-3xl p-6 shadow-2xl overflow-hidden"
                    >
                        {/* Subtle Glow */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-white/10">
                            <div>
                                <div className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-widest">SYNDICATE TREASURY</div>
                                <h3 className="text-xl font-black text-white font-mono mt-0.5">Pot Breakdown</h3>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-300 hover:text-white font-mono font-bold transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Total Highlight */}
                        <div className="my-5 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-red-500/5 to-transparent border border-amber-500/20 flex items-center justify-between">
                            <div>
                                <div className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Total Prize Pool</div>
                                <div className="text-2xl font-black font-mono text-amber-400 mt-0.5">
                                    ₹{totalPot.toLocaleString()}
                                </div>
                            </div>
                            <div className="text-2xl">💰</div>
                        </div>

                        {/* Splits List */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                                <div className="flex items-center gap-2.5">
                                    <span className="text-base">🛡️</span>
                                    <div>
                                        <div className="text-xs font-mono font-bold text-white">Oath Fund</div>
                                        <div className="text-[9px] font-mono text-zinc-400">₹1,000 × 12 Runners</div>
                                    </div>
                                </div>
                                <div className="text-sm font-black font-mono text-emerald-400">
                                    ₹{oathPot.toLocaleString()}
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                                <div className="flex items-center gap-2.5">
                                    <span className="text-base">⚠️</span>
                                    <div>
                                        <div className="text-xs font-mono font-bold text-white">Zero-KM Fines</div>
                                        <div className="text-[9px] font-mono text-zinc-400">2+ B2B zero weeks</div>
                                    </div>
                                </div>
                                <div className="text-sm font-black font-mono text-red-400">
                                    ₹{zeroKmFines.toLocaleString()}
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                                <div className="flex items-center gap-2.5">
                                    <span className="text-base">🚨</span>
                                    <div>
                                        <div className="text-xs font-mono font-bold text-white">Disorderly Conduct</div>
                                        <div className="text-[9px] font-mono text-zinc-400">Bribery Penalties</div>
                                    </div>
                                </div>
                                <div className="text-sm font-black font-mono text-amber-400">
                                    ₹{briberyPenalties.toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* CTA Link */}
                        <div className="mt-6 pt-4 border-t border-white/10">
                            <Link
                                href="/pot"
                                onClick={onClose}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-mono font-black text-xs tracking-widest uppercase transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98]"
                            >
                                <span>VIEW ITEMIZATION LEDGER</span>
                                <span>→</span>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
