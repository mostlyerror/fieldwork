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

  const upcomingCount = tournamentCount ?? tournaments.length;
  const duprCount = 260;

  return (
    <div className="min-h-screen bg-background">
      <Header city={city} user={user} />

      {/* Page header */}
      <div className="mx-auto max-w-6xl px-5 pt-8 pb-4">
        <h1 className="text-3xl font-extrabold text-gray-900">
          {city?.name ?? "Houston"} Tournaments
        </h1>
        <p className="mt-1 text-base text-gray-500">
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
              <p className="text-sm font-semibold text-emerald-700">
                ✓ You&apos;re subscribed!
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
                    className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm placeholder-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 sm:max-w-xs"
                  />
                  <button
                    type="submit"
                    disabled={emailState === "submitting"}
                    className="shrink-0 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {emailState === "submitting" ? "..." : "Subscribe"}
                  </button>
                </form>
                {emailState === "already_subscribed" && (
                  <p className="mt-1 text-xs text-amber-600">Already subscribed!</p>
                )}
                {emailState === "error" && (
                  <p className="mt-1 text-xs text-red-500">{errorMsg}</p>
                )}
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

      <footer className="border-t border-gray-100 bg-background">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-sm text-gray-500">
              Made with 💚 for the {city?.name ?? "Houston"} pickleball community
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
              <Link
                href={city ? `/${city.slug}` : "/"}
                className="transition-colors hover:text-emerald-700"
              >
                Browse tournaments
              </Link>
              <Link
                href="/submit"
                className="transition-colors hover:text-emerald-700"
              >
                Submit a tournament
              </Link>
              <a
                href="mailto:hello@pickleradar.app"
                className="transition-colors hover:text-emerald-700"
              >
                hello@pickleradar.app
              </a>
              <a
                href="https://instagram.com/pickleradar"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-emerald-700"
              >
                Instagram
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
