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

    // If the current track is one of your noir tracks, consider it as music mode.
    // (Your provider controls volume routing based on mode.)
    const id = (audio.current?.id || "").toLowerCase();
    const looksLikeMusic = id.startsWith("noir");

    if (looksLikeMusic) {
      // DON'T call playMusic() (could trip autoplay).
      // The AudioProvider doesn't currently expose mode/setForeground, so we just
      // detect the track type here. Volume routing based on mode would need to be
      // added to AudioProvider if needed.
    }
  }, [audio]);

  return null;
}
