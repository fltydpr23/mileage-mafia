"use client";

export default function WeeklyBars({
  data,
  target,
  colorClass = "bg-white",
}: {
  data: { label: string; km: number }[];
  target: number;
  colorClass?: string;
}) {
  const max = Math.max(target, ...data.map((d) => d.km), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 h-40">
        {data.map((d) => {
          const h = (d.km / max) * 100;
          return (
            <div key={d.label} className="flex-1 min-w-[10px]">
              <div className="h-40 flex items-end">
                <div
                  className={`w-full rounded-lg ${colorClass}`}
                  style={{ height: `${h}%` }}
                  title={`${d.label}: ${d.km} km`}
                />
              </div>
              <div className="text-[10px] text-neutral-400 text-center mt-2">
                {d.label}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-neutral-400">
        Weekly target: <span className="text-white font-semibold">{target} km</span>
      </div>
    </div>
  );
}
