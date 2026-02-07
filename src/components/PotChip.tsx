"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";

function money(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function PotChip({
  total,
  oathPot,
  penaltyFund,
  leaderBonus = 0,
  soldierReward = 0,
  areaDonReward = 0,
}: {
  total: number;
  oathPot: number;
  penaltyFund: number;
  leaderBonus?: number;  // optional if you want to show it
  soldierReward?: number; // optional
  areaDonReward?: number; // optional
}) {
  const [open, setOpen] = useState(false);

  const splitLines = useMemo(() => {
    const lines: Array<{ label: string; value: number }> = [
      { label: "Oath pot", value: oathPot },
      { label: "Penalty fund", value: penaltyFund },
    ];

    // Optional “uses” preview (if you track them)
    if (leaderBonus) lines.push({ label: "Leader bonus", value: leaderBonus });
    if (soldierReward) lines.push({ label: "First Soldier reward", value: soldierReward });
    if (areaDonReward) lines.push({ label: "First Area Don reward", value: areaDonReward });

    return lines;
  }, [oathPot, penaltyFund, leaderBonus, soldierReward, areaDonReward]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <Link
        href="/pot"
        className="px-3 sm:px-4 py-2 rounded-full bg-neutral-900/70 ring-1 ring-neutral-800 text-neutral-300 text-xs sm:text-sm inline-flex items-center gap-2 hover:bg-white/[0.04] transition"
        aria-label="Open pot breakdown"
      >
        <span className="text-neutral-500">Pot</span>
        <span className="text-white font-semibold tabular-nums">{money(total)}</span>
        <span className="text-neutral-600 text-[12px] leading-none">↗</span>
      </Link>

      {/* Hover tooltip */}
      {open ? (
        <div className="absolute right-0 mt-2 w-[260px] rounded-2xl bg-neutral-950/95 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_18px_70px_rgba(0,0,0,0.65)] p-3 z-50">
          <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">
            Split preview
          </p>

          <div className="mt-2 space-y-1.5">
            {splitLines.map((x) => (
              <div key={x.label} className="flex items-center justify-between text-sm">
                <span className="text-neutral-400">{x.label}</span>
                <span className="text-white font-semibold tabular-nums">
                  {money(x.value)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 text-[11px] text-neutral-500">
            Click to open full breakdown →
          </div>
        </div>
      ) : null}
    </div>
  );
}

