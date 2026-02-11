"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

type Period = "Weekly" | "Monthly";

type Contract = {
  id: string;
  title: string;
  period: Period;
  tagline: string;
  rules: string[];
  penaltyInr: number; // 0 if none
  reward: string; // human readable
  notes?: string;
};

type TrailRow = {
  ts: string;
  runner: string;
  action: string;
  contractId: string;
  title: string;
  period: string;
  meta?: string;
};

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function sanitizeName(v: unknown) {
  return String(v ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

function fmtINR(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function fmtTs(ts: string) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeTrailRow(x: any): TrailRow {
  return {
    ts: String(x?.ts ?? x?.timestamp ?? ""),
    runner: sanitizeName(x?.runner ?? ""),
    action: String(x?.action ?? ""),
    contractId: String(x?.contractId ?? x?.contract_id ?? ""),
    title: String(x?.title ?? ""),
    period: String(x?.period ?? ""),
    meta: x?.meta ? String(x.meta) : "",
  };
}

export default function ContractsPage() {
  // ===== Runner identity =====
  const [runner, setRunner] = useState<string>("");
  const [runnerOpen, setRunnerOpen] = useState(false);

  // Filters
  const [section, setSection] = useState<Period>("Weekly");
  const [trailScope, setTrailScope] = useState<"ME" | "ALL">("ME");

  useEffect(() => {
    const saved = sanitizeName(localStorage.getItem("mm_runner_name") || "");
    if (saved) setRunner(saved);
    else setRunnerOpen(true);
  }, []);

  const saveRunner = useCallback(async (name: string) => {
    const n = sanitizeName(name);
    if (!n) return;
    localStorage.setItem("mm_runner_name", n);
    setRunner(n);
    setRunnerOpen(false);
  }, []);

  // ===== Contracts =====
  const contracts = useMemo<Contract[]>(
    () => [
      // WEEKLY (culture foundation)
      {
        id: "wk_min_standard",
        title: "Minimum Standard",
        period: "Weekly",
        tagline: "3 runs minimum. Keep the chain alive.",
        rules: [
          "Complete at least 3 runs this week.",
          "Total weekly KM must be ≥ your personal baseline × 0.8.",
          "All runs must be logged on Strava.",
        ],
        penaltyInr: 500,
        reward: "No weekly reward. This is discipline.",
        notes:
          "This is designed to protect beginners while still enforcing consistency.",
      },
      {
        id: "wk_sunday_ritual",
        title: "Sunday Ritual (Long Run)",
        period: "Weekly",
        tagline: "The culture anchor. One long run, every week.",
        rules: [
          "Complete 1 long run this week (logged on Strava).",
          "Beginner: 6–8 km • Intermediate: 10–14 km • Advanced: 16+ km.",
          "Post the run in the group (Strava link is enough).",
        ],
        penaltyInr: 500,
        reward: "No weekly reward. You earn the right to be ‘Clean Ledger’.",
        notes:
          "We’re building a Sunday identity: the house runs long on Sundays.",
      },

      // MONTHLY (structure + growth)
      {
        id: "mo_clean_ledger",
        title: "Clean Ledger (Four Clean Weeks)",
        period: "Monthly",
        tagline: "Complete weekly contracts. Stay breach-free.",
        rules: [
          "Complete all Weekly contracts for every week in the month.",
          "Zero breaches = Clean Ledger status.",
          "Clean Ledger is required to be eligible for monthly pot splits.",
        ],
        penaltyInr: 0,
        reward:
          "Eligible for monthly pot split + badge + recognition on leaderboard.",
        notes:
          "This is the core incentive loop. The month rewards consistency, not talent.",
      },
      {
        id: "mo_progress_clause",
        title: "Progress Clause (One Measurable Win)",
        period: "Monthly",
        tagline: "Beginners and advanced runners both level up.",
        rules: [
          "Improve ONE metric vs last month (pick one):",
          "• Monthly KM • Long run distance • 5K time • Weekly frequency",
          "Must be supported by Strava proof (runs, stats, or a timed effort).",
        ],
        penaltyInr: 0,
        reward: "Eligible for ‘Biggest Improver’ monthly reward bucket.",
        notes:
          "We reward progress, not absolute speed. This keeps the culture inclusive.",
      },
    ],
    []
  );

  const weekly = useMemo(() => contracts.filter((c) => c.period === "Weekly"), [contracts]);
  const monthly = useMemo(() => contracts.filter((c) => c.period === "Monthly"), [contracts]);

  const visibleContracts = section === "Weekly" ? weekly : monthly;

  // ===== Trail state =====
  const [trail, setTrail] = useState<TrailRow[]>([]);
  const [trailLoading, setTrailLoading] = useState(false);
  const [trailError, setTrailError] = useState("");

  const loadTrail = useCallback(async (runnerName: string, scope: "ME" | "ALL") => {
    setTrailLoading(true);
    setTrailError("");

    try {
      const cleanRunner = sanitizeName(runnerName);

      const q =
        scope === "ALL"
          ? `?limit=80`
          : cleanRunner
          ? `?runner=${encodeURIComponent(cleanRunner)}&limit=80`
          : `?limit=80`;

      const res = await fetch(`/api/contracts/trail${q}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const data = await res.json().catch(() => null);

      if (!data?.ok) {
        setTrailError(data?.error || "Failed to load paper trail");
        setTrail([]);
        return;
      }

      const rows = Array.isArray(data.trail) ? data.trail.map(normalizeTrailRow) : [];

      rows.sort((a: TrailRow, b: TrailRow) => {
        const ta = new Date(a.ts).getTime();
        const tb = new Date(b.ts).getTime();
        if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
        return tb - ta;
      });

      setTrail(rows);
    } catch {
      setTrailError("Failed to load paper trail");
      setTrail([]);
    } finally {
      setTrailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!runner) return;
    loadTrail(runner, trailScope);
  }, [runner, trailScope, loadTrail]);

  // ===== Accept contract =====
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string>("");

  const acceptContract = useCallback(
    async (c: Contract) => {
      const cleanRunner = sanitizeName(runner);
      if (!cleanRunner) {
        setRunnerOpen(true);
        return;
      }

      setBusyId(c.id);
      setToast("");

      try {
        const res = await fetch("/api/contracts/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            runner: cleanRunner,
            action: "ACCEPTED",
            contractId: c.id,
            title: c.title,
            period: c.period,
            meta: {
              penaltyInr: c.penaltyInr,
              reward: c.reward,
              source: "contracts_page_v2",
            },
          }),
        });

        const data = await res.json().catch(() => null);
        if (!data?.ok) {
          setToast(data?.error || "Could not log acceptance");
          return;
        }

        setToast(`INKED — ${cleanRunner} accepted “${c.title}”`);
        await loadTrail(cleanRunner, trailScope);
      } catch {
        setToast("Could not log acceptance");
      } finally {
        setBusyId(null);
        window.setTimeout(() => setToast(""), 2600);
      }
    },
    [runner, loadTrail, trailScope]
  );

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_circle_at_15%_-10%,rgba(255,255,255,0.06),transparent_60%),radial-gradient(900px_circle_at_90%_0%,rgba(239,68,68,0.08),transparent_55%),radial-gradient(900px_circle_at_60%_110%,rgba(255,255,255,0.05),transparent_55%)]" />

      <div className="relative max-w-6xl mx-auto px-6 py-14 space-y-10">
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div className="min-w-0">
            <div className="text-neutral-400 text-xs uppercase tracking-[0.35em]">Mileage Mafia</div>
            <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">Bounties</h1>
            <p className="mt-2 text-neutral-400 text-sm max-w-2xl leading-relaxed">
              Choose a contract. Accept it. The ledger records your word. Weekly builds discipline. Monthly builds culture.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="px-4 py-2 rounded-full bg-white/5 ring-1 ring-white/10 text-sm">
              <span className="text-neutral-400">Runner:</span>{" "}
              <span className="font-semibold">{runner || "—"}</span>
            </div>

            <button
              type="button"
              onClick={() => setRunnerOpen(true)}
              className="px-4 py-2 rounded-full bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition text-sm"
            >
              Change
            </button>
          </div>
        </header>

        {/* Rules summary strip */}
        <section className="rounded-3xl bg-neutral-900/60 ring-1 ring-neutral-800 overflow-hidden">
          <div className="p-6 sm:p-7">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <InfoPill
                title="Enforcement"
                body="No rule bending. Breaches add to the pot. Culture beats feelings."
              />
              <InfoPill
                title="Weekly penalties"
                body={`Weekly breaches cost ${fmtINR(500)} each (Minimum Standard + Sunday Ritual).`}
              />
              <InfoPill
                title="Monthly rewards"
                body="Clean Ledger unlocks pot eligibility. Progress Clause rewards improvement, not speed."
              />
            </div>
          </div>
        </section>

        {/* Toast */}
        {toast ? (
          <div className="rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 px-5 py-3 text-sm">
            <span className="text-red-200 font-semibold">{toast}</span>
          </div>
        ) : null}

        {/* Weekly / Monthly tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <TabButton active={section === "Weekly"} onClick={() => setSection("Weekly")}>
              Weekly
            </TabButton>
            <TabButton active={section === "Monthly"} onClick={() => setSection("Monthly")}>
              Monthly
            </TabButton>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTrailScope((s) => (s === "ME" ? "ALL" : "ME"))}
              className="px-4 py-2 rounded-full bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition text-sm"
            >
              {trailScope === "ME" ? "Trail: Mine" : "Trail: All"}
            </button>

            <button
              type="button"
              onClick={() => runner && loadTrail(runner, trailScope)}
              className="px-4 py-2 rounded-full bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition text-sm"
              disabled={trailLoading}
            >
              {trailLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Contracts grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {visibleContracts.map((c) => (
            <div
              key={c.id}
              className="rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 p-6 sm:p-7 shadow-[0_18px_70px_rgba(0,0,0,0.55)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">{c.period}</div>
                  <div className="mt-2 text-xl font-black tracking-tight">{c.title}</div>
                  <div className="mt-2 text-sm text-neutral-400">{c.tagline}</div>
                </div>

                <span
                  className={clsx(
                    "shrink-0 px-3 py-1 rounded-full text-[11px] font-extrabold ring-1",
                    c.period === "Weekly"
                      ? "bg-red-500/10 text-red-200 ring-red-500/20"
                      : "bg-emerald-500/10 text-emerald-200 ring-emerald-500/20"
                  )}
                >
                  {c.period === "Weekly" ? "Breach costs" : "Unlocks"}
                </span>
              </div>

              {/* Rules */}
              <div className="mt-5 rounded-2xl bg-neutral-950/40 ring-1 ring-neutral-800 p-5">
                <div className="text-[11px] uppercase tracking-[0.32em] text-neutral-500">Rules</div>
                <ul className="mt-3 space-y-2 text-sm text-neutral-200 leading-relaxed">
                  {c.rules.map((r, i) => (
                    <li key={`${c.id}-r-${i}`} className="flex gap-2">
                      <span className="text-neutral-500">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-neutral-500">Penalty</div>
                    <div className="mt-2 font-black text-lg">
                      {c.penaltyInr > 0 ? fmtINR(c.penaltyInr) : "—"}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {c.penaltyInr > 0 ? "Added to the pot." : "No direct penalty."}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-neutral-500">Reward</div>
                    <div className="mt-2 text-sm font-semibold text-neutral-200 leading-snug">
                      {c.reward}
                    </div>
                  </div>
                </div>

                {c.notes ? (
                  <div className="mt-4 text-xs text-neutral-500 leading-relaxed">
                    <span className="text-neutral-400 font-semibold">Note:</span> {c.notes}
                  </div>
                ) : null}
              </div>

              {/* CTA */}
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => acceptContract(c)}
                  disabled={busyId === c.id}
                  className={clsx(
                    "px-5 py-3 rounded-2xl font-black uppercase tracking-[0.14em] transition",
                    "shadow-[0_12px_46px_rgba(0,0,0,0.55)] ring-1",
                    busyId === c.id
                      ? "bg-white text-black opacity-40 cursor-not-allowed ring-white/10"
                      : c.period === "Weekly"
                      ? "bg-red-500 text-black hover:brightness-110 ring-red-500/25"
                      : "bg-emerald-400 text-black hover:brightness-110 ring-emerald-500/25"
                  )}
                >
                  {busyId === c.id ? "Stamping…" : "Accept Contract"}
                </button>

                <div className="text-xs text-neutral-500">
                  Writes to Paper Trail{trailScope === "ALL" ? " (public)" : ""}.
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Paper Trail */}
        <section className="rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 overflow-hidden">
          <div className="px-6 py-5 border-b border-neutral-800 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Paper Trail</div>
              <div className="mt-1 text-xl font-black tracking-tight">Recent filings</div>
            </div>

            <div className="text-xs text-neutral-500">
              Scope: <span className="text-neutral-300 font-semibold">{trailScope === "ME" ? "Mine" : "All"}</span>
            </div>
          </div>

          {trailError ? (
            <div className="px-6 py-5 text-sm text-red-200">{trailError}</div>
          ) : null}

          <div className="p-6 space-y-3">
            {trailLoading ? (
              <div className="text-sm text-neutral-400">Loading…</div>
            ) : trail.length === 0 ? (
              <div className="text-sm text-neutral-500">No filings yet.</div>
            ) : (
              trail.map((t) => (
                <div
                  key={`${t.ts}-${t.contractId}-${t.runner}`}
                  className="rounded-2xl ring-1 ring-neutral-800 bg-neutral-950/40 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm">
                        <span className="font-semibold text-white">{t.runner}</span>{" "}
                        <span className="text-neutral-400">accepted</span>{" "}
                        <span className="font-semibold text-neutral-200">{t.title}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-white/5 ring-1 ring-white/10 text-neutral-200">
                          {String(t.period || "—").toUpperCase()}
                        </span>
                        <span className="text-xs text-neutral-500">{fmtTs(t.ts)}</span>
                      </div>
                    </div>

                    <div className="shrink-0 text-[10px] uppercase tracking-[0.34em] text-neutral-600">
                      ACCEPTED
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {runnerOpen ? (
        <RunnerModal
          initial={runner}
          onClose={() => setRunnerOpen(false)}
          onSave={saveRunner}
        />
      ) : null}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "px-4 py-2 rounded-full text-sm font-semibold transition ring-1",
        active
          ? "bg-white text-black ring-white/20"
          : "bg-white/5 text-neutral-200 ring-white/10 hover:bg-white/10"
      )}
      style={{ letterSpacing: "0.01em", touchAction: "manipulation" }}
    >
      {children}
    </button>
  );
}

function InfoPill({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-neutral-950/40 ring-1 ring-neutral-800 p-5">
      <div className="text-[10px] uppercase tracking-[0.35em] text-neutral-500">{title}</div>
      <div className="mt-2 text-sm text-neutral-300 leading-relaxed">{body}</div>
    </div>
  );
}

function RunnerModal({
  initial,
  onClose,
  onSave,
}: {
  initial: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initial || "");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative w-[min(560px,92vw)] rounded-3xl bg-black/70 ring-1 ring-white/10 shadow-[0_18px_70px_rgba(0,0,0,0.75)] p-7">
        <div className="text-xs uppercase tracking-[0.35em] text-neutral-500">Identity Check</div>
        <div className="mt-2 text-2xl font-black tracking-tight">Who’s signing?</div>
        <div className="mt-2 text-sm text-neutral-400">
          This name will be used for Bounties + Paper Trail.
        </div>

        <div className="mt-6">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Type your name"
            className="w-full rounded-2xl bg-neutral-950/40 ring-1 ring-neutral-800 px-4 py-4 outline-none focus:ring-red-500/25"
          />
          <div className="mt-2 text-xs text-neutral-500">
            Tip: use the same spelling every time.
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-2xl bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition font-semibold"
            style={{ touchAction: "manipulation" }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onSave(name)}
            className="px-5 py-3 rounded-2xl bg-red-500 text-black hover:brightness-110 transition font-black"
            style={{ touchAction: "manipulation" }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
