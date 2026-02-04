"use client";

import { useAudio } from "@/components/AudioProvider";

export default function NowPlaying() {
  const a = useAudio();

  return (
  <div className="fixed bottom-5 right-5 z-[9999] w-[320px] max-w-[calc(100vw-2.5rem)] rounded-2xl bg-neutral-950/70 backdrop-blur-xl ring-1 ring-white/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">
            Now Playing
          </p>
          <p className="mt-1 font-semibold text-white truncate">{a.current.title}</p>
        </div>

        <button
          onClick={() => a.toggle()}
          className="shrink-0 px-3 py-2 rounded-xl bg-white text-black font-bold hover:opacity-90 transition"
          aria-label={a.playing ? "Pause" : "Play"}
        >
          {a.playing ? "❚❚" : "▶"}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => a.prev()}
          className="px-3 py-2 rounded-xl bg-neutral-900 ring-1 ring-neutral-800 hover:bg-white/5 transition"
          aria-label="Previous track"
        >
          ‹
        </button>

        <button
          onClick={() => a.next()}
          className="px-3 py-2 rounded-xl bg-neutral-900 ring-1 ring-neutral-800 hover:bg-white/5 transition"
          aria-label="Next track"
        >
          ›
        </button>

        <select
          value={a.current.id}
          onChange={(e) => a.setTrackById(e.target.value)}
          className="ml-auto w-full px-3 py-2 rounded-xl bg-neutral-900 ring-1 ring-neutral-800 text-sm text-white/90"
          aria-label="Choose track"
        >
          {a.tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={a.volume}
          onChange={(e) => a.setVolume(parseFloat(e.target.value))}
          className="w-full"
          aria-label="Volume"
        />
        <p className="mt-1 text-xs text-neutral-500">Volume</p>
      </div>
    </div>
  );
}
