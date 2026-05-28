"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import type { Tournament } from "@/lib/types";
import type { City } from "@/lib/cities";
import type { User } from "@supabase/supabase-js";
import { subscribeEmail } from "@/app/actions";
import { Header } from "./header";
import { TournamentBrowser } from "./tournament-browser";
import { Footer } from "./footer";

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

  const upcomingCount = tournamentCount ?? tournaments.length;
  const duprCount = 260;

  return (
    <div className="min-h-screen bg-background">
      <Header city={city} user={user} />

      {/* Page header */}
      <div className="mx-auto max-w-6xl px-5 pt-8 pb-4">
        <h1 className="relative inline-block text-3xl font-extrabold text-gray-900">
          {city?.name ?? "Houston"} Tournaments
          <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-emerald-700 origin-left animate-underline" />
        </h1>
        <p className="mt-2 text-base text-gray-500">
          {upcomingCount > 0 ? `${upcomingCount} upcoming` : "Upcoming tournaments"}
          {" · "}
          {duprCount} verified DUPR ratings
        </p>

        {/* Inline email subscribe bar */}
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <span aria-hidden="true">📬</span>
            <span>Get weekly updates</span>
          </div>

          <div className="flex-1">
            {emailState === "success" ? (
              <div className="relative inline-flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white animate-pop">
                  ✓
                </span>
                <span className="text-sm font-bold text-emerald-700 animate-fade-up">
                  Boom — you&apos;re in.
                </span>
                {/* Confetti */}
                <span aria-hidden="true" className="pointer-events-none absolute -top-2 left-1 text-base animate-confetti">🎉</span>
                <span aria-hidden="true" className="pointer-events-none absolute -top-3 left-6 text-sm animate-confetti" style={{ animationDelay: "120ms" }}>🏓</span>
                <span aria-hidden="true" className="pointer-events-none absolute -top-2 left-12 text-base animate-confetti" style={{ animationDelay: "200ms" }}>✨</span>
              </div>
            ) : (
              <>
                <form
                  ref={formRef}
                  action={handleEmailSubmit}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    type="text"
                    name="name"
                    placeholder="Your name (optional)"
                    className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm placeholder-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 sm:max-w-[180px]"
                  />
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="you@email.com"
                    className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm placeholder-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 sm:max-w-xs"
                  />
                  <button
                    type="submit"
                    disabled={emailState === "submitting"}
                    className="shrink-0 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {emailState === "submitting" ? "..." : "Subscribe"}
                  </button>
                  {emailState === "already_subscribed" && (
                    <span className="text-xs font-medium text-amber-600">Already subscribed!</span>
                  )}
                  {emailState === "error" && (
                    <span className="text-xs font-medium text-red-500">{errorMsg}</span>
                  )}
                </form>
              </>
            )}
          </div>

          {subscriberCount != null && subscriberCount > 10 && (
            <p className="shrink-0 text-xs text-emerald-600/70 font-medium">
              {subscriberCount}+ players subscribed
            </p>
          )}
        </div>
      </div>

      {/* Personalized recommendations */}
      {recommendations && (
        <section className="mx-auto max-w-6xl px-5 pt-6">
          {recommendations}
        </section>
      )}

      {/* Tournament browser */}
      <section className="mx-auto max-w-6xl px-5 pt-6 pb-16">
        <TournamentBrowser tournaments={tournaments} citySlug={city?.slug} />
      </section>

      {/* Submit CTA — single line */}
      <div className="mx-auto max-w-6xl px-5 pb-10 text-sm text-gray-400">
        Know about a tournament?{" "}
        <Link href="/submit" className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline">
          Submit it here →
        </Link>
      </div>

      {seoContent}

      <Footer citySlug={city?.slug} />
    </div>
  );
}
