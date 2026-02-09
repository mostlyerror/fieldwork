"use client";

import Link from "next/link";
import { mockTournament, mockSources, FORMAT_LABELS, SOURCE_NAMES } from "../mock";
import { formatDateRange, formatCurrency } from "@/lib/format";
import DesignSwitcher from "@/components/design-switcher";

// --- DETAIL DESIGN 4: CLEAN STACKED ---
// Simple, single-column layout. No cards or boxes — just clean typography
// with subtle dividers. Information flows naturally top to bottom.
// Feels like reading a well-formatted event page. Narrow max-width for
// comfortable reading. Registration buttons float at bottom.

export default function DetailDesign4() {
  const t = mockTournament;
  const sources = mockSources;

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-3xl">{"\u{1F3D3}"}</span>
            <div>
              <span className="block text-xl font-bold text-green-700">PickleRadar</span>
              <span className="block text-[11px] text-gray-400">Your Houston pickleball community</span>
            </div>
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-2xl px-5 py-10">
        <Link
          href="/"
          className="mb-8 inline-flex items-center text-sm text-gray-400 hover:text-green-700"
        >
          &larr; Back to tournaments
        </Link>

        {/* Header */}
        <div className="mb-10">
          <div className="mb-3 flex items-center gap-3">
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
              {t.registration_status ?? "open"}
            </span>
            {t.entry_fee != null && (
              <span className="text-sm font-bold text-gray-500">
                {formatCurrency(t.entry_fee)}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">
            {t.name}
          </h1>
        </div>

        {/* Key info — inline */}
        <div className="mb-10 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-sm text-gray-400">When</p>
            <p className="font-semibold text-gray-800">
              {formatDateRange(t.date_start, t.date_end)}
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm text-gray-400">Where</p>
            <p className="font-semibold text-gray-800">{t.location_name}</p>
            {t.location_address && (
              <p className="text-sm text-gray-500">{t.location_address}</p>
            )}
          </div>
          {t.format && (
            <div>
              <p className="mb-1 text-sm text-gray-400">Format</p>
              <p className="font-semibold text-gray-800">
                {FORMAT_LABELS[t.format] ?? t.format}
              </p>
            </div>
          )}
          {t.entry_fee != null && (
            <div>
              <p className="mb-1 text-sm text-gray-400">Entry Fee</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(t.entry_fee)}
              </p>
            </div>
          )}
        </div>

        <div className="mb-10 h-px bg-gray-100" />

        {/* Skill levels */}
        {t.skill_levels && t.skill_levels.length > 0 && (
          <>
            <div className="mb-10">
              <p className="mb-3 text-sm text-gray-400">Skill Levels</p>
              <div className="flex flex-wrap gap-2">
                {t.skill_levels.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-200"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="mb-10 h-px bg-gray-100" />
          </>
        )}

        {/* Description */}
        {t.description && (
          <>
            <div className="mb-10">
              <p className="mb-3 text-sm text-gray-400">About</p>
              <div className="whitespace-pre-line text-[15px] leading-relaxed text-gray-600">
                {t.description}
              </div>
            </div>
            <div className="mb-10 h-px bg-gray-100" />
          </>
        )}

        {/* Map */}
        <div className="mb-10 overflow-hidden rounded-2xl bg-green-50">
          <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">
            Map placeholder
          </div>
        </div>

        <div className="mb-10 h-px bg-gray-100" />

        {/* Registration */}
        <div className="mb-10">
          <p className="mb-4 text-sm text-gray-400">Register</p>
          <div className="flex flex-wrap gap-3">
            {sources
              .filter((s) => s.registration_url)
              .map((source) => (
                <a
                  key={source.id}
                  href={source.registration_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
                >
                  Register on{" "}
                  {SOURCE_NAMES[source.source_platform] ?? source.source_platform}
                  <span aria-hidden>{"\u2197"}</span>
                </a>
              ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center">
        <p className="text-sm text-gray-400">
          Made with {"\u{1F49A}"} for the Houston pickleball community
        </p>
      </footer>

      <DesignSwitcher />
    </div>
  );
}
