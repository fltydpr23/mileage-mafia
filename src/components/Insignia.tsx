"use client";

import React from "react";

export type InsigniaId =
  | "first_soldier"   // ₹400
  | "first_area_don"  // ₹600
  | "clean_record"
  | "godfather_lock"
  | "leader_bonus";   // +₹1000 pill icon variant (optional)

type Props = {
  id: InsigniaId;
  size?: number; // px
  title?: string; // tooltip
  className?: string;
};

/**
 * Minimal noir SVG insignias.
 * - Designed to look good at 18–22px.
 * - Uses currentColor so you can tint via CSS classes.
 * - Strokes are clean, no gradients, no emoji.
 */
export default function Insignia({ id, size = 20, title, className }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    xmlns: "http://www.w3.org/2000/svg",
    className,
    "aria-hidden": title ? undefined : true,
    role: title ? "img" : "presentation",
  };

  // Sensible defaults (you can override per usage)
  const defaultTitle: Record<InsigniaId, string> = {
    first_soldier: "First Soldier — 250km cleared (₹400)",
    first_area_don: "First Area Don — 500km seized (₹600)",
    clean_record: "Clean Record — no incidents",
    godfather_lock: "Godfather Lock — 1800km",
    leader_bonus: "Leader Bonus — +₹1000",
  };

  const t = title ?? defaultTitle[id];

  switch (id) {
    /**
     * FIRST SOLDIER
     * A single brass stripe.
     */
    case "first_soldier":
      return (
        <svg {...common}>
          {t ? <title>{t}</title> : null}
          {/* outer frame */}
          <rect x="3.5" y="6.5" width="17" height="11" rx="3" stroke="currentColor" strokeWidth="1.5" opacity="0.9" />
          {/* single stripe */}
          <rect x="7" y="11" width="10" height="2" rx="1" fill="currentColor" opacity="0.95" />
          {/* tiny rivets */}
          <circle cx="6.1" cy="12" r="0.9" fill="currentColor" opacity="0.65" />
          <circle cx="17.9" cy="12" r="0.9" fill="currentColor" opacity="0.65" />
        </svg>
      );

    /**
     * FIRST AREA DON
     * Two stacked stripes.
     */
    case "first_area_don":
      return (
        <svg {...common}>
          {t ? <title>{t}</title> : null}
          <rect x="3.5" y="6.5" width="17" height="11" rx="3" stroke="currentColor" strokeWidth="1.5" opacity="0.9" />
          <rect x="7" y="9.6" width="10" height="2" rx="1" fill="currentColor" opacity="0.95" />
          <rect x="7" y="12.4" width="10" height="2" rx="1" fill="currentColor" opacity="0.95" />
          <circle cx="6.1" cy="12" r="0.9" fill="currentColor" opacity="0.65" />
          <circle cx="17.9" cy="12" r="0.9" fill="currentColor" opacity="0.65" />
        </svg>
      );

    /**
     * CLEAN RECORD
     * Thin ring + subtle notch.
     */
    case "clean_record":
      return (
        <svg {...common}>
          {t ? <title>{t}</title> : null}
          <circle cx="12" cy="12" r="7.25" stroke="currentColor" strokeWidth="1.5" opacity="0.95" />
          {/* notch */}
          <path d="M12 4.5v2.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
          {/* inner pin */}
          <circle cx="12" cy="12" r="1.25" fill="currentColor" opacity="0.7" />
        </svg>
      );

    /**
     * GODFATHER LOCK
     * Wax-seal vibe: octagon + inner ring.
     */
    case "godfather_lock":
      return (
        <svg {...common}>
          {t ? <title>{t}</title> : null}
          <path
            d="M12 3.7l2.2 1.1 2.4.3 1.5 1.9 1.9 1.5.3 2.4 1.1 2.2-1.1 2.2-.3 2.4-1.9 1.5-1.5 1.9-2.4.3-2.2 1.1-2.2-1.1-2.4-.3-1.5-1.9-1.9-1.5-.3-2.4L2.7 12l1.1-2.2.3-2.4 1.9-1.5 1.5-1.9 2.4-.3L12 3.7z"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.95"
          />
          <circle cx="12" cy="12" r="4.4" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
          {/* tiny “seal scar” */}
          <path d="M9.2 13.2l1.7 1.7 3.9-4.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
        </svg>
      );

    /**
     * LEADER BONUS (optional icon if you want)
     * Crown-like chevron. Very minimal.
     */
    case "leader_bonus":
      return (
        <svg {...common}>
          {t ? <title>{t}</title> : null}
          <path
            d="M5.5 10.5l2.9 3.4 3.6-5.0 3.6 5.0 2.9-3.4v7.0H5.5v-7.0z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            opacity="0.95"
          />
          <path d="M7.2 17.5h9.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
        </svg>
      );

    default:
      return null;
  }
}
