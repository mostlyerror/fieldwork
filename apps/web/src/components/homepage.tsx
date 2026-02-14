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
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br from-green-50/80 via-white to-emerald-50/50 px-8 py-12 sm:px-14">
          {/* Subtle decorative grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, #16a34a 0.5px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-green-600/60">
                Community-powered
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                Missing a tournament?
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-400">
                Paste a link and our AI fills in the details. Takes about 30
                seconds.
              </p>
            </div>

            <Link
              href="/submit"
              className="group flex items-center gap-3 rounded-full border border-gray-200 bg-white py-3 pl-6 pr-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:border-green-200 hover:shadow-md"
            >
              Submit a tournament
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-white transition-transform group-hover:scale-105">
                {"\u2192"}
              </span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5">
        <div className="border-t border-gray-100" />
        <div className="py-16">
          <div className="grid grid-cols-1 gap-12 sm:grid-cols-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{"\u{1F3D3}"}</span>
                <span className="text-base font-bold text-green-700">
                  PickleRadar
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">
                Every upcoming Houston
                <br />
                pickleball tournament,
                <br />
                one search away.
              </p>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-300">
                Links
              </p>
              <div className="space-y-2">
                <Link
                  href="/"
                  className="block text-sm text-gray-500 transition-colors hover:text-gray-800"
                >
                  Browse tournaments
                </Link>
                <Link
                  href="/submit"
                  className="block text-sm text-gray-500 transition-colors hover:text-gray-800"
                >
                  Submit a tournament
                </Link>
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-300">
                Connect
              </p>
              <div className="space-y-2">
                <a
                  href="mailto:hello@pickleradar.app"
                  className="block text-sm text-gray-500 transition-colors hover:text-gray-800"
                >
                  hello@pickleradar.app
                </a>
                <a
                  href="https://instagram.com/pickleradar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-gray-500 transition-colors hover:text-gray-800"
                >
                  Instagram
                </a>
              </div>
            </div>
          </div>

          <div className="mt-12 border-t border-gray-50 pt-6">
            <p className="text-xs text-gray-300">
              Made with {"\u{1F49A}"} for the Houston pickleball community
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
