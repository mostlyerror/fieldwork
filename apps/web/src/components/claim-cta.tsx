"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";

/**
 * "Is this you?" prompt shown on unclaimed player profiles. Routes to the claim
 * flow (/profile/find) and fires claim_cta_clicked so we can measure how often
 * the profile is the entry point into claiming.
 */
export function ClaimCta({
  playerId,
  playerName,
}: {
  playerId: string;
  playerName?: string;
}) {
  return (
    <Link
      href="/profile/find"
      onClick={() => track("claim_cta_clicked", { player_id: playerId })}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-700/30 bg-emerald-50/60 px-4 py-3 t-body font-semibold text-emerald-800 transition hover:bg-emerald-50 hover:border-emerald-700/50"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0"
        aria-hidden="true"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="m17 11 2 2 4-4" />
      </svg>
      <span>{playerName ? "Is this you? Claim this profile" : "Claim this profile"}</span>
    </Link>
  );
}
