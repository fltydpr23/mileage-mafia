"use client";

import React, { useEffect, useMemo, useState } from "react";

type RaceType = "Road" | "Trail" | "Ultra" | "Track" | "Other";
type RegistrationStatus = "Open" | "Closed" | "Waitlist" | "TBA";

type DistanceOption = {
  label: string;
  status: RegistrationStatus;
  url?: string;
};

type Race = {
  id: string;
  name: string;
  dateISO: string; // YYYY-MM-DD
  city: string;
  state?: string;
  type: RaceType;
  distances: DistanceOption[];
  notes?: string;
  registrationUrl?: string;
};

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

// ---------- Deterministic date formatting (prevents hydration mismatch) ----------
function parseISOToUTCDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}
function formatDateUTC(iso: string) {
  const d = parseISOToUTCDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

// ---------- Status helpers ----------
function statusClasses(status: RegistrationStatus) {
  switch (status) {
    case "Open":
      return "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/25";
    case "Closed":
      return "bg-red-500/10 text-red-200 ring-1 ring-red-500/25";
    case "Waitlist":
      return "bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/25";
    default:
      return "bg-white/5 text-neutral-300 ring-1 ring-white/10";
  }
}
function overallStatus(r: Race): RegistrationStatus {
  if (r.distances.some((d) => d.status === "Open")) return "Open";
  if (r.distances.some((d) => d.status === "Waitlist")) return "Waitlist";
  if (r.distances.every((d) => d.status === "Closed")) return "Closed";
  return "TBA";
}

const RACES: Race[] = [
  {
    id: "ooty-ultra",
    name: "Ooty Ultra",
    dateISO: "2026-03-22",
    city: "Ooty",
    state: "TN",
    type: "Trail",
    registrationUrl: "https://ootyultra.com/index.html",
    notes: "Hills + technical sections. Bring hydration.",
    distances: [
      { label: "15K", status: "Open", url: "https://ootyultra.com/index.html" },
      { label: "30K", status: "Open", url: "https://ootyultra.com/index.html" },
      { label: "50K", status: "Open", url: "https://ootyultra.com/index.html" },
      { label: "60K", status: "Open", url: "https://ootyultra.com/index.html" },
      { label: "75K", status: "Open", url: "https://ootyultra.com/index.html" },
      { label: "90K", status: "Open", url: "https://ootyultra.com/index.html" },
    ],
  },
  {
    id: "tcs-10k",
    name: "TCS World 10K Bengaluru",
    dateISO: "2026-04-26",
    city: "Bengaluru",
    state: "KA",
    type: "Road",
    registrationUrl: "https://tcsworld10k.procam.in",
    notes: "Tough to PR with the crowds, but great for the vibe and a solid workout.",
    distances: [{ label: "10K", status: "Closed", url: "https://tcsworld10k.procam.in" }],
  },
  {
    id: "backyard-ultra",
    name: "Bengaluru Backyard Ultra",
    dateISO: "2026-05-09",
    city: "Bengaluru",
    state: "KA",
    type: "Road",
    registrationUrl:
      "https://bigfootadventuresindia.com/bigfoot-backyard-ultra-series/bigfoot-backyard-ultra-bengaluru-chapter/",
    distances: [
      {
        label: "Last One Standing",
        status: "Open",
        url: "https://bigfootadventuresindia.com/bigfoot-backyard-ultra-series/bigfoot-backyard-ultra-bengaluru-chapter/",
      },
    ],
  },

  {
    id: "bison-ultra",
    name: "Bison Ultra",
    dateISO: "2026-06-07",
    city: "Yercaud",
    state: "TN",
    type: "Trail",
    registrationUrl: "https://bisonultra.com",
    notes: "Dirt paths mostly. Can get hot, so start early and carry fluids. Gorgeous views though.",
    distances: [
      { label: "18K", status: "Open", url: "https://bisonultra.com" },
      { label: "36K", status: "Open", url: "https://bisonultra.com" },
      { label: "45K", status: "Open", url: "https://bisonultra.com" },
      { label: "60K", status: "Open", url: "https://bisonultra.com" },
    ],
  },
  {
    id: "drhm",
    name: "Dreamrunners Half Marathon",
    dateISO: "2026-07-19",
    city: "Chennai",
    state: "TN",
    type: "Road",
    registrationUrl: "https://dreamrunners.in",
    notes: "Fully Flat, PB Course for sure.",
    distances: [
      { label: "10K", status: "TBA", url: "https://dreamrunners.in" },
      { label: "21.1K", status: "TBA", url: "https://dreamrunners.in" },
    ],
  },
  
];

const TYPES: Array<RaceType | "All"> = ["All", "Road", "Trail", "Ultra", "Track", "Other"];

export default function RacesPage() {
  const [mounted, setMounted] = useState(false);

  const [q, setQ] = useState("");
  const [type, setType] = useState<RaceType | "All">("All");
  const [distance, setDistance] = useState<string | "All">("All");
  const [onlyOpen, setOnlyOpen] = useState(false);

  // client-only countdown map
  const [daysMap, setDaysMap] = useState<Record<string, number>>({});

  useEffect(() => {
    setMounted(true);
    const today = new Date();
    const startLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const next: Record<string, number> = {};
    for (const r of RACES) {
      const d = new Date(r.dateISO + "T00:00:00");
      next[r.id] = Math.round((d.getTime() - startLocal.getTime()) / (1000 * 60 * 60 * 24));
    }
    setDaysMap(next);
  }, []);

  const allDistanceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of RACES) for (const d of r.distances) set.add(d.label);
    const arr = Array.from(set);
    arr.sort((a, b) => a.localeCompare(b));
    return ["All", ...arr] as const;
  }, []);

  const races = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = RACES.filter((r) => {
      const distLabels = r.distances.map((d) => d.label).join(" ");
      const matchesQ =
        !needle ||
        r.name.toLowerCase().includes(needle) ||
        r.city.toLowerCase().includes(needle) ||
        (r.state?.toLowerCase().includes(needle) ?? false) ||
        distLabels.toLowerCase().includes(needle) ||
        r.type.toLowerCase().includes(needle) ||
        (r.notes?.toLowerCase().includes(needle) ?? false);

      const matchesType = type === "All" ? true : r.type === type;
      const matchesDistance = distance === "All" ? true : r.distances.some((d) => d.label === distance);
      const matchesOpen = onlyOpen ? overallStatus(r) === "Open" : true;

      return matchesQ && matchesType && matchesDistance && matchesOpen;
    });

    filtered.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    return filtered;
  }, [q, type, distance, onlyOpen]);

  const nextRace = useMemo(() => {
    if (!mounted) return null;
    const upcoming = races.filter((r) => (daysMap[r.id] ?? 999999) >= 0);
    return upcoming[0] ?? null;
  }, [mounted, races, daysMap]);

  const nextRaceCountdown = useMemo(() => {
    if (!mounted || !nextRace) return "—";
    const d = daysMap[nextRace.id];
    if (typeof d !== "number") return "—";
    if (d < 0) return "past";
    if (d === 0) return "today";
    if (d === 1) return "tomorrow";
    return `${d}d`;
  }, [mounted, nextRace, daysMap]);

  return (
    <main className="min-h-screen text-white relative overflow-hidden">
      {/* Noir background */}
      <div className="pointer-events-none absolute inset-0 noir-layer">
        <div className="absolute inset-0 bg-[#050505]" />
        <div className="absolute inset-0 noir-static opacity-[0.10] mix-blend-overlay" />
        <div className="absolute inset-0 noir-scanlines opacity-[0.08] mix-blend-overlay" />
        <div className="absolute inset-0 noir-drift opacity-[0.30]" />
        <div className="absolute inset-0 noir-vignette" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-14">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.38em] text-neutral-500">
              Mileage Mafia
            </div>

            <h1
              className="mt-2 text-3xl sm:text-4xl tracking-tight"
              style={{
                fontFamily: "ui-serif, Georgia, 'Times New Roman', Times, serif",
                fontWeight: 900,
                letterSpacing: "0.01em",
                color: "rgba(250,250,250,0.96)",
              }}
            >
              Upcoming Races
            </h1>

          </div>

          {nextRace ? (
            <div className="rounded-3xl bg-black/55 backdrop-blur-xl ring-1 ring-white/10 px-5 py-4 shadow-[0_18px_70px_rgba(0,0,0,0.60)]">
              <div className="text-[10px] uppercase tracking-[0.35em] text-neutral-600">
                Next Up
              </div>
              <div className="mt-2 font-semibold text-[15px]">{nextRace.name}</div>
              <div className="mt-1 text-xs text-neutral-400">
                {formatDateUTC(nextRace.dateISO)} • {nextRace.city}
                {nextRace.state ? `, ${nextRace.state}` : ""}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={clsx(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.24em]",
                    statusClasses(overallStatus(nextRace))
                  )}
                >
                  {overallStatus(nextRace)}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.24em] bg-white/5 text-neutral-200 ring-1 ring-white/10">
                  {nextRaceCountdown}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Controls */}
        <div className="mt-8 rounded-3xl bg-black/55 backdrop-blur-xl ring-1 ring-white/10 p-4 sm:p-5 shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
            <div className="sm:col-span-5">
              <label className="text-[10px] uppercase tracking-[0.35em] text-neutral-600">
                Search
              </label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="race name, city, distance, type…"
                className="mt-2 w-full rounded-2xl bg-black/35 ring-1 ring-white/10 px-4 py-3 text-sm outline-none focus:ring-white/20"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="text-[10px] uppercase tracking-[0.35em] text-neutral-600">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="mt-2 w-full rounded-2xl bg-black/35 ring-1 ring-white/10 px-4 py-3 text-sm outline-none"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t} className="bg-black">
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="text-[10px] uppercase tracking-[0.35em] text-neutral-600">
                Distance
              </label>
              <select
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                className="mt-2 w-full rounded-2xl bg-black/35 ring-1 ring-white/10 px-4 py-3 text-sm outline-none"
              >
                {allDistanceOptions.map((d) => (
                  <option key={d} value={d} className="bg-black">
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-1">
              <label className="flex items-center gap-2 text-xs text-neutral-300 select-none mb-1 sm:mb-0">
                <input
                  type="checkbox"
                  checked={onlyOpen}
                  onChange={(e) => setOnlyOpen(e.target.checked)}
                  className="accent-white"
                />
                Open
              </label>
            </div>
          </div>

          <div className="mt-3 text-xs text-neutral-600">
            Showing{" "}
            <span className="text-neutral-200 font-semibold">{races.length}</span>{" "}
            races
          </div>
        </div>

        {/* List */}
        <div className="mt-6 grid grid-cols-1 gap-5">
          {races.map((r) => {
            const status = overallStatus(r);
            const countdown = mounted ? daysMap[r.id] : undefined;

            const countdownLabel =
              !mounted || typeof countdown !== "number"
                ? "—"
                : countdown < 0
                ? "past"
                : countdown === 0
                ? "today"
                : countdown === 1
                ? "tomorrow"
                : `${countdown}d`;

            return (
              <div
                key={r.id}
                className={clsx(
                  "group rounded-[28px] overflow-hidden",
                  "bg-black/55 backdrop-blur-xl ring-1 ring-white/10",
                  "shadow-[0_18px_70px_rgba(0,0,0,0.55)]",
                  "transition"
                )}
              >
                <div className="relative p-5 sm:p-6">
                  {/* subtle crimson edge glow on hover */}
                  <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition">
                    <div className="absolute inset-0 rounded-[28px] ring-1 ring-red-500/20" />
                    <div className="absolute inset-0 rounded-[28px] shadow-[0_0_70px_rgba(239,68,68,0.10)]" />
                  </div>

                  {/* Top row */}
                  <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-[10px] uppercase tracking-[0.35em] text-neutral-500">
                          {r.type}
                        </div>

                        <span
                          className={clsx(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.24em]",
                            statusClasses(status)
                          )}
                        >
                          {status}
                        </span>

                        <span
                          className={clsx(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.24em] ring-1",
                            countdownLabel === "past"
                              ? "bg-white/5 text-neutral-500 ring-white/10"
                              : countdownLabel === "today"
                              ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/20"
                              : "bg-white/5 text-neutral-200 ring-white/10"
                          )}
                          title="Days until race"
                        >
                          {countdownLabel}
                        </span>
                      </div>

                      <div
                        className="mt-3 font-semibold text-xl sm:text-2xl truncate"
                        style={{ color: "rgba(250,250,250,0.96)" }}
                      >
                        {r.name}
                      </div>

                      <div className="mt-2 text-sm text-neutral-400">
                        {formatDateUTC(r.dateISO)} • {r.city}
                        {r.state ? `, ${r.state}` : ""}
                      </div>

                      {r.notes ? (
                        <div className="mt-4 text-sm text-neutral-500">
                          {r.notes}
                        </div>
                      ) : null}
                    </div>

                    {/* Register */}
                    <div className="relative shrink-0 flex items-center gap-2">
                      {(() => {
                        const best =
                          r.distances.find((d) => d.status === "Open" && d.url) ??
                          (r.registrationUrl ? { url: r.registrationUrl } : null);

                        if (best?.url) {
                          return (
                            <a
                              href={best.url}
                              target="_blank"
                              rel="noreferrer"
                              className={clsx(
                                "px-4 py-2 rounded-2xl text-xs font-extrabold uppercase tracking-[0.22em] transition",
                                "bg-white text-black hover:opacity-90"
                              )}
                            >
                              Register
                            </a>
                          );
                        }

                        return (
                          <button
                            type="button"
                            className="px-4 py-2 rounded-2xl bg-white/5 ring-1 ring-white/10 text-neutral-300 text-xs font-extrabold uppercase tracking-[0.22em] cursor-default"
                            title="No link added yet"
                          >
                            No Link
                          </button>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Distance pills */}
                  <div className="relative mt-5 flex flex-wrap gap-2">
                    {r.distances.map((d) => {
                      const clickable = !!(d.url || r.registrationUrl);
                      const href = d.url || r.registrationUrl;

                      const pill = (
                        <span
                          className={clsx(
                            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-extrabold uppercase tracking-[0.22em]",
                            "ring-1",
                            statusClasses(d.status),
                            "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                            clickable ? "hover:opacity-90 transition" : "opacity-90"
                          )}
                          title={clickable ? "Open registration link" : "No link for this distance yet"}
                        >
                          <span className="text-neutral-100">{d.label}</span>
                          <span className="opacity-70">•</span>
                          <span>{d.status}</span>
                        </span>
                      );

                      if (!clickable || !href) return <div key={d.label}>{pill}</div>;

                      return (
                        <a key={d.label} href={href} target="_blank" rel="noreferrer" className="inline-flex">
                          {pill}
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {races.length === 0 ? (
            <div className="mt-2 rounded-3xl bg-black/55 ring-1 ring-white/10 p-8 text-center text-neutral-400">
              No races match your filters.
            </div>
          ) : null}
        </div>

        <div className="mt-10 text-[10px] uppercase tracking-[0.35em] text-neutral-700">
          Keep it updated • show up • log it
        </div>
      </div>

      <style>{`
        .noir-layer{ filter: saturate(0.98) contrast(1.06); }

        .noir-static{
          background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E");
          background-size: 420px 420px;
          animation: mmNoiseDrift 7.8s linear infinite;
          transform: translateZ(0);
        }
        @keyframes mmNoiseDrift{
          0%{ transform: translate3d(0,0,0); }
          35%{ transform: translate3d(-12px,8px,0); }
          70%{ transform: translate3d(10px,-7px,0); }
          100%{ transform: translate3d(0,0,0); }
        }

        .noir-scanlines{
          background: repeating-linear-gradient(
            to bottom,
            rgba(255,255,255,0.06),
            rgba(255,255,255,0.06) 1px,
            transparent 1px,
            transparent 6px
          );
          transform: translateZ(0);
        }

        .noir-drift{
          background:
            radial-gradient(900px_circle_at_18%_22%,rgba(255,255,255,0.03),transparent_62%),
            radial-gradient(1000px_circle_at_78%_18%,rgba(239,68,68,0.07),transparent_64%),
            radial-gradient(900px_circle_at_55%_112%,rgba(255,255,255,0.02),transparent_66%);
          animation: mmDrift 10s ease-in-out infinite;
        }
        @keyframes mmDrift{
          0%,100%{ transform: translate3d(0,0,0); }
          50%{ transform: translate3d(10px,-7px,0); }
        }

        .noir-vignette{
          background:
            radial-gradient(1200px_circle_at_50%_35%,transparent_40%,rgba(0,0,0,0.97)_84%),
            radial-gradient(1000px_circle_at_50%_120%,rgba(0,0,0,0.94),transparent_64%);
        }
      `}</style>
    </main>
  );
}
