export default function NoirAuthBg() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-black">
      {/* Deep base with very subtle radial glow */}
      <div 
        className="absolute inset-0 opacity-40" 
        style={{ background: "radial-gradient(circle at 50% 0%, rgba(220,38,38,0.15) 0%, transparent 60%)" }} 
      />
      
      {/* Premium subtle noise (much lighter than the old noir noise) */}
      <div 
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")"
        }}
      />
    </div>
  );
}
