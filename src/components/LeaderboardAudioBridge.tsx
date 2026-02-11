"use client";

import { useEffect } from "react";
import { useAudio } from "@/components/AudioProvider";

/**
 * Ensures that if noir/music is already playing (from the oath page),
 * the music channel stays foreground on leaderboard.
 *
 * IMPORTANT:
 * - Does NOT call play() (no autoplay issues)
 * - Only fixes routing/foreground mode if something is already running
 */
export default function LeaderboardAudioBridge() {
  const audio = useAudio();

  useEffect(() => {
    // If the provider got remounted, this won't help — fix is to put provider in root layout.
    // If provider persists, then on route change we just keep routing consistent.

    // If something is already playing, ensure it's routed correctly.
    if (!audio.playing) return;

    // If the current track is one of your noir tracks, make sure mode is "music".
    // (Your provider controls volume routing based on mode.)
    const id = (audio.current?.id || "").toLowerCase();
    const looksLikeMusic = id.startsWith("noir") || audio.mode === "music";

    if (looksLikeMusic && audio.mode !== "music") {
      // DON'T call playMusic() (could trip autoplay). Just flip mode if your provider exposes it.
      // If your provider doesn't expose setMode, then we need to add a safe method:
      // `setForeground("music" | "ambience")` in AudioProvider.
      //
      // For now: best is to add setForeground to AudioProvider (I’ll show the patch below).
      (audio as any)?.setForeground?.("music");
    }
  }, [audio]);

  return null;
}
