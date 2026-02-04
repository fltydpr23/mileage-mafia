type Props = {
  value: number;          // 0–100
  size?: number;          // px
  stroke?: number;        // px
  label?: string;
  sublabel?: string;

  // Choose ONE:
  colorClass?: string;    // Tailwind stroke class e.g. "stroke-emerald-300"
  color?: string;         // Hex/RGB e.g. "#6ee7b7"
};

export default function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  label,
  sublabel,
  colorClass,
  color,
}: Props) {
  const n = Number.isFinite(value) ? value : 0;
  const v = Math.max(0, Math.min(100, n));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (v / 100) * c;

  return (
    <div className="inline-flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            className="fill-none stroke-neutral-800"
          />

          {/* Progress circle */}
          <circle
  cx={size / 2}
  cy={size / 2}
  r={r}
  strokeWidth={stroke}
  className={`fill-none ${colorClass ?? ""}`}
  stroke={color ?? "#a3e635"} // ✅ ALWAYS has a color
  strokeLinecap="round"
  strokeDasharray={c}
  strokeDashoffset={offset}
/>

        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-black tabular-nums">{v.toFixed(1)}%</div>
            {sublabel ? (
              <div className="text-xs text-neutral-400 mt-1">{sublabel}</div>
            ) : null}
          </div>
        </div>
      </div>

      {label ? <div className="mt-3 text-sm text-neutral-300">{label}</div> : null}
    </div>
  );
}
