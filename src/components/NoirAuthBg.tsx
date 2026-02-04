export default function NoirAuthBg() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Deep base */}
      <div className="absolute inset-0 bg-neutral-950" />

      {/* Moving neon blooms */}
      <div className="noir-blooms absolute inset-0 opacity-90" />

      {/* Grain/static */}
      <div className="noir-noise absolute inset-0 opacity-[0.22] mix-blend-overlay" />

      {/* Scanlines */}
      <div className="noir-scanlines absolute inset-0 opacity-[0.20] mix-blend-overlay" />

      {/* Subtle vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_40%,transparent_40%,rgba(0,0,0,0.9)_78%)]" />
    </div>
  );
}
