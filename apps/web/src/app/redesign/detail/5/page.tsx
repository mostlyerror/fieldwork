"use client";

import Link from "next/link";
import { mockTournament, mockSources, FORMAT_LABELS, SOURCE_NAMES } from "../mock";
import { formatDateRange, formatCurrency } from "@/lib/format";
import DesignSwitcher from "@/components/design-switcher";

// --- DETAIL DESIGN 5: TWO-COLUMN MAGAZINE ---
// Wide layout with two equal columns. Left: all tournament info.
// Right: map + registration. Visual weight balanced across the page.
// Good for desktop, stacks on mobile.

export default function DetailDesign5() {
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
              <span className="block text-xl font-bold text-green-700">PickleUp</span>
              <span className="block text-[11px] text-gray-400">Your Houston pickleball community</span>
            </div>
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center text-sm text-gray-400 hover:text-green-700"
        >
          &larr; Back to tournaments
        </Link>

        {/* Title row */}
        <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-0.5 text-xs font-semibold ${statusStyle[t.registration_status ?? "open"]}`}
              >
                {t.registration_status ?? "open"}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{t.name}</h1>
            <p className="mt-2 text-gray-500">
              {formatDateRange(t.date_start, t.date_end)}
            </p>
          </div>
          {t.entry_fee != null && (
            <div className="text-right">
              <p className="text-sm text-gray-400">Entry Fee</p>
              <p className="text-3xl font-bold text-green-600">
                {formatCurrency(t.entry_fee)}
              </p>
            </div>
          )}
        </div>

        {/* Two columns */}
        <div className="grid gap-10 md:grid-cols-2">
          {/* Left: info */}
          <div className="space-y-8">
            {/* Location */}
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Venue
              </h3>
              <p className="text-lg font-semibold text-gray-800">{t.location_name}</p>
              {t.location_address && (
                <p className="mt-0.5 text-sm text-gray-500">{t.location_address}</p>
              )}
            </section>

            {/* Format */}
            {t.format && (
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Format
                </h3>
                <p className="text-lg font-semibold text-gray-800">
                  {FORMAT_LABELS[t.format] ?? t.format}
                </p>
              </section>
            )}

            {/* Skills */}
            {t.skill_levels && t.skill_levels.length > 0 && (
              <section>
                <h3 className="mb-3 text-sm font-semibold text-gray-400">
                  Skill Levels
                </h3>
                <div className="flex flex-wrap gap-2">
                  {t.skill_levels.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 ring-1 ring-green-200"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Description */}
            {t.description && (
              <section>
                <h3 className="mb-3 text-sm font-semibold text-gray-400">
                  About
                </h3>
                <p className="whitespace-pre-line leading-relaxed text-gray-600">
                  {t.description}
                </p>
              </section>
            )}
          </div>

          {/* Right: map + register */}
          <div className="space-y-6">
            {/* Map */}
            <div className="overflow-hidden rounded-2xl bg-green-50 shadow-sm ring-1 ring-gray-100">
              <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">
                Map placeholder
              </div>
              <div className="bg-white p-4">
                <p className="text-sm font-medium text-gray-700">{t.location_name}</p>
                <p className="text-xs text-gray-400">{t.location_address}</p>
              </div>
            </div>

            {/* Registration */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <h3 className="mb-4 text-sm font-semibold text-gray-400">
                Registration
              </h3>
              <div className="space-y-3">
                {sources
                  .filter((s) => s.registration_url)
                  .map((source) => (
                    <a
                      key={source.id}
                      href={source.registration_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
                    >
                      Register on{" "}
                      {SOURCE_NAMES[source.source_platform] ?? source.source_platform}
                      <span aria-hidden>{"\u2197"}</span>
                    </a>
                  ))}
              </div>
              <p className="mt-3 text-center text-xs text-gray-400">
                Available on {sources.filter((s) => s.registration_url).length}{" "}
                platform{sources.filter((s) => s.registration_url).length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Date card */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 flex-col items-center justify-center rounded-xl bg-amber-50">
                  <span className="text-[10px] font-bold uppercase text-amber-600">
                    {new Date(t.date_start + "T00:00:00")
                      .toLocaleDateString("en-US", { month: "short" })
                      .toUpperCase()}
                  </span>
                  <span className="text-xl font-bold text-amber-700">
                    {new Date(t.date_start + "T00:00:00").getDate()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">
                    {formatDateRange(t.date_start, t.date_end)}
                  </p>
                  <p className="text-sm text-gray-400">
                    {new Date(t.date_start + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "long",
                    })}
                    {t.date_end && t.date_end !== t.date_start && (
                      <>
                        {" – "}
                        {new Date(t.date_end + "T00:00:00").toLocaleDateString("en-US", {
                          weekday: "long",
                        })}
                      </>
                    )}
                  </p>
                </div>
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
