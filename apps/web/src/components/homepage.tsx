"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import type { Tournament } from "@/lib/types";
import { subscribeEmail } from "@/app/actions";
import { Header } from "./header";
import { TournamentBrowser } from "./tournament-browser";

type EmailState = "idle" | "submitting" | "success" | "already_subscribed" | "error";

export function Homepage({ tournaments }: { tournaments: Tournament[] }) {
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
    <div className="min-h-screen bg-gradient-to-b from-green-50/50 via-white to-amber-50/30">
      <Header />

      {/* Hero */}
      <div className="mx-auto max-w-2xl px-5 pt-12 pb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl">
          Houston Pickleball Tournaments
        </h1>
        <p className="mt-2 text-gray-500">
          Every upcoming event, one search away.
        </p>
      </div>

      {/* Email subscribe banner */}
      <div className="border-y border-green-100 bg-green-50/70">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-5 py-5 sm:flex-row sm:justify-between sm:gap-4">
          <div className="text-center sm:text-left">
            <p className="text-sm font-semibold text-green-900">
              Get the weekly digest
            </p>
            <p className="mt-0.5 text-xs text-green-700/70">
              New tournaments in your inbox every Monday.
            </p>
          </div>

          <div className="flex-shrink-0">
            {emailState === "success" ? (
              <p className="text-sm font-medium text-green-700">
                {"\u2713"} You&apos;re subscribed!
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
                    className="w-44 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm placeholder-gray-400 shadow-sm transition focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-200 sm:w-52"
                  />
                  <button
                    type="submit"
                    disabled={emailState === "submitting"}
                    className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-800 disabled:opacity-50"
                  >
                    {emailState === "submitting" ? "..." : "Subscribe"}
                  </button>
                </form>
                {emailState === "already_subscribed" && (
                  <p className="mt-1.5 text-center text-xs text-amber-600">
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

      {/* Tournament Browser (list + map views with filters) */}
      <section className="mx-auto max-w-6xl px-5 pt-8 pb-16">
        <TournamentBrowser tournaments={tournaments} />
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
