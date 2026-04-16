"use client";

import React, { useCallback, useState } from "react";
import { useAudio, type StationId } from "@/components/AudioProvider";
import { motion, AnimatePresence } from "framer-motion";

const STATIONS: { id: StationId; label: string }[] = [
  { id: "techno", label: "TECHNO BNKR" },
  { id: "tamil",  label: "TAMIL HEAT" },
  { id: "hiphop", label: "BEAST MODE" },
];

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function NowPlaying() {
  const {
    playing,
    unlocked,
    current,
    currentTime,
    duration,
    toggle,
    next,
    prev,
    seek,
    unlock,
    recover,
    startStation,
    changeStation,
    activeStationId,
  } = useAudio();

  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  const onScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v)) return;
      seek(v);
    },
    [seek]
  );

  const ensurePlay = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (!unlocked) {
        await unlock();
        await startStation(activeStationId);
      } else {
        toggle();
      }
    } catch {
      try { await recover(); } catch { }
    } finally {
      setBusy(false);
    }
  }, [busy, unlocked, unlock, startStation, activeStationId, recover, toggle]);

  return (
    <div className="relative w-full max-w-[320px] flex flex-col justify-center items-center">
      <motion.div
        layout
        className="pointer-events-auto shadow-2xl relative"
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
      >
        <AnimatePresence mode="popLayout">
          {!expanded ? (
            // MINI STATE: Brutalist Pill
            <motion.div
              layoutId="player-base"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-10 rounded-full bg-neutral-900/60 backdrop-blur-md border border-white/10 flex items-center justify-between cursor-pointer w-[280px] p-1 shadow-lg group hover:border-white/20 transition-colors"
              onClick={() => setExpanded(true)}
              key="mini"
            >
              {/* Play/Pause Button */}
              <button
                onClick={ensurePlay}
                className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-white/10 flex items-center justify-center text-white transition-colors shrink-0"
                disabled={busy}
              >
                 {playing ? <span className="text-[9px] font-bold">❚❚</span> : <span className="text-[10px] pl-[2px] font-bold">▶</span>}
              </button>

              {/* Center Info */}
              <div className="flex-1 flex flex-col items-center justify-center px-2 overflow-hidden mx-1">
                <span className="text-[9px] font-bold text-white uppercase tracking-widest truncate w-full text-center leading-tight">
                  {current?.title || "OFFLINE"}
                </span>
                <span className="text-[7.5px] font-bold text-neutral-500 uppercase tracking-widest truncate w-full text-center mt-[1px]">
                  {current?.artist || "AUDIO BROADCAST"}
                </span>
              </div>

              {/* Right Side: EQ Animation */}
              <div className="flex items-center justify-center shrink-0 w-8 h-8 relative rounded-full bg-white/5">
                {playing ? (
                  <div className="flex items-end justify-center gap-[2px] h-[10px] w-full relative z-10">
                    <motion.div animate={{ height: ["4px", "10px", "4px"] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-[1.5px] bg-red-500/80 rounded-full" />
                    <motion.div animate={{ height: ["8px", "4px", "8px"] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-[1.5px] bg-white rounded-full" />
                    <motion.div animate={{ height: ["5px", "11px", "5px"] }} transition={{ repeat: Infinity, duration: 0.7 }} className="w-[1.5px] bg-neutral-400 rounded-full" />
                  </div>
                ) : (
                  <div className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
                )}
              </div>
            </motion.div>
          ) : (
            // EXPANDED STATE
            <motion.div
              layoutId="player-base"
              className="w-[280px] flex flex-col rounded-2xl bg-neutral-900/90 backdrop-blur-xl border border-white/10 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              key="expanded"
            >
              <div className="p-5 flex flex-col gap-4">
                 {/* Header */}
                 <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                       <div className={`w-1.5 h-1.5 rounded-full ${playing ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse' : 'bg-neutral-600'}`} />
                       Now Playing
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setExpanded(false); }} className="text-[8px] font-bold tracking-widest text-neutral-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full px-3 py-1">
                       CLOSE
                    </button>
                 </div>

                 {/* Info Block */}
                 <div className="flex flex-col items-center text-center mt-2">
                   <div className="font-black text-white text-[13px] tracking-widest uppercase truncate w-full">{current?.title || "Radio Offline"}</div>
                   <div className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest mt-1.5 truncate w-full">
                     {current?.artist || "Syndicate Broadcast"}
                   </div>
                 </div>

                 {/* Scrubber */}
                 <div className="flex flex-col gap-2 w-full mt-4">
                    <input
                       aria-label="Seek"
                       type="range"
                       min={0}
                       max={Math.max(0, duration || 0)}
                       step={0.1}
                       value={Math.min(Math.max(0, currentTime || 0), Math.max(0, duration || 0))}
                       onChange={onScrub}
                       className="w-full h-1 accent-white bg-neutral-800 appearance-none rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
                       disabled={!duration || duration <= 0}
                    />
                    <div className="flex items-center justify-between text-[8px] text-neutral-500 font-bold tracking-widest mt-0.5">
                       <span>{fmt(currentTime)}</span>
                       <span>{fmt(duration)}</span>
                     </div>
                 </div>

                 {/* Station Picker */}
                 <div className="flex justify-center gap-2 mt-2 pt-4 border-t border-white/5">
                    {STATIONS.map(station => (
                        <button
                           key={station.id}
                           onClick={(e) => { e.stopPropagation(); changeStation(station.id); }}
                           className={`flex-1 flex justify-center py-2 rounded-md text-[8px] font-bold tracking-[0.15em] uppercase transition-all border ${
                               activeStationId === station.id
                                   ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                                   : "bg-white/5 text-neutral-500 border-transparent hover:text-neutral-300 hover:bg-white/10"
                           }`}
                        >
                           {station.label}
                        </button>
                    ))}
                 </div>
              </div>

              {/* Controls Footer */}
              <div className="flex items-center justify-center gap-6 h-[72px] bg-black/40 border-t border-white/5">
                <button
                  onClick={prev}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggle(); }}
                  className="w-12 h-12 rounded-full bg-white hover:bg-neutral-200 text-black shadow-lg transition-transform hover:scale-105 flex items-center justify-center"
                >
                  {playing ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" className="ml-1"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  )}
                </button>
                <button
                  onClick={next}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
