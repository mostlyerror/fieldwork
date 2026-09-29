"use client";

import { sendGAEvent } from "@next/third-parties/google";
import { IntelSectionHeader } from "@/components/intel-section-header";
import { BAND_LABELS, gearLinks, type RatingBand } from "@/lib/gear";

/**
 * Small affiliate "Gear" card: paddle picks for one rating band. Renders
 * nothing unless NEXT_PUBLIC_AFFILIATE_TAG is set. Clicks fire a GA4
 * gear_click event so we can see whether anyone uses it.
 */
export function GearCard({
  band,
  surface,
}: {
  band: RatingBand;
  surface: "player" | "tournament";
}) {
  const links = gearLinks(band, process.env.NEXT_PUBLIC_AFFILIATE_TAG);
  if (links.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200/70 shadow-card sm:rounded-3xl">
      <IntelSectionHeader title="Gear" badge={BAND_LABELS[band]} />
      <div className="divide-y divide-gray-50 bg-white">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="sponsored noopener"
            onClick={() => {
              if (!process.env.NEXT_PUBLIC_GA_ID) return;
              sendGAEvent("event", "gear_click", {
                surface,
                band,
                item: link.label,
              });
            }}
            className="flex items-start justify-between gap-4 px-4 py-3 transition hover:bg-gray-50"
          >
            <div className="min-w-0">
              <p className="t-body font-semibold text-gray-900">{link.label}</p>
              <p className="t-caption text-gray-500">{link.blurb}</p>
            </div>
            <span aria-hidden className="shrink-0 t-body text-emerald-700">↗</span>
          </a>
        ))}
      </div>
      <p className="border-t border-gray-100 bg-white px-4 py-2 t-caption text-gray-400">
        We earn a small commission if you buy through these links.
      </p>
    </section>
  );
}
