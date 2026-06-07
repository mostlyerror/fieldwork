"use client";

import { useState } from "react";
import Link from "next/link";
import { IntelSectionHeader } from "@/components/intel-section-header";
import type { PartnerChemistryProps, PartnerRow } from "@/components/player/types";

const DEFAULT_VISIBLE = 5;

/** Two-letter initials for the avatar circle. */
function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Map a free-text verdict to a chip tone. We key off known phrases but fall
 * back to a neutral chip so an unexpected verdict still renders cleanly.
 */
function verdictTone(verdict: string): {
  className: string;
  dot: string;
} {
  const v = verdict.toLowerCase();
  if (v.includes("elite")) {
    return {
      className: "bg-emerald-700 text-white",
      dot: "bg-white/80",
    };
  }
  if (v.includes("reliable")) {
    return {
      className: "bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500",
    };
  }
  if (v.includes("out of sync")) {
    return {
      className: "bg-red-50 text-red-600",
      dot: "bg-red-400",
    };
  }
  // "Still gelling" and anything unrecognized — warm neutral / amber.
  return {
    className: "bg-amber-50 text-amber-700",
    dot: "bg-amber-400",
  };
}

function VerdictChip({ verdict }: { verdict: string }) {
  const tone = verdictTone(verdict);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 t-label tracking-[0.04em] ${tone.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
      {verdict}
    </span>
  );
}

function PartnerChemistryRow({ partner }: { partner: PartnerRow }) {
  const winPct = Math.round(partner.winRate); // winRate is already 0–100
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
      {/* Avatar */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 t-caption font-bold text-emerald-700"
        aria-hidden
      >
        {initials(partner.name)}
      </div>

      {/* Name + verdict */}
      <div className="min-w-0 flex-1">
        {partner.playerId ? (
          <Link
            href={`/players/${partner.playerId}`}
            className="block truncate t-body font-semibold text-gray-900 hover:text-emerald-700"
          >
            {partner.name}
          </Link>
        ) : (
          <span className="block truncate t-body font-semibold text-gray-900">
            {partner.name}
          </span>
        )}
        <div className="mt-1 flex items-center gap-2">
          {partner.verdict ? (
            <VerdictChip verdict={partner.verdict} />
          ) : (
            <span className="t-caption text-gray-400">
              {partner.matches} match{partner.matches !== 1 ? "es" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Stats — right-aligned, tabular */}
      <div className="shrink-0 text-right">
        <div className="t-body font-semibold tabular-nums text-gray-900">
          {partner.wins}
          <span className="text-gray-300">–</span>
          {partner.losses}
        </div>
        <div className="mt-0.5 t-caption tabular-nums text-gray-400">
          {winPct}% · {partner.matches} match{partner.matches !== 1 ? "es" : ""}
        </div>
      </div>
    </div>
  );
}

export function PartnerChemistry({ partners }: PartnerChemistryProps) {
  const [expanded, setExpanded] = useState(false);
  if (partners.length === 0) return null;

  // Sort by matches played, most-played first. Copy first — never mutate props.
  const sorted = [...partners].sort((a, b) => b.matches - a.matches);
  const hasMore = sorted.length > DEFAULT_VISIBLE;
  const visible = expanded ? sorted : sorted.slice(0, DEFAULT_VISIBLE);

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200/70 shadow-card sm:rounded-3xl">
      <IntelSectionHeader
        title="Partner Chemistry"
        badge={`${sorted.length} partner${sorted.length !== 1 ? "s" : ""}`}
      />
      <div className="divide-y divide-gray-100 bg-white">
        {visible.map((partner) => (
          <PartnerChemistryRow
            key={partner.playerId ?? partner.name}
            partner={partner}
          />
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-h-[44px] w-full items-center justify-center gap-1.5 border-t border-gray-100 bg-white px-4 py-3 t-caption font-semibold text-emerald-700 transition hover:bg-emerald-50"
        >
          {expanded ? "Show less" : `Show all (${sorted.length})`}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}
    </section>
  );
}
