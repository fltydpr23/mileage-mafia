"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Keep in sync with sheet mapping on the server page */
type RunnerRow = {
  name: string;
  yearlyKm: number;
  completion: number;
  rank: number;
  weeklyTarget: number;
  annualTarget: number;
};

type Penalty = { name: string; amount: number; reason: string; date: string };

function slugifyName(name: string) {
  return encodeURIComponent(name.trim());
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/**
 * Must match your styling tokens
 */
const MAFIA_LEVELS = [
  {
    minKm: 1800,
    name: "Godfather",
    pill: "bg-red-900 text-red-50 ring-1 ring-red-700/40",
    tint: "bg-red-900/15 ring-red-700/35",
    bar: "bg-red-800",
    desc: "1800+ km",
  },
  {
    minKm: 1000,
    name: "Underboss",
    pill: "bg-rose-950 text-rose-50 ring-1 ring-rose-700/35",
    tint: "bg-rose-950/15 ring-rose-700/30",
    bar: "bg-rose-800",
    desc: "1000–1799 km",
  },
  {
    minKm: 500,
    name: "Area Don",
    pill: "bg-amber-900 text-amber-50 ring-1 ring-amber-700/35",
    tint: "bg-amber-900/15 ring-amber-700/30",
    bar: "bg-amber-700",
    desc: "500–999 km",
  },
  {
    minKm: 250,
    name: "Soldier",
    pill: "bg-emerald-950 text-emerald-50 ring-1 ring-emerald-700/30",
    tint: "bg-emerald-950/18 ring-emerald-700/25",
    bar: "bg-emerald-700",
    desc: "250–499 km",
  },
  {
    minKm: 0,
    name: "Associate",
    pill: "bg-neutral-700 text-neutral-100 ring-1 ring-neutral-500/30",
    tint: "bg-neutral-800/40 ring-neutral-500/25",
    bar: "bg-neutral-500",
    desc: "0–249 km",
  },
] as const;

function getMafiaLevel(km: number) {
  return (
    MAFIA_LEVELS.find((l) => km >= l.minKm) ??
    MAFIA_LEVELS[MAFIA_LEVELS.length - 1]
  );
}

/**
 * Compare state is stored in URL:
 * ?compare=1&r=Name&r=Name...
 * -> survives refresh/incognito and is shareable.
 */
function useCompareParams() {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();

  const compareOn = sp.get("compare") === "1";
  const selected = sp.getAll("r");

  const setParams = useCallback(
    (nextCompareOn: boolean, nextSelected: string[]) => {
      const p = new URLSearchParams(sp.toString());
      p.delete("compare");
      p.delete("r");

      if (nextCompareOn) p.set("compare", "1");
      for (const name of nextSelected) p.append("r", name);

      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, sp]
  );

  const toggleCompare = useCallback(() => {
    const next = !compareOn;
    setParams(next, next ? selected : []);
  }, [compareOn, selected, setParams]);

  const toggleRunner = useCallback(
    (name: string) => {
      const isSel = selected.includes(name);
      let next = selected.slice();

      if (isSel) next = next.filter((x) => x !== name);
      else {
        if (next.length >= 4) return; // max 4
        next.push(name);
      }

      setParams(true, next);
    },
    [selected, setParams]
  );

  const clear = useCallback(() => setParams(true, []), [setParams]);

  return { compareOn, selected, toggleCompare, toggleRunner, clear, setParams };
}

export default function LeaderboardRunnersClient({
  sorted,
  penalties,
  appHeaderH,
  listHeaderH,
  sortLabel,
}: {
  sorted: RunnerRow[];
  penalties: Penalty[];
  appHeaderH: number;
  listHeaderH: number;
  sortLabel: string;
}) {
  const { compareOn, selected, toggleCompare, toggleRunner, clear, setParams } =
    useCompareParams();

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const compareHref = useMemo(() => {
    const p = new URLSearchParams();
    selected.slice(0, 4).forEach((name) => p.append("r", name));
    return `/compare?${p.toString()}`;
  }, [selected]);

  const canCompare = selected.length >= 2;

  return (
    <div className="mt-8">
      {/* Leaderboard header + Compare button */}
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <p className="text-emerald-500 text-[10px] uppercase tracking-widest font-bold flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            GLOBAL DATABASE
          </p>

          <div className="mt-2 flex items-center gap-4">
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">All Agents</h3>

            <button
              type="button"
              onClick={toggleCompare}
              className={clsx(
                "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ring-1 transition-all",
                compareOn
                  ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                  : "bg-white/5 text-neutral-400 ring-white/10 hover:ring-white/20 hover:text-white"
              )}
              title="Select up to 4 runners"
            >
              COMPARE {compareOn ? `(${selected.length}/4)` : ""}
            </button>
          </div>
        </div>

        <p className="text-neutral-500 text-[10px] uppercase tracking-widest text-right">
          SORT_BY:{" "}
          <span className="text-neutral-300 font-bold">{sortLabel}</span>
        </p>
      </div>

      {/* List */}
      <section className="rounded-3xl bg-neutral-900/40 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.5)] overflow-hidden">
        <div
          className="hidden sm:block sticky z-30 bg-neutral-900/80 backdrop-blur-md border-b border-white/5"
          style={{ top: appHeaderH, height: listHeaderH }}
        >
          <div className="grid grid-cols-12 gap-4 px-6 md:px-8 h-full items-center text-[10px] uppercase tracking-widest text-neutral-400 font-bold">
            <div className="col-span-1 border-r border-white/5">#</div>
            <div className="col-span-6 border-r border-white/5 px-4">AGENT IDENT</div>
            <div className="col-span-2 text-right border-r border-white/5 px-4">DISTANCE</div>
            <div className="col-span-2 text-right border-r border-white/5 px-4">POWER</div>
            <div className="col-span-1 text-right" />
          </div>
        </div>

        <div className="divide-y divide-white/5 sm:pt-[56px]">
          {sorted.map((r, idx) => {
            const lvl = getMafiaLevel(r.yearlyKm);
            const pct = Math.min(Math.max(r.completion, 0), 100);
            const rankShown = r.rank ? r.rank : idx + 1;

            const isLeader = rankShown === 1;
            const isPenalized = penalties.some(
              (p) => p.name.toLowerCase() === r.name.toLowerCase()
            );

            const checked = selectedSet.has(r.name);

            const rowInner = (
              <>
                {/* MOBILE */}
                <div className="sm:hidden px-4 py-5 hover:bg-white/5 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-11 w-11 rounded-2xl ring-1 ${lvl.tint} flex items-center justify-center font-black shrink-0`}
                      >
                        {initials(r.name)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="text-neutral-400 font-semibold tabular-nums">
                            #{rankShown}
                          </div>
                          <div className="font-bold text-base truncate">
                            {r.name}
                          </div>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${lvl.pill}`}
                          >
                            {lvl.name}
                          </span>

                          {isLeader ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-200">
                              +₹ 1,000
                            </span>
                          ) : null}

                          {isPenalized ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-500/10 text-red-200 ring-1 ring-red-500/20">
                              -₹ 500
                            </span>
                          ) : null}

                          <div className="text-neutral-400 text-xs tabular-nums">
                            {Math.round(r.yearlyKm).toLocaleString("en-IN")} km •{" "}
                            {pct.toFixed(1)}%
                          </div>
                        </div>

                        <div className="mt-3 h-2 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${lvl.bar}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        <div className="mt-2 text-neutral-500 text-xs">
                          Target {Math.round(r.annualTarget)} km • Weekly{" "}
                          {Math.round(r.weeklyTarget)} km
                        </div>
                      </div>
                    </div>

                    <div className="text-neutral-500 text-2xl leading-none">›</div>
                  </div>
                </div>

                {/* DESKTOP */}
                <div className="hidden sm:block px-6 md:px-8 py-5 hover:bg-white/5 transition-colors relative group/row">
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent group-hover/row:bg-emerald-500 transition-colors" />
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-1 text-neutral-500 font-semibold tabular-nums text-sm">
                      {rankShown < 10 ? `0${rankShown}` : rankShown}
                    </div>

                    <div className="col-span-6 min-w-0">
                      <div className="flex items-center gap-4 min-w-0">
                        <div
                          className={`h-11 w-11 rounded-2xl ring-1 ${lvl.tint} flex items-center justify-center font-black`}
                        >
                          {initials(r.name)}
                        </div>

                        <div className="min-w-0 w-full">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex items-center gap-2">
                              <p className="font-bold tracking-tight text-lg truncate group-hover/row:text-white transition-colors">{r.name}</p>

                              {isLeader ? (
                                <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                  +₹ 1,000
                                </span>
                              ) : null}

                              {isPenalized ? (
                                <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
                                  -₹ 500
                                </span>
                              ) : null}
                            </div>

                            <span
                              className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${lvl.pill}`}
                            >
                              {lvl.name}
                            </span>
                          </div>

                          <p className="text-neutral-500 text-sm mt-1">
                            Target {Math.round(r.annualTarget)} km • Weekly{" "}
                            {Math.round(r.weeklyTarget)} km
                          </p>

                          <div className="mt-3 h-2 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${lvl.bar}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 text-right">
                      <p className="text-white font-semibold tabular-nums text-lg">
                        {Math.round(r.yearlyKm).toLocaleString("en-IN")}
                      </p>
                      <p className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest mt-0.5">KM</p>
                    </div>

                    <div className="col-span-2 text-right">
                      <p className="text-white font-semibold tabular-nums text-lg">
                        {pct.toFixed(1)}
                      </p>
                      <p className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest mt-0.5">PWR</p>
                    </div>

                    <div className="col-span-1 text-right text-neutral-600 group-hover/row:text-emerald-500 transition-colors">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block"><path d="M9 18l6-6-6-6" /></svg>
                    </div>
                  </div>
                </div>
              </>
            );

            // Compare mode (no navigation; selection)
            if (compareOn) {
              return (
                <div
                  key={r.name}
                  className={clsx("relative", checked ? "bg-emerald-500/[0.06]" : "")}
                >
                  <button
                    type="button"
                    onClick={() => toggleRunner(r.name)}
                    className="w-full text-left"
                    title={checked ? "Remove from compare" : "Add to compare"}
                  >
                    {rowInner}
                  </button>

                  <div className="absolute top-4 right-4 sm:top-6 sm:right-8">
                    <div
                      className={clsx(
                        "h-7 w-7 rounded-full grid place-items-center ring-1 transition",
                        checked
                          ? "bg-emerald-500/15 ring-emerald-500/35"
                          : "bg-white/5 ring-white/10"
                      )}
                    >
                      <span className={clsx("text-sm", checked ? "text-emerald-200" : "text-neutral-400")}>
                        {checked ? "✓" : "+"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            // Normal mode (navigation)
            return (
              <Link
                key={r.name}
                href={`/runners/${slugifyName(r.name)}`}
                className="block"
              >
                {rowInner}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Sticky compare bar */}
      {compareOn ? (
        <div className="fixed inset-x-0 bottom-0 z-50 px-4 sm:px-6 pb-4">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-2xl bg-neutral-900/80 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_18px_70px_rgba(0,0,0,0.65)] px-4 sm:px-6 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                    Compare Mode Active
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {selected.length === 0 ? (
                      <span className="text-neutral-400 text-sm">
                        Select up to 4 runners.
                      </span>
                    ) : (
                      selected.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => toggleRunner(name)}
                          className="px-3 py-1 rounded-full bg-white/5 ring-1 ring-white/10 text-neutral-200 text-xs font-medium hover:bg-white/10 transition-all"
                          title="Remove"
                        >
                          {name} <span className="text-neutral-500 ml-1">×</span>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="mt-2 text-[10px] uppercase tracking-widest text-neutral-500 font-bold">
                    {selected.length < 2 ? "Pick at least 2 to compare." : "Ready."}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={clear}
                    className="px-4 py-2 rounded-xl bg-white/5 ring-1 ring-white/10 text-neutral-300 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
                  >
                    Clear
                  </button>

                  <Link
                    href={canCompare ? compareHref : "#"}
                    onClick={(e) => {
                      if (!canCompare) e.preventDefault();
                    }}
                    className={clsx(
                      "px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                      canCompare
                        ? "bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:bg-emerald-400 hover:-translate-y-0.5"
                        : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                    )}
                  >
                    Compare
                  </Link>

                  <button
                    type="button"
                    onClick={() => setParams(false, [])}
                    className="px-4 py-2 rounded-xl bg-white text-black text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-100 transition-colors"
                    title="Exit compare mode"
                  >
                    Done
                  </button>
                </div>
              </div>

              <div className="mt-3 text-[10px] uppercase tracking-widest text-neutral-600 font-medium">
                Tip: the URL becomes shareable.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

