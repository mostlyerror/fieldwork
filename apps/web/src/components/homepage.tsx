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

        {/* Email capture */}
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

      {/* Tournament Browser (list + map views with filters) */}
      <section className="mx-auto max-w-6xl px-5 pb-16">
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
