import Link from "next/link";

export const dynamic = "force-dynamic";

type PotEvent = {
  id: string;
  date: string; // display string
  isoDate: string; // YYYY-MM-DD for sorting
  title: string;
  description: string;
  kind: "penalty" | "reward" | "note";
  amount: number; // + adds to pot, - subtracts from pot
  people?: Array<{ name: string; amount: number }>;
};

function fmtINR(n: number) {
  const sign = n < 0 ? "-" : "+";
  const abs = Math.abs(Math.round(n));
  return `${sign}₹${abs.toLocaleString("en-IN")}`;
}

function fmtINRPlain(n: number) {
  const abs = Math.abs(Math.round(n));
  return `₹${abs.toLocaleString("en-IN")}`;
}

function pillFor(kind: PotEvent["kind"]) {
  if (kind === "penalty") return "bg-red-500/10 text-red-200 ring-1 ring-red-500/20";
  if (kind === "reward") return "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20";
  return "bg-white/5 text-neutral-200 ring-1 ring-white/10";
}

export default async function PotPage() {
  // ===== Hardcoded for now (we can wire Sheets later) =====
  // Bribery case happened on 2 Feb 2026:
  const events: PotEvent[] = [
    {
      id: "bribery-2026-02-02",
      date: "2 Feb 2026",
      isoDate: "2026-02-02",
      title: "Penalty collected — Bribery (Disorderly conduct)",
      description:
        "Two runners attempted bribery. Family penalty enforced and transferred to the penalty pool.",
      kind: "penalty",
      amount: 1000,
      people: [
        { name: "Kumaran", amount: 500 },
        { name: "Rishi", amount: 500 },
      ],
    },
    {
      id: "note-payouts",
      date: "—",
      isoDate: "2099-01-01",
      title: "Upcoming payouts",
      description:
        "Next payouts: ₹400 to first Soldier (250 km) and ₹600 to first Area Don (500 km). Auto-awarded when the sheet shows the threshold crossed.",
      kind: "note",
      amount: 0,
    },
  ];

  // Compute totals from events
  const penaltyFund = events
    .filter((e) => e.kind === "penalty")
    .reduce((s, e) => s + e.amount, 0);

  const rewardsPaid = events
    .filter((e) => e.kind === "reward")
    .reduce((s, e) => s + Math.abs(e.amount), 0);

  // If/when you add reward events as negative amounts, this still works:
  const netPenaltyPool = events.reduce((s, e) => s + e.amount, 0);

  const sorted = [...events].sort((a, b) => b.isoDate.localeCompare(a.isoDate));

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_circle_at_20%_-10%,rgba(255,255,255,0.08),transparent_60%),radial-gradient(900px_circle_at_90%_0%,rgba(239,68,68,0.10),transparent_55%),radial-gradient(900px_circle_at_60%_110%,rgba(16,185,129,0.08),transparent_55%)]" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-neutral-400 text-xs uppercase tracking-[0.35em]">
              Mileage Mafia
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">
              Pot Breakdown
            </h1>
            <p className="mt-2 text-neutral-400 text-sm">
              Itemized penalty ledger + payout trail.
            </p>
          </div>

          <Link
            href="/leaderboard"
            className="shrink-0 px-4 py-2 rounded-full bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition text-sm font-semibold"
          >
            ← Back
          </Link>
        </div>

        {/* Summary row */}
        <section className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <SummaryCard
            label="Penalty pool (net)"
            value={fmtINRPlain(Math.max(0, netPenaltyPool))}
            sub="Available for rewards"
            glow="ring-red-500/20"
          />
          <SummaryCard
            label="Collected"
            value={fmtINRPlain(penaltyFund)}
            sub="Total penalties collected"
            glow="ring-white/10"
          />
          <SummaryCard
            label="Paid out"
            value={fmtINRPlain(rewardsPaid)}
            sub="Rewards already paid"
            glow="ring-emerald-500/20"
          />
        </section>

        {/* Ledger */}
        <section className="mt-6 rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 overflow-hidden">
          <div className="px-6 sm:px-8 py-6 border-b border-neutral-800">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-neutral-400 text-xs uppercase tracking-wider">
                  Ledger
                </p>
                <h2 className="mt-1 text-lg sm:text-xl font-black tracking-tight">
                  Penalties & payouts
                </h2>
              </div>

              <div className="px-3 py-1.5 rounded-full bg-white/5 ring-1 ring-white/10 text-neutral-300 text-xs">
                Auto-updates later via Sheets
              </div>
            </div>
          </div>

          <div className="divide-y divide-neutral-800">
            {sorted.map((e) => (
              <div key={e.id} className="px-6 sm:px-8 py-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-[0.22em] ${pillFor(e.kind)}`}>
                        {e.kind}
                      </span>
                      {e.date !== "—" ? (
                        <span className="text-neutral-500 text-xs tabular-nums">
                          {e.date}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-3 text-lg font-black tracking-tight">
                      {e.title}
                    </p>
                    <p className="mt-2 text-neutral-400 text-sm leading-relaxed">
                      {e.description}
                    </p>

                    {e.people?.length ? (
                      <div className="mt-4 rounded-2xl bg-neutral-950/40 ring-1 ring-neutral-800 p-4">
                        <p className="text-neutral-500 text-xs uppercase tracking-wider">
                          Breakdown
                        </p>
                        <div className="mt-3 space-y-2">
                          {e.people.map((p) => (
                            <div
                              key={p.name}
                              className="flex items-center justify-between gap-3"
                            >
                              <span className="text-neutral-200 font-semibold">
                                {p.name}
                              </span>
                              <span className="text-neutral-300 font-semibold tabular-nums">
                                +{fmtINRPlain(p.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="shrink-0">
                    <div className="rounded-2xl bg-neutral-950/40 ring-1 ring-neutral-800 px-5 py-4 text-right">
                      <p className="text-neutral-500 text-xs uppercase tracking-wider">
                        Amount
                      </p>
                      <p className="mt-2 text-white font-black text-xl tabular-nums">
                        {fmtINR(e.amount)}
                      </p>
                      <p className="mt-1 text-neutral-600 text-xs">
                        {e.amount >= 0 ? "Added to pool" : "Deducted from pool"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  glow,
}: {
  label: string;
  value: string;
  sub: string;
  glow: string;
}) {
  return (
    <div className={`rounded-3xl bg-neutral-900/70 ring-1 ${glow} p-6`}>
      <p className="text-neutral-500 text-xs uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-tight tabular-nums">
        {value}
      </p>
      <p className="mt-2 text-neutral-500 text-sm">{sub}</p>
    </div>
  );
}
