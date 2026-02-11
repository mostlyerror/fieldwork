"use client";

import Link from "next/link";
import { useState, useMemo, useRef } from "react";
import type { Tournament } from "@/lib/types";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { useDebounce } from "@/hooks/use-debounce";
import { subscribeEmail } from "@/app/actions";
import { Header } from "./header";

type EmailState = "idle" | "submitting" | "success" | "already_subscribed" | "error";

function isToday(dateStr: string) {
  const now = new Date();
  const d = new Date(dateStr);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const statusEmoji: Record<string, string> = {
    open: "\u{1F7E2}",
    filling: "\u{1F7E1}",
    full: "\u{1F534}",
    closed: "\u26AB",
  };

  const justAdded = isToday(tournament.created_at);

  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className="group block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:ring-green-200"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            {formatDateRange(tournament.date_start, tournament.date_end)}
          </span>
          {justAdded && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
              Just added
            </span>
          )}
        </div>
        <span title={tournament.registration_status ?? "open"}>
          {statusEmoji[tournament.registration_status ?? "open"] ?? "\u{1F7E2}"}
        </span>
      </div>

      <h3 className="mb-1 text-lg font-bold text-gray-800 group-hover:text-green-700">
        {tournament.name}
      </h3>

      <p className="mb-3 flex items-center gap-1.5 text-sm text-gray-500">
        <span>{"\u{1F4CD}"}</span> {tournament.location_name}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {tournament.skill_levels?.slice(0, 4).map((s) => (
            <span
              key={s}
              className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700"
            >
              {s}
            </span>
          ))}
          {(tournament.skill_levels?.length ?? 0) > 4 && (
            <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] text-gray-400">
              +{(tournament.skill_levels?.length ?? 0) - 4}
            </span>
          )}
        </div>
        {tournament.entry_fee != null && (
          <span className="text-sm font-bold text-green-600">
            {formatCurrency(tournament.entry_fee)}
          </span>
        )}
      </div>
    </Link>
  );
}

export function Homepage({ tournaments }: { tournaments: Tournament[] }) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [emailState, setEmailState] = useState<EmailState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const filtered = useMemo(() => {
    let result = tournaments;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.location_name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tournaments, debouncedSearch]);

  async function handleEmailSubmit(formData: FormData) {
    setEmailState("submitting");
    setErrorMsg("");
    const result = await subscribeEmail(formData);
    switch (result.status) {
      case "success":
        setEmailState("success");
        formRef.current?.reset();
        break;
      case "already_subscribed":
        setEmailState("already_subscribed");
        break;
      case "error":
        setEmailState("error");
        setErrorMsg(result.message);
        break;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/50 via-white to-amber-50/30">
      <Header />

      {/* Hero */}
      <div className="mx-auto max-w-2xl px-5 pt-12 pb-10 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl">
          Houston Pickleball Tournaments
        </h1>
        <p className="mt-2 text-gray-500">
          Every upcoming event, one search away.
        </p>

        {/* Search */}
        <div className="relative mt-6">
          <svg className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tournament name or venue..."
            className="w-full rounded-2xl border border-gray-200 bg-white py-3.5 pl-12 pr-4 text-base shadow-md placeholder-gray-300 transition focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
          />
        </div>

        {/* Email capture — inline and secondary */}
        <div className="mt-5">
          {emailState === "success" ? (
            <p className="text-sm text-green-600">
              {"\u2713"} You&apos;re subscribed! Weekly digest every Monday.
            </p>
          ) : (
            <>
              <form ref={formRef} action={handleEmailSubmit} className="flex items-center justify-center gap-2">
                <span className="hidden text-sm text-gray-400 sm:inline">
                  Or get a weekly digest
                </span>
                <span className="text-sm text-gray-400 sm:hidden">
                  Weekly digest
                </span>
                <span className="text-gray-200">{"/"}</span>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="you@email.com"
                  className="w-36 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm placeholder-gray-300 transition focus:border-green-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-green-100 sm:w-44"
                />
                <button
                  type="submit"
                  disabled={emailState === "submitting"}
                  className="rounded-lg bg-green-600 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  {emailState === "submitting" ? "..." : "Subscribe"}
                </button>
              </form>
              {emailState === "already_subscribed" && (
                <p className="mt-1.5 text-xs text-amber-600">Already subscribed!</p>
              )}
              {emailState === "error" && (
                <p className="mt-1.5 text-xs text-red-500">{errorMsg}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Cards */}
      <section className="mx-auto max-w-6xl px-5 pb-16">
        <p className="mb-4 text-center text-sm text-gray-400">
          {filtered.length} tournament{filtered.length !== 1 ? "s" : ""} found
        </p>
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white p-16 text-center shadow-sm">
            <p className="text-4xl">{"\u{1F3D3}"}</p>
            <p className="mt-4 text-lg font-bold text-gray-300">
              {debouncedSearch
                ? "Can\u2019t find what you\u2019re looking for?"
                : "No matches right now"}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Try a different search or check back soon!
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Know about an upcoming tournament?{" "}
              <Link
                href="/submit"
                className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3.5 py-1.5 font-semibold text-white transition-colors hover:bg-green-700"
              >
                Submit it
              </Link>
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        )}
      </section>

      {/* Submit CTA */}
      <div className="mx-auto max-w-6xl px-5 pb-12 text-center">
        <p className="text-sm text-gray-400">
          Know about a tournament we&apos;re missing?{" "}
          <Link
            href="/submit"
            className="font-medium text-green-600 hover:text-green-700"
          >
            Submit it here
          </Link>
        </p>
      </div>

      <footer className="border-t border-gray-100 bg-white/60 py-8 text-center">
        <p className="text-sm text-gray-400">
          Made with {"\u{1F49A}"} for the Houston pickleball community
        </p>
        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-gray-400">
          <a href="mailto:hello@pickleradar.app" className="hover:text-gray-600 transition-colors">Feedback</a>
          <span className="text-gray-200">{"/"}</span>
          <a href="https://instagram.com/pickleradar" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">Instagram</a>
        </div>
      </footer>
    </div>
  );
}
