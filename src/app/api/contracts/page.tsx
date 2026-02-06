"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

type Contract = {
  id: string;
  title: string;
  period: "Weekly" | "Monthly";
  desc?: string;
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

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function normalizeTrailRow(x: any): TrailRow {
  return {
    ts: String(x?.ts ?? x?.timestamp ?? ""),
    runner: String(x?.runner ?? ""),
    action: String(x?.action ?? ""),
    contractId: String(x?.contractId ?? x?.contract_id ?? ""),
    title: String(x?.title ?? ""),
    period: String(x?.period ?? ""),
    meta: x?.meta ? String(x.meta) : "",
  };
}

export default function ContractsPage() {
  // ====== Runner identity (B: first visit choose runner name) ======
  const [runner, setRunner] = useState<string>("");
  const [runnerOpen, setRunnerOpen] = useState(false);

  // Paper trail scope toggle (optional but useful)
  const [trailScope, setTrailScope] = useState<"ME" | "ALL">("ME");

  useEffect(() => {
    const saved = localStorage.getItem("mm_runner_name") || "";
    if (saved) setRunner(saved);
    else setRunnerOpen(true);
  }, []);

  // ====== Contracts data (static for now) ======
  const contracts: Contract[] = useMemo(
    () => [
      {
        id: "wk_consistency",
        title: "Weekly Consistency",
        period: "Weekly",
        desc: "Hit your weekly target. No excuses. Clean entries only.",
      },
      {
        id: "wk_longrun",
        title: "Long Run Clause",
        period: "Weekly",
        desc: "One long run per week. Logged. Counted.",
      },
      {
        id: "mo_volume",
        title: "Monthly Volume Push",
        period: "Monthly",
        desc: "Hold the line for the month. No hero weeks. Just discipline.",
      },
    ],
    []
  );

  // ====== Trail state ======
  const [trail, setTrail] = useState<TrailRow[]>([]);
  const [trailLoading, setTrailLoading] = useState(false);
  const [trailError, setTrailError] = useState("");

  const loadTrail = useCallback(
    async (runnerName?: string | null, scope: "ME" | "ALL" = "ME") => {
      setTrailLoading(true);
      setTrailError("");

      try {
        const q =
          scope === "ALL"
            ? `?limit=80`
            : runnerName
            ? `?runner=${encodeURIComponent(runnerName)}&limit=80`
            : `?limit=80`;

        const res = await fetch(`/api/contracts/trail${q}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (!data?.ok) {
          setTrailError(data?.error || "Failed to load trail");
          setTrail([]);
          return;
        }

        const rows = Array.isArray(data.trail) ? data.trail.map(normalizeTrailRow) : [];

        // newest-first (by ts)
        rows.sort((a: TrailRow, b: TrailRow): number => {
          const ta: number = new Date(a.ts).getTime();
          const tb: number = new Date(b.ts).getTime();
          if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
          return tb - ta;
        });

        setTrail(rows);
      } catch {
        setTrailError("Failed to load trail");
        setTrail([]);
      } finally {
        setTrailLoading(false);
      }
    },
    []
  );

  // Load trail when runner is known
  useEffect(() => {
    if (!runner) return;
    loadTrail(runner, trailScope);
  }, [runner, trailScope, loadTrail]);

  // ====== Accept contract -> writes to log -> reload trail ======
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string>("");

  const acceptContract = useCallback(
    async (c: Contract) => {
      if (!runner) {
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
            runner,
            action: "ACCEPTED",
            contractId: c.id,
            title: c.title,
            period: c.period,
            meta: { source: "contracts_page" },
          }),
        });

        const data = await res.json().catch(() => null);
        if (!data?.ok) {
          setToast(data?.error || "Could not log acceptance");
          return;
        }

        // on-brand toast
        setToast(`INKED — ${runner} accepted "${c.title}"`);

        // reload paper trail
        await loadTrail(runner, trailScope);
      } catch {
        setToast("Could not log acceptance");
      } finally {
        setBusyId(null);
        window.setTimeout(() => setToast(""), 2600);
      }
    },
    [runner, loadTrail, trailScope]
  );

  // Save runner + refresh immediately
  const saveRunner = useCallback(
    async (name: string) => {
      const n = name.trim();
      if (!n) return;

      localStorage.setItem("mm_runner_name", n);
      setRunner(n);
      setRunnerOpen(false);

      // deterministic: load trail immediately after save
      await loadTrail(n, trailScope);
    },
    [loadTrail, trailScope]
  );

  // ====== UI ======
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* Subtle noir background */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_circle_at_20%_-10%,rgba(255,255,255,0.06),transparent_60%),radial-gradient(900px_circle_at_90%_0%,rgba(239,68,68,0.08),transparent_55%),radial-gradient(900px_circle_at_60%_110%,rgba(255,255,255,0.05),transparent_55%)]" />

      <div className="relative max-w-5xl mx-auto px-6 py-14 space-y-10">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="text-neutral-400 text-xs uppercase tracking-[0.35em]">
              Mileage Mafia
            </div>
            <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">
              Contracts
            </h1>
            <p className="mt-2 text-neutral-400 text-sm">
              Pick a clause. Sign it. It becomes paper.
            </p>
          </div>

          <div className="flex items-center gap-3">
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

        {/* Toast (on-brand) */}
        {toast ? (
          <div className="rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 px-5 py-3 text-sm">
            <span className="text-red-200 font-semibold">{toast}</span>
          </div>
        ) : null}

        {/* Contracts list */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {contracts.map((c) => (
            <div
              key={c.id}
              className="rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 p-6 shadow-[0_18px_70px_rgba(0,0,0,0.55)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">
                    {c.period}
                  </div>
                  <div className="mt-2 text-xl font-bold">{c.title}</div>
                  {c.desc ? (
                    <div className="mt-2 text-sm text-neutral-400 leading-relaxed">
                      {c.desc}
                    </div>
                  ) : null}
                </div>

                <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-red-500/10 text-red-200 ring-1 ring-red-500/20">
                  Clause
                </span>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => acceptContract(c)}
                  disabled={busyId === c.id}
                  className={clsx(
                    "px-5 py-3 rounded-2xl font-black uppercase tracking-[0.14em] transition",
                    "ring-1 ring-red-500/25 shadow-[0_12px_46px_rgba(0,0,0,0.55)]",
                    busyId === c.id
                      ? "bg-white text-black opacity-40 cursor-not-allowed"
                      : "bg-red-500 text-black hover:brightness-110"
                  )}
                >
                  {busyId === c.id ? "Stamping…" : "Accept"}
                </button>

                <div className="text-xs text-neutral-500">Writes to Paper Trail</div>
              </div>
            </div>
          ))}
        </section>

        {/* Paper Trail (wrapper + feed) */}
        <section className="rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 overflow-hidden">
          <div className="px-6 py-5 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">
                Paper Trail
              </div>
              <div className="mt-1 text-xl font-bold">Recent filings</div>
              <div className="mt-1 text-sm text-neutral-500">
                {trailScope === "ME" ? "Showing your filings only." : "Showing all filings."}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTrailScope((s) => (s === "ME" ? "ALL" : "ME"))}
                className="px-4 py-2 rounded-full bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition text-sm"
              >
                {trailScope === "ME" ? "Show All" : "Show Mine"}
              </button>

              <button
                type="button"
                onClick={() => loadTrail(runner || null, trailScope)}
                className="px-4 py-2 rounded-full bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition text-sm"
                disabled={trailLoading}
              >
                {trailLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          {trailError ? (
            <div className="px-6 py-5 text-sm text-red-200">{trailError}</div>
          ) : null}

          <div className="divide-y divide-neutral-800">
            {trailLoading ? (
              <div className="px-6 py-6 text-sm text-neutral-400">Loading…</div>
            ) : trail.length === 0 ? (
              <div className="px-6 py-6 text-sm text-neutral-500">
                No filings yet.
              </div>
            ) : (
              trail.map((t, idx) => (
                <div
                  key={`${t.ts}-${t.runner}-${t.contractId}-${idx}`}
                  className="px-6 py-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-white/5 ring-1 ring-white/10 text-neutral-200">
                          {t.action || "EVENT"}
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-neutral-950/40 ring-1 ring-neutral-800 text-neutral-300">
                          {t.period || "—"}
                        </span>
                        <span className="text-neutral-500 text-xs">{fmtTs(t.ts)}</span>
                      </div>

                      <div className="mt-2 text-lg font-semibold truncate">
                        {t.title || t.contractId}
                      </div>

                      <div className="mt-1 text-sm text-neutral-400">
                        Filed by{" "}
                        <span className="text-neutral-200 font-semibold">
                          {t.runner || "—"}
                        </span>
                      </div>
                    </div>

                    <div className="text-neutral-500 text-xs sm:text-right">
                      ID: <span className="text-neutral-300">{t.contractId}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Runner chooser modal */}
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
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative w-[min(520px,92vw)] rounded-3xl bg-black/70 ring-1 ring-white/10 shadow-[0_18px_70px_rgba(0,0,0,0.75)] p-7">
        <div className="text-xs uppercase tracking-[0.35em] text-neutral-500">
          Identity Check
        </div>
        <div className="mt-2 text-2xl font-black tracking-tight">
          Who’s signing?
        </div>
        <div className="mt-2 text-sm text-neutral-400">
          This name will be used for Contracts + Paper Trail.
        </div>

        <div className="mt-6">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Type your name"
            className="w-full rounded-2xl bg-neutral-950/40 ring-1 ring-neutral-800 px-4 py-4 outline-none focus:ring-red-500/25"
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-2xl bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(name)}
            className="px-5 py-3 rounded-2xl bg-red-500 text-black hover:brightness-110 transition font-black"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
