import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PotPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Pot Breakdown</h1>
          <Link
            href="/leaderboard"
            className="px-4 py-2 rounded-full bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition"
          >
            ← Back
          </Link>
        </div>

        <p className="mt-4 text-neutral-400">
          Full split, penalties, rewards, and payouts will live here.
        </p>

        {/* Replace this with your real breakdown cards */}
        <div className="mt-6 rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 p-6">
          <p className="text-neutral-500 text-sm">Coming next: itemized ledger.</p>
        </div>
      </div>
    </main>
  );
}
