"use client";

import Link from "next/link";

const designs = [
  { num: 1, href: "/redesign/1", label: "Bold Community Rally" },
  { num: 2, href: "/redesign/2", label: "Warm & Conversational" },
  { num: 3, href: "/redesign/3", label: "Dark & Premium" },
  { num: 4, href: "/redesign/4", label: "Minimal & Clean" },
  { num: 5, href: "/redesign/5", label: "Playful & Energetic" },
];

export default function RedesignIndex() {
  return (
    <div className="min-h-screen bg-neutral-950 p-6 sm:p-10">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-2 text-2xl font-semibold text-white">
          Footer & CTA — Design Variations
        </h1>
        <p className="mb-8 text-sm text-white/50">
          Click a preview to view the full design.
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {designs.map((d) => (
            <Link key={d.num} href={d.href} className="group block">
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-white/10 bg-neutral-900 transition-all duration-200 group-hover:border-white/25 group-hover:shadow-lg group-hover:shadow-white/5">
                <iframe
                  src={d.href}
                  className="pointer-events-none origin-top-left"
                  style={{
                    width: "1440px",
                    height: "900px",
                    transform: "scale(var(--preview-scale))",
                  }}
                  tabIndex={-1}
                  loading="lazy"
                />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-mono text-xs tabular-nums text-white/30">
                  {String(d.num).padStart(2, "0")}
                </span>
                <span className="text-sm text-white/60 transition-colors group-hover:text-white/90">
                  {d.label}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        :root {
          --preview-scale: 0.22;
        }
        @media (min-width: 768px) {
          :root { --preview-scale: 0.24; }
        }
        @media (min-width: 1280px) {
          :root { --preview-scale: 0.26; }
        }
      `}</style>
    </div>
  );
}
