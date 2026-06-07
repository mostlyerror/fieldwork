"use client";

import { useState } from "react";
import type { Badge, BadgeIcon, Rarity } from "@/lib/badges";
import { IntelSectionHeader } from "@/components/intel-section-header";

/**
 * The badge shelf. The "bare" variant (used in the profile rail) renders earned
 * badges as glossy die-cut STICKERS — rarity-colored dies with a white die-cut
 * border, a gloss highlight, a slight playful rotation, a holographic sheen on
 * legendaries, and a jiggle on tap that reveals the "why". The "card" variant
 * keeps the legacy pills.
 */

const RARITY: Record<Rarity, { chip: string; icon: string; dot: string; label: string }> = {
  common: { chip: "border-gray-200 bg-gray-50 text-gray-700", icon: "text-gray-400", dot: "bg-gray-300", label: "Common" },
  uncommon: { chip: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: "text-emerald-500", dot: "bg-emerald-400", label: "Uncommon" },
  rare: { chip: "border-amber-200 bg-amber-50 text-amber-900", icon: "text-amber-500", dot: "bg-amber-400", label: "Rare" },
  legendary: {
    chip: "border-amber-300 bg-gradient-to-br from-amber-50 to-emerald-50 text-amber-900 shadow-[0_2px_12px_-4px_rgba(217,168,60,0.5)]",
    icon: "text-amber-500",
    dot: "bg-gradient-to-r from-amber-400 to-emerald-400",
    label: "Legendary",
  },
};

// Saturated sticker-die fills by rarity (the glyph reads white on top).
const STICKER_BG: Record<Rarity, string> = {
  common: "linear-gradient(155deg,#6b7280,#475569)",
  uncommon: "linear-gradient(155deg,#10b981,#059669)",
  rare: "linear-gradient(155deg,#f0b429,#cf940d)",
  legendary: "linear-gradient(150deg,#0f9d68 0%,#1f9d57 42%,#d4af37 100%)",
};
const ROT = [-5, 4, -3, 5, -4, 3, -2, 4, -3];

export function BadgeShelf({
  badges,
  variant = "card",
}: {
  badges: Badge[];
  variant?: "card" | "bare";
}) {
  const [open, setOpen] = useState<string | null>(badges[0]?.id ?? null);
  const [jiggle, setJiggle] = useState<string | null>(null);
  if (badges.length === 0) return null;

  const active = badges.find((b) => b.id === open) ?? null;

  function tap(id: string) {
    setOpen((cur) => (cur === id ? null : id));
    setJiggle(id);
    window.setTimeout(() => setJiggle((j) => (j === id ? null : j)), 520);
  }

  const detail =
    active &&
    (variant === "bare" ? (
      <p className="mt-3.5 flex items-start gap-2 px-0.5 t-small text-gray-500">
        <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${RARITY[active.rarity].dot}`} />
        <span>
          <span className="font-semibold text-gray-700">{active.name}</span> — {active.tagline}
        </span>
      </p>
    ) : (
      <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-gray-50 px-3.5 py-3">
        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${RARITY[active.rarity].dot}`} />
        <div className="min-w-0">
          <p className="t-body font-semibold text-gray-900">
            {active.name}
            <span className="ml-2 t-caption font-bold uppercase tracking-wide text-gray-400">
              {RARITY[active.rarity].label}
            </span>
          </p>
          <p className="t-small text-gray-500">{active.tagline}</p>
        </div>
      </div>
    ));

  // Bare: glossy die-cut sticker grid floated in the rail.
  if (variant === "bare") {
    return (
      <div>
        <div className="mb-3 flex items-baseline justify-between px-0.5">
          <span className="t-label text-gray-400">Badges</span>
          <span className="t-caption tabular-nums text-gray-400">{badges.length}</span>
        </div>
        <div className="grid grid-cols-3 gap-x-1 gap-y-4">
          {badges.map((b, i) => {
            const isOpen = b.id === open;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => tap(b.id)}
                aria-pressed={isOpen}
                title={b.name}
                className={`rc-sticker flex flex-col items-center gap-1.5 bg-transparent ${jiggle === b.id ? "rc-jiggle" : ""}`}
                style={{ "--rot": `${ROT[i % ROT.length]}deg`, animationDelay: `${i * 55}ms` } as React.CSSProperties}
              >
                <span
                  className={`rc-die flex h-[58px] w-[58px] items-center justify-center ${b.rarity === "legendary" ? "rc-die-legendary" : ""} ${isOpen ? "ring-2 ring-emerald-600/60 ring-offset-2 ring-offset-[#FFFDF7]" : ""}`}
                  style={{ background: STICKER_BG[b.rarity] }}
                >
                  <span className="relative z-[1] text-white">
                    <BadgeGlyph icon={b.icon} className="h-6 w-6" />
                  </span>
                </span>
                <span className="line-clamp-2 px-0.5 text-center t-caption font-bold leading-tight text-gray-700">
                  {b.name}
                </span>
              </button>
            );
          })}
        </div>
        {detail}
      </div>
    );
  }

  // Card variant — legacy pills.
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/70 shadow-card sm:rounded-3xl">
      <IntelSectionHeader title="Badges" badge={`${badges.length}`} />
      <div className="bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {badges.map((b) => {
            const r = RARITY[b.rarity];
            const isOpen = b.id === open;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => tap(b.id)}
                aria-pressed={isOpen}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 t-small font-bold transition active:scale-[0.97] ${r.chip} ${isOpen ? "ring-2 ring-emerald-600/40" : ""}`}
              >
                <span className={r.icon}>
                  <BadgeGlyph icon={b.icon} />
                </span>
                {b.name}
              </button>
            );
          })}
        </div>
        {detail}
      </div>
    </div>
  );
}

function BadgeGlyph({ icon, className = "h-3.5 w-3.5" }: { icon: BadgeIcon; className?: string }) {
  const p = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className };
  switch (icon) {
    case "trending-up":
      return <svg {...p}><path d="M3 17l6-6 4 4 7-7" /><path d="M17 8h4v4" /></svg>;
    case "trending-down":
      return <svg {...p}><path d="M3 7l6 6 4-4 7 7" /><path d="M17 16h4v-4" /></svg>;
    case "flame":
      return <svg {...p}><path d="M12 2c1 4 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 .5 2 2 2 2 2 0-3-1-5 1-7z" /></svg>;
    case "shuffle":
      return <svg {...p}><path d="M16 3h5v5" /><path d="M4 20 21 3" /><path d="M21 16v5h-5" /><path d="m15 15 6 6" /><path d="M4 4l5 5" /></svg>;
    case "users":
      return <svg {...p}><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 6a3 3 0 0 1 0 6" /><path d="M18 14a6 6 0 0 1 3 5" /></svg>;
    case "user":
      return <svg {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>;
    case "swap":
      return <svg {...p}><path d="M7 4 3 8l4 4" /><path d="M3 8h14" /><path d="m17 20 4-4-4-4" /><path d="M21 16H7" /></svg>;
    case "link":
      return <svg {...p}><path d="M9 12a3 3 0 0 1 3-3h2a3 3 0 0 1 0 6" /><path d="M15 12a3 3 0 0 1-3 3h-2a3 3 0 0 1 0-6" /></svg>;
    case "peak":
      return <svg {...p}><path d="m3 20 6-12 4 7 2-3 6 8z" /><circle cx="9" cy="8" r="0.5" /></svg>;
    case "shield":
      return <svg {...p}><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /></svg>;
    case "pickle":
      return <svg {...p}><circle cx="12" cy="12" r="8" /><path d="M9 9.5h.01M14.5 11h.01M10.5 14h.01M14 15h.01" /></svg>;
    case "slayer":
      return <svg {...p}><path d="M14.5 4 20 9.5 9 20.5 4 21l.5-5z" /><path d="m13 6 5 5" /><path d="m5 15 4 4" /></svg>;
    case "comeback":
      return <svg {...p}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /></svg>;
    case "target":
      return <svg {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.5" /></svg>;
    default:
      return <svg {...p}><circle cx="12" cy="12" r="8" /></svg>;
  }
}
