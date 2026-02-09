"use client";

import Link from "next/link";
import DesignSwitcher from "@/components/design-switcher";

const designs = [
  { num: 1, href: "/redesign/1", label: "Bold Editorial" },
  { num: 2, href: "/redesign/2", label: "Warm & Friendly" },
  { num: 3, href: "/redesign/3", label: "Data-Driven" },
  { num: 4, href: "/redesign/4", label: "Minimal & Premium" },
  { num: 5, href: "/redesign/5", label: "Athletic" },
  { num: 6, href: "/redesign/6", label: "Minimal Timeline" },
  { num: 7, href: "/redesign/7", label: "Refined Athletic" },
  { num: 8, href: "/redesign/8", label: "Info-Dense Cards" },
  { num: 9, href: "/redesign/9", label: "Compact Rows" },
  { num: 10, href: "/redesign/10", label: "Split Panel" },
];

export default function RedesignIndex() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-10">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          Design Variations
        </h1>
        <p className="mb-8 text-sm text-gray-400">
          Click a preview to view the full design.
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {designs.map((d) => (
            <Link key={d.num} href={d.href} className="group block">
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-200 group-hover:border-gray-300 group-hover:shadow-md">
                <iframe
                  src={d.href}
                  className="pointer-events-none origin-top-left"
                  style={{
                    width: "1440px",
                    height: "900px",
                    transform: "scale(var(--preview-scale, 0.24))",
                  }}
                  tabIndex={-1}
                  loading="lazy"
                />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-xs font-mono text-gray-300 tabular-nums">
                  {String(d.num).padStart(2, "0")}
                </span>
                <span className="text-sm text-gray-500 transition-colors group-hover:text-gray-900">
                  {d.label}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <DesignSwitcher />

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
