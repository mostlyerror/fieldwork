"use client";

import Link from "next/link";
import { mockTournament, mockSources, FORMAT_LABELS, SOURCE_NAMES } from "../mock";
import { formatDateRange, formatCurrency } from "@/lib/format";
import DesignSwitcher from "@/components/design-switcher";

// --- DETAIL DESIGN 2: HERO BANNER ---
// Full-width colored hero with tournament name, date, status, and fee.
// Body below has clean stacked sections. Registration CTA is prominent
// both in the hero and at the bottom.

export default function DetailDesign2() {
  const t = mockTournament;
  const sources = mockSources;

  return (
    <div className="min-h-screen bg-gray-50">
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

      {/* Hero */}
      <div className="bg-gradient-to-br from-green-600 to-emerald-700">
        <div className="mx-auto max-w-4xl px-5 py-12">
          <Link
            href="/"
            className="mb-6 inline-flex items-center text-sm text-green-200 hover:text-white"
          >
            &larr; Back to tournaments
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold text-white backdrop-blur">
                  {t.registration_status ?? "open"}
                </span>
              </div>
              <h1 className="text-3xl font-bold text-white md:text-4xl">
                {t.name}
              </h1>
              <p className="mt-2 text-lg text-green-100">
                {formatDateRange(t.date_start, t.date_end)}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-green-200">
                <span>{"\u{1F4CD}"}</span> {t.location_name}
              </p>
            </div>

            <div className="text-right">
              {t.entry_fee != null && (
                <p className="text-3xl font-bold text-white">
                  {formatCurrency(t.entry_fee)}
                </p>
              )}
              {sources.filter((s) => s.registration_url).length > 0 && (
                <a
                  href={sources[0].registration_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-green-700 shadow-sm transition hover:bg-green-50"
                >
                  Register Now {"\u2197"}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <main className="mx-auto max-w-4xl px-5 py-10">
        <div className="space-y-8">
          {/* Location + Map */}
          <section className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Venue
              </h3>
              <p className="text-lg font-semibold text-gray-800">
                {t.location_name}
              </p>
              {t.location_address && (
                <p className="mt-1 text-sm text-gray-500">{t.location_address}</p>
              )}
            </div>
            <div className="h-[200px] overflow-hidden rounded-2xl bg-green-50">
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                Map placeholder
              </div>
            </div>
          </section>

          <hr className="border-gray-200" />

          {/* Details */}
          <section>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Tournament Details
            </h3>
            <div className="grid gap-6 sm:grid-cols-3">
              {t.format && (
                <div>
                  <p className="text-sm text-gray-400">Format</p>
                  <p className="mt-0.5 font-semibold text-gray-800">
                    {FORMAT_LABELS[t.format] ?? t.format}
                  </p>
                </div>
              )}
              {t.entry_fee != null && (
                <div>
                  <p className="text-sm text-gray-400">Entry Fee</p>
                  <p className="mt-0.5 font-semibold text-gray-800">
                    {formatCurrency(t.entry_fee)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-400">Dates</p>
                <p className="mt-0.5 font-semibold text-gray-800">
                  {formatDateRange(t.date_start, t.date_end)}
                </p>
              </div>
            </div>
          </section>

          <hr className="border-gray-200" />

          {/* Skills */}
          {t.skill_levels && t.skill_levels.length > 0 && (
            <>
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Skill Levels
                </h3>
                <div className="flex flex-wrap gap-2">
                  {t.skill_levels.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700 ring-1 ring-green-200"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </section>
              <hr className="border-gray-200" />
            </>
          )}

          {/* Description */}
          {t.description && (
            <>
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  About
                </h3>
                <p className="whitespace-pre-line leading-relaxed text-gray-600">
                  {t.description}
                </p>
              </section>
              <hr className="border-gray-200" />
            </>
          )}

          {/* Registration */}
          <section>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Registration
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
                    className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
                  >
                    Register on{" "}
                    {SOURCE_NAMES[source.source_platform] ?? source.source_platform}
                    <span aria-hidden>{"\u2197"}</span>
                  </a>
                ))}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white/60 py-8 text-center">
        <p className="text-sm text-gray-400">
          Made with {"\u{1F49A}"} for the Houston pickleball community
        </p>
      </footer>

      <DesignSwitcher />
    </div>
  );
}
