"use client";

import Link from "next/link";
import { mockTournament, mockSources, FORMAT_LABELS, SOURCE_NAMES } from "../mock";
import { formatDateRange, formatCurrency } from "@/lib/format";
import DesignSwitcher from "@/components/design-switcher";

// --- DETAIL DESIGN 3: COMPACT SIDEBAR ---
// Key facts in a fixed sidebar on the left (date, fee, status, skills,
// registration buttons). Description and map fill the main area on right.
// Efficient use of space, all critical info visible without scrolling.

export default function DetailDesign3() {
  const t = mockTournament;
  const sources = mockSources;

  const statusStyle: Record<string, string> = {
    open: "bg-green-50 text-green-700",
    filling: "bg-amber-50 text-amber-700",
    full: "bg-red-50 text-red-700",
    closed: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/50 via-white to-amber-50/30">
      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-3xl">{"\u{1F3D3}"}</span>
            <div>
              <span className="block text-xl font-bold text-green-700">PickleRadar</span>
              <span className="block text-[11px] text-gray-400">Your Houston pickleball community</span>
            </div>
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-5 py-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center text-sm text-gray-400 hover:text-green-700"
        >
          &larr; Back to tournaments
        </Link>

        <h1 className="mb-8 text-3xl font-bold text-gray-800">{t.name}</h1>

        <div className="grid gap-8 md:grid-cols-[280px_1fr]">
          {/* Left sidebar — key facts */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              {/* Status */}
              <div className="mb-4 flex items-center justify-between">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[t.registration_status ?? "open"]}`}
                >
                  {t.registration_status ?? "open"}
                </span>
              </div>

              {/* Key facts */}
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Date
                  </p>
                  <p className="text-sm font-semibold text-gray-800">
                    {formatDateRange(t.date_start, t.date_end)}
                  </p>
                </div>

                {t.entry_fee != null && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Entry Fee
                    </p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(t.entry_fee)}
                    </p>
                  </div>
                )}

                {t.format && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Format
                    </p>
                    <p className="text-sm font-semibold text-gray-800">
                      {FORMAT_LABELS[t.format] ?? t.format}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Venue
                  </p>
                  <p className="text-sm font-semibold text-gray-800">
                    {t.location_name}
                  </p>
                  {t.location_address && (
                    <p className="text-xs text-gray-400">{t.location_address}</p>
                  )}
                </div>
              </div>

              {/* Skills */}
              {t.skill_levels && t.skill_levels.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Skill Levels
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {t.skill_levels.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Register buttons */}
              <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                {sources
                  .filter((s) => s.registration_url)
                  .map((source) => (
                    <a
                      key={source.id}
                      href={source.registration_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
                    >
                      {SOURCE_NAMES[source.source_platform] ?? source.source_platform}
                      <span aria-hidden>{"\u2197"}</span>
                    </a>
                  ))}
              </div>
            </div>
          </div>

          {/* Right — description + map */}
          <div className="space-y-6">
            {/* Map */}
            <div className="overflow-hidden rounded-2xl bg-green-50 shadow-sm ring-1 ring-gray-100">
              <div className="flex h-[250px] items-center justify-center text-sm text-gray-400">
                Map placeholder
              </div>
            </div>

            {/* Description */}
            {t.description && (
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  About this tournament
                </h3>
                <p className="whitespace-pre-line leading-relaxed text-gray-600">
                  {t.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-100 bg-white/60 py-8 text-center">
        <p className="text-sm text-gray-400">
          Made with {"\u{1F49A}"} for the Houston pickleball community
        </p>
      </footer>

      <DesignSwitcher />
    </div>
  );
}
