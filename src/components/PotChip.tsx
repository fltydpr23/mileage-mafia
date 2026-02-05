"use client";

import React, { useEffect, useRef, useState } from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Row({
  label,
  sub,
  value,
  accent,
}: {
  label: string;
  sub: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-neutral-200">{label}</div>
        <div className="text-xs text-neutral-500 mt-0.5">{sub}</div>
      </div>
      <div className={cx("text-sm font-semibold tabular-nums", accent ?? "text-white")}>
        {value}
      </div>
    </div>
  );
}

export default function PotChip({
  total,
  oathPot,
  penaltyFund,
}: {
  total: number;
  oathPot: number;
  penaltyFund: number;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / tap
  useEffect(() => {
    function onDown(e: MouseEvent | TouchEvent) {
      const el = wrapRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  // Close on Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={wrapRef} className="relative group">
      {/* Chip (button so it works on mobile) */}
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cx(
          "px-3 sm:px-4 py-2 rounded-full text-neutral-300 text-xs sm:text-sm",
          "bg-neutral-900/70 ring-1 ring-neutral-800",
          "hover:bg-white/5 transition",
          "focus:outline-none focus:ring-2 focus:ring-rose-300/30"
        )}
      >
        <span className="text-neutral-500">Prize pot</span>
        <span className="text-white font-semibold ml-2 tabular-nums">
          ₹{total.toLocaleString("en-IN")}
        </span>
      </button>

      {/* Popover: shows on hover (desktop) OR open (mobile) */}
      <div
        className={cx(
          "absolute right-0 top-[calc(100%+10px)] z-50 w-[min(320px,85vw)]",
          "transition duration-200 origin-top-right",
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-1 pointer-events-none",
          // Desktop hover support as well:
          "group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto"
        )}
        role="dialog"
        aria-label="Prize breakdown"
      >
        <div className="rounded-2xl bg-neutral-950/90 backdrop-blur-xl ring-1 ring-neutral-800 shadow-[0_16px_60px_rgba(0,0,0,0.65)] overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-800">
            <div className="text-xs uppercase tracking-wider text-neutral-500">
              Prize breakdown
            </div>
            <div className="text-sm text-neutral-300 mt-1">
              Total{" "}
              <span className="text-white font-semibold tabular-nums">
                ₹{total.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <div className="px-4 py-3 space-y-2">
            <Row
              label="Oath pot"
              sub="₹1000 per runner"
              value={`₹${oathPot.toLocaleString("en-IN")}`}
            />
            <Row
              label="Penalty fund"
              sub="Violations + disorderly conduct"
              value={`₹${penaltyFund.toLocaleString("en-IN")}`}
              accent="text-rose-200"
            />

            <div className="pt-2 border-t border-neutral-800">
              <div className="text-xs text-neutral-500 leading-relaxed">
                Penalty funds will be allocated towards{" "}
                <span className="text-neutral-200">challenges</span> +{" "}
                <span className="text-neutral-200">performance incentives</span>.
              </div>
            </div>

            {/* Mobile-only close hint */}
            <div className="pt-2 sm:hidden">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full py-2 rounded-xl bg-white/5 ring-1 ring-white/10 text-neutral-200 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
