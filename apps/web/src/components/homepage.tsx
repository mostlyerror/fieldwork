"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import type { Tournament } from "@/lib/types";
import type { City } from "@/lib/cities";
import type { User } from "@supabase/supabase-js";
import { subscribeEmail } from "@/app/actions";
import { Header } from "./header";
import { TournamentBrowser } from "./tournament-browser";

type EmailState = "idle" | "submitting" | "success" | "already_subscribed" | "error";

export function Homepage({
  tournaments,
  city,
  user,
  recommendations,
  subscriberCount,
  tournamentCount,
  seoContent,
}: {
  tournaments: Tournament[];
  city?: City;
  user?: User | null;
  recommendations?: React.ReactNode;
  subscriberCount?: number;
  tournamentCount?: number;
  seoContent?: React.ReactNode;
}) {
  const [emailState, setEmailState] = useState<EmailState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

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
    <div className="min-h-screen bg-[#FFFDF7]">
      <Header city={city} user={user} />

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-b from-amber-50/80 via-orange-50/30 to-[#FFFDF7]">
        {/* Playful SVG illustration - overlapping paddle/ball shapes */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {/* Large emerald paddle shape - top right */}
          <svg className="absolute -top-8 -right-12 h-64 w-64 opacity-[0.08]" viewBox="0 0 200 200">
            <ellipse cx="100" cy="80" rx="60" ry="75" fill="#059669" />
            <rect x="90" y="145" width="20" height="50" rx="8" fill="#059669" />
          </svg>
          {/* Small peach ball - top left */}
          <svg className="absolute top-16 left-8 h-20 w-20 opacity-[0.15]" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20" fill="#fdba74" />
            <path d="M15 10 Q25 25 15 40" fill="none" stroke="#fb923c" strokeWidth="1.5" opacity="0.5" />
          </svg>
          {/* Medium emerald ball - bottom left */}
          <svg className="absolute bottom-4 left-1/4 h-16 w-16 opacity-[0.10]" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="18" fill="#10b981" />
          </svg>
          {/* Small peach paddle - left middle */}
          <svg className="absolute top-1/2 -left-6 h-40 w-40 opacity-[0.06] -rotate-45" viewBox="0 0 200 200">
            <ellipse cx="100" cy="80" rx="50" ry="65" fill="#fdba74" />
            <rect x="90" y="135" width="18" height="45" rx="7" fill="#fdba74" />
          </svg>
          {/* Tiny bouncing ball - right middle */}
          <svg className="absolute top-1/3 right-1/4 h-8 w-8 opacity-[0.12]" viewBox="0 0 30 30">
            <circle cx="15" cy="15" r="12" fill="#f97316" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-2xl px-5 pt-16 pb-12 text-center">
          <p className="mb-3 text-sm font-bold uppercase tracking-widest text-emerald-600/70">
            {"\u{1F3D3}"} Your local pickleball hub
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
            Find your next game in{" "}
            <span className="text-emerald-600">{city?.name ?? "Houston"}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-gray-500">
            {tournamentCount && tournamentCount > 0
              ? `${tournamentCount} upcoming tournaments. Browse, filter, and never miss a match.`
              : "Every upcoming tournament, all in one place. Browse, filter, and never miss a match."}
          </p>
        </div>

        {/* Wavy divider */}
        <div className="relative -mb-1">
          <svg className="block w-full" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">
            <path
              d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,30 1440,40 L1440,60 L0,60 Z"
              fill="#FFFDF7"
            />
          </svg>
        </div>
      </div>

      {/* Email subscribe banner */}
      <div className="bg-gradient-to-r from-amber-50/80 via-orange-50/60 to-amber-50/80 border-y border-orange-100/50">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-5 py-6 sm:flex-row sm:justify-between sm:gap-4">
          <div className="text-center sm:text-left">
            <p className="text-sm font-extrabold text-emerald-700 flex items-center gap-1.5 justify-center sm:justify-start">
              <span>{"\u{1F4EC}"}</span> Stay in the loop!
            </p>
            <p className="mt-0.5 text-xs text-emerald-700/60 font-medium">
              New tournaments delivered to your inbox every Monday.
            </p>
            {subscriberCount != null && subscriberCount > 10 && (
              <p className="mt-1 text-xs font-bold text-emerald-600/70">
                Join {subscriberCount}+ Houston players
              </p>
            )}
          </div>

          <div className="flex-shrink-0">
            {emailState === "success" ? (
              <p className="text-sm font-bold text-emerald-600">
                {"✓"} You&apos;re subscribed!
              </p>
            ) : (
              <>
                <form
                  ref={formRef}
                  action={handleEmailSubmit}
                  className="flex items-center gap-2"
                >
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="you@email.com"
                    className="w-44 rounded-full border-2 border-orange-200 bg-white px-4 py-2 text-sm placeholder-gray-400 shadow-sm transition-all focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 sm:w-52"
                  />
                  <button
                    type="submit"
                    disabled={emailState === "submitting"}
                    className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 hover:scale-105 disabled:opacity-50"
                  >
                    {emailState === "submitting" ? "..." : "Subscribe"}
                  </button>
                </form>
                {emailState === "already_subscribed" && (
                  <p className="mt-1.5 text-center text-xs text-amber-600 font-medium">
                    Already subscribed!
                  </p>
                )}
                {emailState === "error" && (
                  <p className="mt-1.5 text-center text-xs text-red-500">
                    {errorMsg}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Personalized recommendations (server-rendered, only for logged-in users with DUPR) */}
      {recommendations && (
        <section className="mx-auto max-w-6xl px-5 pt-8">
          {recommendations}
        </section>
      )}

      {/* Tournament Browser (list + map views with filters) */}
      <section className="mx-auto max-w-6xl px-5 pt-8 pb-16">
        <TournamentBrowser tournaments={tournaments} citySlug={city?.slug} />
      </section>

      {/* Submit CTA */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-orange-200/80 bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 px-8 py-12 sm:px-14">
          {/* Decorative pin-like circles in corners */}
          <div className="pointer-events-none absolute top-4 left-4 h-3 w-3 rounded-full bg-orange-300/40" aria-hidden="true" />
          <div className="pointer-events-none absolute top-4 right-4 h-3 w-3 rounded-full bg-emerald-300/40" aria-hidden="true" />
          <div className="pointer-events-none absolute bottom-4 left-4 h-3 w-3 rounded-full bg-emerald-300/40" aria-hidden="true" />
          <div className="pointer-events-none absolute bottom-4 right-4 h-3 w-3 rounded-full bg-orange-300/40" aria-hidden="true" />

          <div className="relative flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-orange-400">
                {"\u{1F4CC}"} Community board
              </p>
              <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
                Know about a tournament?
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-400">
                Help your fellow players out! Paste a link and our AI fills in
                the details. Takes about 30 seconds.
              </p>
            </div>

            <Link
              href="/submit"
              className="group flex items-center gap-3 rounded-full border-2 border-emerald-200 bg-white py-3 pl-6 pr-3 text-sm font-bold text-gray-900 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md hover:scale-105"
            >
              Submit a tournament
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white transition-transform group-hover:scale-110">
                {"→"}
              </span>
            </Link>
          </div>
        </div>
      </section>

      {seoContent}

      <footer className="bg-gradient-to-b from-green-50 to-emerald-50/50">
        <div className="mx-auto max-w-6xl px-5">
          <div className="py-16">
            <div className="grid grid-cols-1 gap-12 sm:grid-cols-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl">{"\u{1F3D3}"}</span>
                  <span className="text-lg font-extrabold text-emerald-600">
                    PickleRadar
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">
                  Every upcoming {city?.name ?? "Houston"}
                  <br />
                  pickleball tournament,
                  <br />
                  one search away.
                </p>
              </div>

              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-emerald-600/40">
                  Links
                </p>
                <div className="space-y-2">
                  <Link
                    href={city ? `/${city.slug}` : "/"}
                    className="block text-sm text-gray-500 font-medium transition-colors hover:text-emerald-700"
                  >
                    Browse tournaments
                  </Link>
                  <Link
                    href="/submit"
                    className="block text-sm text-gray-500 font-medium transition-colors hover:text-emerald-700"
                  >
                    Submit a tournament
                  </Link>
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-emerald-600/40">
                  Connect
                </p>
                <div className="space-y-2">
                  <a
                    href="mailto:hello@pickleradar.app"
                    className="block text-sm text-gray-500 font-medium transition-colors hover:text-emerald-700"
                  >
                    hello@pickleradar.app
                  </a>
                  <a
                    href="https://instagram.com/pickleradar"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-gray-500 font-medium transition-colors hover:text-emerald-700"
                  >
                    Instagram
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-12 border-t border-emerald-100 pt-6">
              <p className="text-xs text-gray-400">
                Made with {"\u{1F49A}"} for the {city?.name ?? "Houston"} pickleball community
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
