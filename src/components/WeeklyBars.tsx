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
                    className={`w-full rounded-lg ${colorClass} group relative cursor-pointer hover:shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all duration-300 hover:scale-[1.05]`}
                    style={{ height: `${h}%` }}
                  >
                     <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-neutral-950/90 backdrop-blur border border-white/20 text-white min-w-max px-3 py-2 rounded-lg pointer-events-none z-50 font-mono shadow-2xl transition-all duration-200 translate-y-2 group-hover:translate-y-0">
                         <div className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest leading-tight mb-1">Week {d.label}</div>
                         <div className="font-black text-white text-sm">{d.km.toFixed(1)} <span className="text-[10px] text-neutral-500 font-black tracking-widest">KM</span></div>
                     </div>
                  </div>
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
