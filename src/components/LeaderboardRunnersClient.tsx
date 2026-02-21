"use client";

import React, { useCallback, useMemo } from "react";
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
    <>
      {/* Leaderboard header + Compare button */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-neutral-400 text-xs uppercase tracking-wider">
            Leaderboard
          </p>

          <div className="mt-1 flex items-center gap-2">
            <h3 className="text-xl sm:text-2xl font-bold">Runners</h3>

            <button
              type="button"
              onClick={toggleCompare}
              className={clsx(
                "px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-[0.18em] ring-1 transition",
                compareOn
                  ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/25"
                  : "bg-white/5 text-neutral-200 ring-white/10 hover:bg-white/10"
              )}
              title="Select up to 4 runners"
            >
              Compare{compareOn ? ` (${selected.length}/4)` : ""}
            </button>
          </div>
        </div>

        <p className="text-neutral-500 text-sm text-right">
          Sorted by{" "}
          <span className="text-neutral-300">{sortLabel}</span>
        </p>
      </div>

      {/* List */}
      <section className="rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 overflow-hidden">
        <div
          className="hidden sm:block sticky z-30 bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-800"
          style={{ top: appHeaderH, height: listHeaderH }}
        >
          <div className="grid grid-cols-12 gap-4 px-6 md:px-8 h-full items-center text-xs uppercase tracking-wider text-neutral-500">
            <div className="col-span-1">#</div>
            <div className="col-span-6">Runner</div>
            <div className="col-span-2 text-right">KM</div>
            <div className="col-span-2 text-right">%</div>
            <div className="col-span-1 text-right" />
          </div>
        </div>

        <div className="divide-y divide-neutral-800 sm:pt-[56px]">
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
                <div className="hidden sm:block px-6 md:px-8 py-6 hover:bg-white/5 transition">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-1 text-neutral-400 font-semibold tabular-nums">
                      {rankShown}
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
                              <p className="font-bold text-lg truncate">{r.name}</p>

                              {isLeader ? (
                                <span className="shrink-0 px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-200">
                                  +₹ 1,000
                                </span>
                              ) : null}

                              {isPenalized ? (
                                <span className="shrink-0 px-3 py-1 rounded-full text-[11px] font-extrabold bg-red-500/10 text-red-200 ring-1 ring-red-500/20">
                                  -₹ 500
                                </span>
                              ) : null}
                            </div>

                            <span
                              className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-extrabold ${lvl.pill}`}
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
                      <p className="text-neutral-500 text-xs">km</p>
                    </div>

                    <div className="col-span-2 text-right">
                      <p className="text-white font-semibold tabular-nums text-lg">
                        {pct.toFixed(1)}
                      </p>
                      <p className="text-neutral-500 text-xs">%</p>
                    </div>

                    <div className="col-span-1 text-right text-neutral-500">
                      <span className="text-2xl leading-none">›</span>
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
            <div className="rounded-3xl bg-neutral-950/75 backdrop-blur-xl ring-1 ring-neutral-800 shadow-[0_18px_70px_rgba(0,0,0,0.65)] px-4 sm:px-5 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.28em] text-neutral-500">
                    Compare
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2">
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
                          className="px-3 py-1 rounded-full bg-white/5 ring-1 ring-white/10 text-neutral-200 text-xs font-semibold hover:bg-white/10 transition"
                          title="Remove"
                        >
                          {name} <span className="text-neutral-500 ml-1">×</span>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="mt-2 text-xs text-neutral-600">
                    {selected.length < 2 ? "Pick at least 2 to compare." : "Ready."}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={clear}
                    className="px-4 py-2 rounded-2xl bg-white/5 ring-1 ring-white/10 text-neutral-200 text-xs font-extrabold uppercase tracking-[0.18em] hover:bg-white/10 transition"
                  >
                    Clear
                  </button>

                  <Link
                    href={canCompare ? compareHref : "#"}
                    onClick={(e) => {
                      if (!canCompare) e.preventDefault();
                    }}
                    className={clsx(
                      "px-4 py-2 rounded-2xl text-xs font-extrabold uppercase tracking-[0.18em] transition",
                      canCompare
                        ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/25 hover:bg-emerald-500/20"
                        : "bg-white/5 text-neutral-500 ring-1 ring-white/10 cursor-not-allowed"
                    )}
                  >
                    Compare →
                  </Link>

                  <button
                    type="button"
                    onClick={() => setParams(false, [])}
                    className="px-4 py-2 rounded-2xl bg-white text-black text-xs font-extrabold uppercase tracking-[0.18em] hover:opacity-90 transition"
                    title="Exit compare mode"
                  >
                    Done
                  </button>
                </div>
              </div>

              <div className="mt-3 text-[10px] uppercase tracking-[0.28em] text-neutral-700">
                Tip: the URL becomes shareable.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

