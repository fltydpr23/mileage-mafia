"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface SyndicateNavProps {
    currentMode?: "track" | "stats";
    onModeSelect?: (mode: "track" | "stats") => void;
}

export default function SyndicateNav({ currentMode, onModeSelect }: SyndicateNavProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const navItems = [
        { label: "TELEMETRY", href: "/leaderboard", icon: "🏎️", mode: "track" as const },
        { label: "STANDINGS", href: "/leaderboard", icon: "🏆", mode: "stats" as const },
        { label: "FINES & POT", href: "/pot", icon: "💸" },
        { label: "SYNDICATE RULES", href: "/contracts", icon: "📜" },
        { label: "UPCOMING RACES", href: "/races", icon: "🏁" },
    ];

    const handleItemClick = (item: typeof navItems[0]) => {
        if (item.mode && onModeSelect) {
            onModeSelect(item.mode);
        }
        setMenuOpen(false);
    };

    return (
        <>
            {/* Hamburger Button (Mobile Only) */}
            <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden z-[110] flex flex-col justify-center items-center w-9 h-9 rounded-xl bg-white/10 border border-white/20 active:scale-95 transition-all shrink-0"
                aria-label="Toggle Syndicate Navigation Menu"
            >
                <div className="w-4 h-[2px] bg-white rounded-full transition-all transform origin-center" style={{ transform: menuOpen ? "rotate(45deg) translate(0px, 3.5px)" : "none" }} />
                <div className="w-4 h-[2px] bg-red-500 rounded-full my-[3px] transition-all" style={{ opacity: menuOpen ? 0 : 1 }} />
                <div className="w-4 h-[2px] bg-white rounded-full transition-all transform origin-center" style={{ transform: menuOpen ? "rotate(-45deg) translate(0px, -3.5px)" : "none" }} />
            </button>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1">
                <Link
                    href="/pot"
                    className="px-3 py-1.5 text-[10px] font-mono font-bold tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 rounded-lg transition-all"
                >
                    💸 FINES
                </Link>
                <Link
                    href="/contracts"
                    className="px-3 py-1.5 text-[10px] font-mono font-bold tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 rounded-lg transition-all"
                >
                    📜 RULES
                </Link>
                <Link
                    href="/races"
                    className="px-3 py-1.5 text-[10px] font-mono font-bold tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 rounded-lg transition-all"
                >
                    🏁 RACES
                </Link>
            </nav>

            {/* Mobile Hamburger Drawer Overlay (Portal to document.body) */}
            {mounted && createPortal(
                <AnimatePresence>
                    {menuOpen && (
                        <div className="fixed inset-0 z-[99999] md:hidden pointer-events-auto">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setMenuOpen(false)}
                                className="absolute inset-0 bg-black/85 backdrop-blur-xl"
                            />
                            <motion.div
                                initial={{ x: "100%" }}
                                animate={{ x: 0 }}
                                exit={{ x: "100%" }}
                                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                                className="absolute top-0 right-0 bottom-0 w-[290px] max-w-[85vw] bg-[#0a0a0c] border-l border-white/15 flex flex-col p-6 shadow-2xl overflow-y-auto"
                            >
                                {/* Drawer Header */}
                                <div className="flex items-center justify-between pb-5 border-b border-white/10">
                                    <div>
                                        <div className="text-base font-black italic tracking-widest text-white leading-none">MILEAGE<span className="text-red-600">MAFIA</span></div>
                                        <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Syndicate Command</div>
                                    </div>
                                    <button
                                        onClick={() => setMenuOpen(false)}
                                        className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-zinc-300 hover:text-white font-mono font-bold text-sm"
                                    >
                                        ✕
                                    </button>
                                </div>

                                {/* Nav Items */}
                                <div className="flex flex-col gap-2.5 py-6">
                                    {navItems.map((item) => (
                                        <Link
                                            key={item.label}
                                            href={item.href}
                                            onClick={() => handleItemClick(item)}
                                            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border text-xs font-mono font-bold tracking-widest transition-all ${
                                                item.mode && currentMode === item.mode
                                                    ? "bg-red-600/15 border-red-500/50 text-white shadow-lg shadow-red-950/40"
                                                    : "bg-white/[0.03] border-white/10 text-zinc-300 hover:bg-white/10 hover:border-white/20 active:scale-[0.98]"
                                            }`}
                                        >
                                            <span className="text-lg">{item.icon}</span>
                                            <span>{item.label}</span>
                                        </Link>
                                    ))}
                                </div>

                                {/* Footer stats / info */}
                                <div className="mt-auto pt-6 border-t border-white/10 space-y-2">
                                    <div className="text-[9px] font-mono text-red-500 font-bold uppercase tracking-widest">SEASON 2026 OFFICIAL</div>
                                    <div className="text-[10px] font-mono text-zinc-400 leading-relaxed">
                                        Zero-KM Rule: ₹500 fine per 2 consecutive zero weeks.
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}
