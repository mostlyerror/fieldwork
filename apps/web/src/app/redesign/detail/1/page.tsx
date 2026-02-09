"use client";

import Link from "next/link";
import { mockTournament, mockSources, FORMAT_LABELS, SOURCE_NAMES } from "../mock";
import { formatDateRange, formatCurrency } from "@/lib/format";
import DesignSwitcher from "@/components/design-switcher";

// --- DETAIL DESIGN 1: CARD SECTIONS ---
// Each info group (dates, location, format, skills, etc.) lives in its own
// rounded card. Registration buttons are prominent. Map in sidebar.
// Warm, friendly, consistent with homepage Design 2.

export default function DetailDesign1() {
  const t = mockTournament;
  const sources = mockSources;

  const statusStyle: Record<string, string> = {
    open: "bg-green-50 text-green-700 ring-green-200",
    filling: "bg-amber-50 text-amber-700 ring-amber-200",
    full: "bg-red-50 text-red-700 ring-red-200",
    closed: "bg-gray-50 text-gray-500 ring-gray-200",
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/50 via-white to-amber-50/30">
      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-3xl">{"\u{1F3D3}"}</span>
            <div>
              <span className="block text-xl font-bold text-green-700">PickleUp</span>
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

        {/* Title + status */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-800">{t.name}</h1>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusStyle[t.registration_status ?? "open"]}`}
            >
              {t.registration_status ?? "open"}
            </span>
          </div>
          <p className="mt-2 text-lg text-gray-500">
            {formatDateRange(t.date_start, t.date_end)}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column — info cards */}
          <div className="space-y-4 lg:col-span-2">
            {/* Location card */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Location
              </h3>
              <p className="text-lg font-semibold text-gray-800">
                {t.location_name}
              </p>
              {t.location_address && (
                <p className="mt-1 text-sm text-gray-500">{t.location_address}</p>
              )}
            </div>

            {/* Details card */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="grid gap-4 sm:grid-cols-2">
                {t.format && (
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Format
                    </h3>
                    <p className="font-semibold text-gray-800">
                      {FORMAT_LABELS[t.format] ?? t.format}
                    </p>
                  </div>
                )}
                {t.entry_fee != null && (
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Entry Fee
                    </h3>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(t.entry_fee)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Skill levels card */}
            {t.skill_levels && t.skill_levels.length > 0 && (
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Skill Levels
                </h3>
                <div className="flex flex-wrap gap-2">
                  {t.skill_levels.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description card */}
            {t.description && (
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  About this tournament
                </h3>
                <p className="whitespace-pre-line leading-relaxed text-gray-600">
                  {t.description}
                </p>
              </div>
            )}

            {/* Registration card */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Register
              </h3>
              <div className="flex flex-wrap gap-3">
                {sources
                  .filter((s) => s.registration_url)
                  .map((source) => (
                    <a
                      key={source.id}
                      href={source.registration_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
                    >
                      Register on{" "}
                      {SOURCE_NAMES[source.source_platform] ?? source.source_platform}
                      <span aria-hidden>{"\u2197"}</span>
                    </a>
                  ))}
              </div>
            </div>
          </div>

          {/* Right column — map */}
          <div>
            <div className="sticky top-6 overflow-hidden rounded-2xl bg-gray-200 shadow-sm ring-1 ring-gray-100">
              <div className="flex h-[300px] items-center justify-center bg-green-50 text-sm text-gray-400">
                Map placeholder
              </div>
              <div className="bg-white p-4 text-center">
                <p className="text-sm font-medium text-gray-700">{t.location_name}</p>
                <p className="mt-0.5 text-xs text-gray-400">{t.location_address}</p>
              </div>
            </div>
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
