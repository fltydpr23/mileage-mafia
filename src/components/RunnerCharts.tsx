"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type Row = {
  week: string; // e.g. "W5"
  km: number;
  roll4: number;
  hit: 0 | 1;
  cum: number;
  expectedCum: number;
};

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1);
}

function Chip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-neutral-950/40 ring-1 ring-neutral-800 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-white font-bold tabular-nums">{value}</div>
    </div>
  );
}

export default function RunnerCharts({
  data,
  weeklyTarget,
}: {
  data: Row[];
  weeklyTarget: number;
}) {
  const has = Array.isArray(data) && data.length > 0;

  const last = has ? data[data.length - 1] : null;
  const cum = last?.cum ?? 0;
  const expected = last?.expectedCum ?? 0;
  const delta = cum - expected;

  const hits = has ? data.reduce((s, r) => s + (r.hit ? 1 : 0), 0) : 0;
  const hitRate = has ? (hits / data.length) * 100 : 0;

  // ====== Recharts theme (dark, readable) ======
  const AXIS = "#a3a3a3"; // neutral-400
  const GRID = "rgba(255,255,255,0.08)";
  const TOOL_BG = "rgba(10,10,10,0.92)";
  const TOOL_BORDER = "rgba(255,255,255,0.12)";
  const TOOL_TEXT = "#e5e5e5"; // neutral-200

  // Series colors (explicit to avoid black defaults)
  const C_KM_BAR = "rgba(255,255,255,0.18)";
  const C_ROLL = "#93c5fd"; // sky-300-ish
  const C_CUM = "#fbbf24"; // amber-400-ish
  const C_EXP = "#a78bfa"; // violet-400-ish
  const C_TARGET = "rgba(255,255,255,0.35)";

  if (!has) {
    return (
      <div className="rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 p-8">
        <div className="text-neutral-400 text-xs uppercase tracking-wider">
          Analytics
        </div>
        <div className="text-xl font-bold mt-2">Graphs</div>
        <div className="text-neutral-500 text-sm mt-2">
          Add weekly KM rows in Sheets to unlock charts.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Chip label="Cumulative" value={`${fmt(cum)} km`} />
        <Chip label="Expected (by week)" value={`${fmt(expected)} km`} />
        <Chip
          label="Ahead / Behind"
          value={`${delta >= 0 ? "+" : ""}${fmt(delta)} km`}
        />
        <Chip
          label="Target hit rate"
          value={weeklyTarget > 0 ? `${Math.round(hitRate)}%` : "—"}
        />
      </div>

      {/* Chart 1: Weekly KM + roll4 + target */}
      <section className="rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 p-6 sm:p-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-neutral-400 text-xs uppercase tracking-wider">
              Consistency
            </div>
            <div className="text-xl font-bold mt-2">Weekly KM</div>
            <div className="text-neutral-500 text-sm mt-1">
              Bars = weekly distance • Line = rolling average
            </div>
          </div>

          {weeklyTarget > 0 ? (
            <div className="text-neutral-400 text-sm">
              Target{" "}
              <span className="text-white font-semibold tabular-nums">
                {fmt(weeklyTarget)}
              </span>{" "}
              km/week
            </div>
          ) : null}
        </div>

        <div className="mt-6 h-[280px] sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fill: AXIS, fontSize: 12 }}
                axisLine={{ stroke: GRID }}
                tickLine={{ stroke: GRID }}
              />
              <YAxis
                tick={{ fill: AXIS, fontSize: 12 }}
                axisLine={{ stroke: GRID }}
                tickLine={{ stroke: GRID }}
                width={44}
              />
              <Tooltip
                contentStyle={{
                  background: TOOL_BG,
                  border: `1px solid ${TOOL_BORDER}`,
                  borderRadius: 14,
                  color: TOOL_TEXT,
                }}
                labelStyle={{ color: TOOL_TEXT, fontWeight: 700 }}
                itemStyle={{ color: TOOL_TEXT }}
                formatter={(val: any, name: any) => {
                  if (name === "km") return [`${fmt(Number(val))} km`, "Weekly"];
                  if (name === "roll4") return [`${fmt(Number(val))} km`, "Rolling avg"];
                  return [String(val), String(name)];
                }}
              />
              <Legend
                wrapperStyle={{ color: AXIS, fontSize: 12 }}
                iconType="circle"
              />

              <Bar
                dataKey="km"
                name="Weekly"
                fill={C_KM_BAR}
                radius={[10, 10, 0, 0]}
              />

              <Line
                type="monotone"
                dataKey="roll4"
                name="Rolling avg"
                stroke={C_ROLL}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 4 }}
              />

              {/* Weekly target line (flat, if present) */}
              {weeklyTarget > 0 ? (
                <Line
                  type="monotone"
                  dataKey={() => weeklyTarget}
                  name="Target"
                  stroke={C_TARGET}
                  strokeDasharray="6 6"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Chart 2: Cumulative vs Expected */}
      <section className="rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 p-6 sm:p-8">
        <div>
          <div className="text-neutral-400 text-xs uppercase tracking-wider">
            Progress
          </div>
          <div className="text-xl font-bold mt-2">Cumulative vs Expected</div>
          <div className="text-neutral-500 text-sm mt-1">
            If you’re above expected — you’re ahead of plan.
          </div>
        </div>

        <div className="mt-6 h-[280px] sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fill: AXIS, fontSize: 12 }}
                axisLine={{ stroke: GRID }}
                tickLine={{ stroke: GRID }}
              />
              <YAxis
                tick={{ fill: AXIS, fontSize: 12 }}
                axisLine={{ stroke: GRID }}
                tickLine={{ stroke: GRID }}
                width={52}
              />
              <Tooltip
                contentStyle={{
                  background: TOOL_BG,
                  border: `1px solid ${TOOL_BORDER}`,
                  borderRadius: 14,
                  color: TOOL_TEXT,
                }}
                labelStyle={{ color: TOOL_TEXT, fontWeight: 700 }}
                itemStyle={{ color: TOOL_TEXT }}
                formatter={(val: any, name: any) => {
                  if (name === "cum") return [`${fmt(Number(val))} km`, "Cumulative"];
                  if (name === "expectedCum") return [`${fmt(Number(val))} km`, "Expected"];
                  return [String(val), String(name)];
                }}
              />
              <Legend
                wrapperStyle={{ color: AXIS, fontSize: 12 }}
                iconType="circle"
              />

              <Line
                type="monotone"
                dataKey="expectedCum"
                name="Expected"
                stroke={C_EXP}
                strokeWidth={2.5}
                dot={false}
                strokeDasharray="6 6"
              />

              <Line
                type="monotone"
                dataKey="cum"
                name="Cumulative"
                stroke={C_CUM}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
