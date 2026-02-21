import Link from "next/link";
import { getSheet } from "@/lib/sheets";

export const dynamic = "force-dynamic";

type RunnerRow = {
  name: string;
  yearlyKm: number;
  completion: number; // percent
  rank: number;
  weeklyTarget: number;
  annualTarget: number;
};

function toNum(v: any) {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function toPercent(v: any) {
  const s = String(v ?? "").trim();
  const n = parseFloat(s.replace("%", "").trim());
  return Number.isFinite(n) ? n : 0;
}
function slugifyName(name: string) {
  return encodeURIComponent(name.trim());
}
function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtKm(n: number) {
  return Math.round(n).toLocaleString("en-IN");
}
function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Estimate weekly pace with a “good enough” heuristic:
 * infer weeks elapsed from completion% (or yearly/target), then pace = yearly / weeksElapsed
 */
function estimateWeeklyPaceKm(yearlyKm: number, completionPct: number, annualTarget: number) {
  const fracByTarget = annualTarget > 0 ? yearlyKm / annualTarget : 0;
  const fracByPct = completionPct > 0 ? completionPct / 100 : 0;

  const frac = fracByPct > 0.01 ? fracByPct : fracByTarget;
  const weeksElapsed = clamp(frac * 52, 1, 52);
  return yearlyKm / weeksElapsed;
}

function projectYearEndKm(yearlyKm: number, weeklyPace: number) {
  // naive projection to 52 weeks
  return clamp(yearlyKm + weeklyPace * (52 - 1), 0, 1e9);
}

function bestIndex(values: number[], higherIsBetter = true) {
  if (!values.length) return -1;
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (higherIsBetter) {
      if (values[i] > values[best]) best = i;
    } else {
      if (values[i] < values[best]) best = i;
    }
  }
  return best;
}

function leadMargin(values: number[], bestIdx: number, higherIsBetter: boolean) {
  if (bestIdx < 0 || values.length < 2) return 0;
  const best = values[bestIdx];
  const sorted = [...values].sort((a, b) => (higherIsBetter ? b - a : a - b));
  const runnerUp = sorted[1];
  return higherIsBetter ? best - runnerUp : runnerUp - best;
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const r = sp.r;
  const selected = Array.isArray(r) ? r : typeof r === "string" ? [r] : [];
  const unique = Array.from(new Set(selected)).slice(0, 4);

  const raw = await getSheet("API_Leaderboard!A2:F200");
  const rows: RunnerRow[] = (raw ?? [])
    .map((x) => ({
      name: String(x?.[0] ?? "").trim(),
      yearlyKm: toNum(x?.[1]),
      completion: toPercent(x?.[2]),
      rank: toNum(x?.[3]),
      weeklyTarget: toNum(x?.[4]),
      annualTarget: toNum(x?.[5]),
    }))
    .filter((x) => x.name.length > 0);

  const picked = unique
    .map((name) => rows.find((rr) => rr.name === name))
    .filter(Boolean) as RunnerRow[];

  const enriched = picked.map((p) => {
    const weeklyPace = estimateWeeklyPaceKm(p.yearlyKm, p.completion, p.annualTarget);
    const weeklyVsTarget = p.weeklyTarget > 0 ? (weeklyPace / p.weeklyTarget) * 100 : 0;
    const completionPct = clamp(p.completion, 0, 100);
    const yearEnd = projectYearEndKm(p.yearlyKm, weeklyPace);
    const gapToTarget = p.annualTarget - p.yearlyKm;

    return {
      ...p,
      weeklyPace,
      weeklyVsTarget,
      completionPct,
      yearEnd,
      gapToTarget,
    };
  });

  const kmVals = enriched.map((x) => x.yearlyKm);
  const compVals = enriched.map((x) => x.completionPct);
  const paceVals = enriched.map((x) => x.weeklyPace);
  const gapVals = enriched.map((x) => x.gapToTarget);

  const bestKm = bestIndex(kmVals, true);
  const bestComp = bestIndex(compVals, true);
  const bestPace = bestIndex(paceVals, true);
  const bestGap = bestIndex(gapVals, false);

  const kmLead = leadMargin(kmVals, bestKm, true);
  const compLead = leadMargin(compVals, bestComp, true);
  const paceLead = leadMargin(paceVals, bestPace, true);

  const leaderByKm = bestKm >= 0 ? enriched[bestKm]?.name : null;
  const leaderByComp = bestComp >= 0 ? enriched[bestComp]?.name : null;
  const leaderByPace = bestPace >= 0 ? enriched[bestPace]?.name : null;

  return (
    <main className="min-h-screen text-white bg-neutral-950">
      {/* noir background */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_circle_at_20%_-10%,rgba(255,255,255,0.08),transparent_60%),radial-gradient(900px_circle_at_85%_0%,rgba(16,185,129,0.14),transparent_55%),radial-gradient(900px_circle_at_60%_110%,rgba(244,63,94,0.10),transparent_55%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.08] bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,0.06),rgba(255,255,255,0.06)_1px,transparent_1px,transparent_7px)]" />
      <div className="pointer-events-none fixed inset-0 noir-vignette" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-neutral-400 text-xs uppercase tracking-wider">
              Mileage Mafia
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">
              Compare Runners
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              Up to 4. Shareable link.
            </p>
          </div>

          <Link
            href="/leaderboard"
            className="px-4 py-2 rounded-2xl bg-white text-black text-xs font-extrabold uppercase tracking-[0.18em] hover:opacity-90 transition"
          >
            Back →
          </Link>
        </div>

        {unique.length < 2 ? (
          <div className="mt-8 rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 p-8 text-neutral-400">
            Pick at least <span className="text-neutral-200 font-semibold">2</span>{" "}
            runners from the leaderboard to compare.
          </div>
        ) : (
          <>
            {/* Winner strips (global) */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3">
              <WinnerStrip
                label="Most KM"
                leader={leaderByKm ?? "—"}
                margin={kmLead}
                marginLabel="km"
              />
              <WinnerStrip
                label="Highest completion"
                leader={leaderByComp ?? "—"}
                margin={compLead}
                marginLabel="pts"
                decimals={1}
              />
              <WinnerStrip
                label="Fastest weekly pace"
                leader={leaderByPace ?? "—"}
                margin={paceLead}
                marginLabel="km/wk"
                decimals={1}
              />
            </div>

            {/* Cards */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {enriched.map((p, idx) => (
                <RunnerCard
                  key={p.name}
                  p={p}
                  idx={idx}
                  best={{
                    km: bestKm === idx,
                    comp: bestComp === idx,
                    pace: bestPace === idx,
                    gap: bestGap === idx,
                  }}
                  all={enriched}
                />
              ))}
            </div>

            {/* Breakdown table */}
            <div className="mt-8 rounded-3xl bg-neutral-900/65 ring-1 ring-neutral-800 overflow-hidden">
              <div className="px-5 sm:px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
                <div>
                  <p className="text-neutral-400 text-xs uppercase tracking-wider">
                    Breakdown
                  </p>
                  <h2 className="mt-1 text-lg font-bold">Side-by-side</h2>
                </div>
                <div className="text-xs text-neutral-600">Best values highlighted</div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full">
                  <thead className="bg-neutral-950/60">
                    <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-500">
                      <th className="px-5 sm:px-6 py-3">Metric</th>
                      {enriched.map((p) => (
                        <th key={p.name} className="px-5 sm:px-6 py-3">
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    <TR label="Yearly KM" values={enriched.map((p) => fmtKm(p.yearlyKm))} bestIdx={bestKm} />
                    <TR label="Completion" values={enriched.map((p) => fmtPct(p.completionPct))} bestIdx={bestComp} />
                    <TR label="Weekly pace (est.)" values={enriched.map((p) => `${p.weeklyPace.toFixed(1)} km/wk`)} bestIdx={bestPace} />
                    <TR label="Weekly target" values={enriched.map((p) => `${Math.round(p.weeklyTarget)} km/wk`)} bestIdx={bestIndex(enriched.map((p) => p.weeklyTarget), true)} />
                    <TR label="Gap to annual target" values={enriched.map((p) => `${fmtKm(p.gapToTarget)} km`)} bestIdx={bestGap} lowerIsBetter />
                    <TR label="Projected year-end (est.)" values={enriched.map((p) => `${fmtKm(p.yearEnd)} km`)} bestIdx={bestIndex(enriched.map((p) => p.yearEnd), true)} />
                    <TR
                      label="Rank"
                      values={enriched.map((p) => (p.rank ? `#${p.rank}` : "—"))}
                      bestIdx={bestIndex(enriched.map((p) => (p.rank ? p.rank : 1e9)), false)}
                      lowerIsBetter
                    />
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mt-6 text-xs text-neutral-600">
              “pts” = percentage points (ex: 10.0% → 12.0% = +2.0 pts).
            </p>
          </>
        )}
      </div>

      <style>{`
        .noir-vignette{
          background:
            radial-gradient(1200px_circle_at_50%_30%,transparent_42%,rgba(0,0,0,0.96)_86%),
            radial-gradient(1000px_circle_at_50%_120%,rgba(0,0,0,0.92),transparent_68%);
          mix-blend-mode: normal;
        }
      `}</style>
    </main>
  );
}

function WinnerStrip({
  label,
  leader,
  margin,
  marginLabel,
  decimals = 0,
}: {
  label: string;
  leader: string;
  margin: number;
  marginLabel: string;
  decimals?: number;
}) {
  const m = margin <= 0 ? 0 : margin;
  const show = leader !== "—" && m > 0;

  return (
    <div className="rounded-3xl bg-neutral-900/65 ring-1 ring-neutral-800 px-5 py-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-[0.35] bg-[radial-gradient(800px_circle_at_20%_0%,rgba(16,185,129,0.12),transparent_55%)]" />
      <div className="relative">
        <div className="text-neutral-500 text-[10px] uppercase tracking-wider">{label}</div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="font-black text-neutral-200 truncate">{leader}</div>
          {show ? (
            <span className="chip chip--green" title="Lead vs runner-up">
              Leads by {m.toFixed(decimals)} {marginLabel}
            </span>
          ) : (
            <span className="chip chip--muted">—</span>
          )}
        </div>
      </div>

      <style>{`
        .chip{
          height: 24px;
          display: inline-flex;
          align-items: center;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.04);
          color: rgba(229,229,229,0.92);
          white-space: nowrap;
        }
        .chip--green{
          border-color: rgba(16,185,129,0.22);
          background: rgba(16,185,129,0.08);
          color: rgba(167,243,208,0.92);
          box-shadow: 0 0 22px rgba(16,185,129,0.18);
        }
        .chip--muted{
          opacity: 0.55;
        }
      `}</style>
    </div>
  );
}

function TR({
  label,
  values,
  bestIdx,
  lowerIsBetter,
}: {
  label: string;
  values: string[];
  bestIdx: number;
  lowerIsBetter?: boolean;
}) {
  return (
    <tr>
      <td className="px-5 sm:px-6 py-4 text-sm text-neutral-400">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-5 sm:px-6 py-4">
          <span
            className={clsx(
              "inline-flex px-3 py-1 rounded-full text-sm font-semibold tabular-nums ring-1",
              i === bestIdx
                ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/25"
                : "bg-white/5 text-neutral-200 ring-white/10"
            )}
            title={i === bestIdx ? (lowerIsBetter ? "Lowest (best)" : "Highest (best)") : ""}
          >
            {v}
          </span>
        </td>
      ))}
    </tr>
  );
}

function RunnerCard({
  p,
  idx,
  best,
  all,
}: {
  p: any;
  idx: number;
  best: { km: boolean; comp: boolean; pace: boolean; gap: boolean };
  all: any[];
}) {
  // deltas vs first runner (index 0)
  const base = all[0];
  const dk = p.yearlyKm - base.yearlyKm;
  const dcPts = p.completionPct - base.completionPct; // percentage points
  const dp = p.weeklyPace - base.weeklyPace;

  return (
    <div className={clsx("card", best.comp || best.km || best.pace || best.gap ? "card--hot" : "")}>
      <div className="card__inner">
        {/* top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-neutral-200 font-black text-xl truncate">{p.name}</div>
            <div className="mt-1 text-xs text-neutral-600">
              Rank: <span className="text-neutral-300 font-semibold">{p.rank ? `#${p.rank}` : "—"}</span>
            </div>
          </div>

          <Link href={`/runners/${slugifyName(p.name)}`} className="open-btn">
            Open →
          </Link>
        </div>

        {/* local winner strip */}
        <div className="mt-4">
          <span className={clsx("strip", best.comp ? "strip--green" : "strip--muted")}>
            {best.comp ? "Top completion in this comparison" : "Keep moving. Keep logging."}
          </span>
        </div>

        {/* completion block */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <div className="text-neutral-500 text-[10px] uppercase tracking-wider">Completion</div>

            {idx === 0 ? null : (
              <DeltaChip delta={dcPts} unit="pts" title="Delta vs first runner (percentage points)" />
            )}
          </div>

          <div className="mt-1 flex items-baseline justify-between gap-3">
            <div className={clsx("text-3xl font-black tabular-nums", best.comp ? "text-emerald-100" : "text-neutral-200")}>
              {fmtPct(p.completionPct)}
            </div>
            {best.comp ? <span className="best-pill">Best</span> : null}
          </div>

          <div className="mt-1 text-xs text-neutral-600 tabular-nums">
            {Math.round(p.yearlyKm)} / {Math.round(p.annualTarget)} km
          </div>

          <div className="mt-3 h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-600" style={{ width: `${clamp(p.completionPct, 0, 100)}%` }} />
          </div>
        </div>

        {/* tiles */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <StatTile label="Yearly km" value={fmtKm(p.yearlyKm)} suffix="km" best={best.km} delta={idx === 0 ? null : dk} deltaUnit="km" />
          <StatTile label="Weekly pace (est.)" value={p.weeklyPace.toFixed(1)} suffix="km/wk" best={best.pace} delta={idx === 0 ? null : dp} deltaUnit="km/wk" decimals={1} />
          <StatTile label="Annual target" value={fmtKm(p.annualTarget)} suffix="km" />
          <StatTile label="Weekly target" value={Math.round(p.weeklyTarget).toLocaleString("en-IN")} suffix="km/wk" />
        </div>

        {/* weekly vs target */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-500 uppercase tracking-wider">Weekly vs target</span>
            <span className={clsx("font-semibold tabular-nums", p.weeklyTarget > 0 && p.weeklyPace >= p.weeklyTarget ? "text-emerald-200" : "text-amber-200")}>
              {p.weeklyTarget > 0 ? `${p.weeklyVsTarget.toFixed(0)}%` : "—"}
            </span>
          </div>

          <div className="mt-2 h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={clsx("h-full", p.weeklyTarget > 0 && p.weeklyPace >= p.weeklyTarget ? "bg-emerald-600" : "bg-amber-500")}
              style={{ width: `${clamp(p.weeklyVsTarget, 0, 140)}%` }}
            />
          </div>

          <div className="mt-3 text-xs text-neutral-600">
            Gap to target:{" "}
            <span className={clsx("font-semibold tabular-nums", best.gap ? "text-emerald-200" : "text-neutral-300")}>
              {fmtKm(p.gapToTarget)} km
            </span>
          </div>
          <div className="mt-1 text-xs text-neutral-600">
            Projected year-end:{" "}
            <span className="text-neutral-300 font-semibold tabular-nums">
              {fmtKm(p.yearEnd)} km
            </span>
          </div>
        </div>
      </div>

      <style>{`
        .card{
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(10,10,10,0.55);
          overflow: hidden;
          box-shadow: 0 18px 70px rgba(0,0,0,0.55);
        }
        .card__inner{
          padding: 18px;
          background:
            radial-gradient(700px circle at 15% 0%, rgba(255,255,255,0.06), transparent 55%),
            radial-gradient(700px circle at 90% 10%, rgba(16,185,129,0.10), transparent 55%);
        }
        .card--hot{
          box-shadow:
            0 18px 70px rgba(0,0,0,0.62),
            0 0 26px rgba(16,185,129,0.12);
        }
        .open-btn{
          height: 32px;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.04);
          color: rgba(229,229,229,0.92);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          transition: background 160ms ease;
          white-space: nowrap;
        }
        .open-btn:hover{ background: rgba(255,255,255,0.07); }

        .strip{
          height: 28px;
          display: inline-flex;
          align-items: center;
          padding: 0 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.01em;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.03);
          color: rgba(229,229,229,0.80);
        }
        .strip--green{
          border-color: rgba(16,185,129,0.24);
          background: rgba(16,185,129,0.08);
          color: rgba(167,243,208,0.92);
          box-shadow: 0 0 24px rgba(16,185,129,0.16);
        }
        .strip--muted{ opacity: 0.7; }

        .best-pill{
          height: 24px;
          padding: 0 10px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          border: 1px solid rgba(16,185,129,0.24);
          background: rgba(16,185,129,0.08);
          color: rgba(167,243,208,0.92);
          box-shadow: 0 0 22px rgba(16,185,129,0.14);
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}

function StatTile({
  label,
  value,
  suffix,
  best,
  delta,
  deltaUnit,
  decimals = 0,
}: {
  label: string;
  value: string;
  suffix?: string;
  best?: boolean;
  delta?: number | null;
  deltaUnit?: string;
  decimals?: number;
}) {
  return (
    <div className={clsx("tile", best ? "tile--best" : "")}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-neutral-500 text-[10px] uppercase tracking-wider">{label}</div>
        {delta === null || delta === undefined ? null : (
          <DeltaChip delta={delta} unit={deltaUnit ?? ""} compact decimals={decimals} />
        )}
      </div>

      <div className={clsx("mt-2 text-neutral-200 font-black tabular-nums leading-none", best ? "text-emerald-100" : "")}>
        {value}{" "}
        {suffix ? <span className="text-neutral-500 text-xs font-semibold">{suffix}</span> : null}
      </div>

      <style>{`
        .tile{
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(0,0,0,0.24);
          padding: 12px;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02);
        }
        .tile--best{
          border-color: rgba(16,185,129,0.22);
          box-shadow:
            inset 0 0 0 1px rgba(16,185,129,0.10),
            0 0 18px rgba(16,185,129,0.10);
        }
      `}</style>
    </div>
  );
}

function DeltaChip({
  delta,
  unit,
  title,
  compact,
  decimals = 0,
}: {
  delta: number;
  unit?: string;
  title?: string;
  compact?: boolean;
  decimals?: number;
}) {
  const up = delta >= 0;
  const abs = Math.abs(delta);

  // nicer text for completion deltas
  const unitLabel = unit === "pts" ? "pts" : unit;

  return (
    <span
      className={clsx("delta", up ? "delta--up" : "delta--down", compact ? "delta--compact" : "")}
      title={title}
    >
      {up ? "+" : "−"}
      {abs.toFixed(decimals)}
      {unitLabel ? ` ${unitLabel}` : ""}
      <style>{`
        .delta{
          height: 24px;
          padding: 0 10px;
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.02em;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.03);
          white-space: nowrap;
          line-height: 1;
        }
        .delta--compact{ padding: 0 8px; height: 22px; font-size: 10.5px; }
        .delta--up{
          border-color: rgba(16,185,129,0.22);
          background: rgba(16,185,129,0.08);
          color: rgba(167,243,208,0.92);
        }
        .delta--down{
          border-color: rgba(239,68,68,0.22);
          background: rgba(239,68,68,0.08);
          color: rgba(254,202,202,0.92);
        }
      `}</style>
    </span>
  );
}



