"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { VenueSearch, type VenueSelection } from "@/components/venue-search";
import { SKILL_LEVELS } from "@/lib/constants";
import {
  extractTournamentFromUrl,
  type ExtractedTournament,
} from "./actions";

type FormState = "idle" | "submitting" | "success" | "error";
type Step = 1 | "extracting" | 2;

export default function SubmitTournamentPage() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [step, setStep] = useState<Step>(1);
  const [sourceUrl, setSourceUrl] = useState("");
  const [extracted, setExtracted] = useState<ExtractedTournament | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const autoExtractRan = useRef(false);

  // Auto-advance if ?url= query param is present (e.g. from Chrome extension)
  useEffect(() => {
    const urlParam = searchParams.get("url");
    if (urlParam && !autoExtractRan.current) {
      autoExtractRan.current = true;
      startExtraction(urlParam);
    }
  }, [searchParams]);

  async function startExtraction(url: string) {
    setSourceUrl(url);
    setStep("extracting");

    try {
      const result = await extractTournamentFromUrl(url);
      setExtracted(result.data);
    } catch {
      setExtracted(null);
    }

    setStep(2);
  }

  async function handleStep1(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const url = (fd.get("sourceUrl") as string).trim();
    if (!url) return;
    await startExtraction(url);
  }

  function resetForm() {
    setState("idle");
    setErrorMsg("");
    setStep(1);
    setSourceUrl("");
    setExtracted(null);
    setLatitude(null);
    setLongitude(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setErrorMsg("");

    const fd = new FormData(e.currentTarget);

    // Honeypot check on client side too (bot might fill it)
    if (fd.get("website")) {
      setState("success");
      return;
    }

    const skillLevels = fd.getAll("skillLevels") as string[];

    const body = {
      sourceUrl,
      name: fd.get("name") as string,
      dateStart: fd.get("dateStart") as string,
      dateEnd: (fd.get("dateEnd") as string) || undefined,
      locationName: fd.get("locationName") as string,
      locationAddress: (fd.get("locationAddress") as string) || undefined,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      skillLevels: skillLevels.length > 0 ? skillLevels : undefined,
      format: (fd.get("format") as string) || undefined,
      entryFee: fd.get("entryFee")
        ? Number(fd.get("entryFee"))
        : undefined,
      registrationUrl:
        (fd.get("registrationUrl") as string)?.trim() || undefined,
      description: (fd.get("description") as string) || undefined,
    };

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-tournament`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Submission failed (${res.status})`);
      }

      setState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50/50 via-white to-amber-50/30">
        <Header />
        <main className="mx-auto max-w-3xl px-5 py-16 text-center">
          <div className="text-5xl mb-4">{"\u2705"}</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Thanks for submitting!
          </h1>
          <p className="text-gray-500 mb-8">
            Your tournament will appear on PickleRadar after review.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={resetForm}
              className="rounded-xl border border-green-200 px-6 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-50"
            >
              Submit another
            </button>
            <Link
              href="/"
              className="inline-block rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              Back to tournaments
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/50 via-white to-amber-50/30">
      <Header />

      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center text-sm text-gray-400 hover:text-green-700"
        >
          &larr; Back to tournaments
        </Link>

        {step === 1 && (
          <div>
            <h1 className="mb-2 text-2xl font-bold text-gray-800">
              Spotted a tournament?
            </h1>
            <p className="mb-8 text-gray-500">
              Paste the link and we&apos;ll take it from there.
            </p>

            <form onSubmit={handleStep1} className="space-y-4">
              <div>
                <label
                  htmlFor="sourceUrl"
                  className="mb-1 block text-sm font-semibold text-gray-700"
                >
                  Source link
                </label>
                <input
                  id="sourceUrl"
                  name="sourceUrl"
                  type="url"
                  required
                  autoFocus
                  defaultValue={sourceUrl}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Instagram post, registration page, Facebook event..."
                />
                <p className="mt-1.5 text-xs text-gray-400">
                  Any link where you found the tournament — we&apos;ll figure
                  out the rest.
                </p>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                Next
              </button>
            </form>
          </div>
        )}

        {step === "extracting" && (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-green-200 border-t-green-600" />
            <p className="text-sm font-medium text-gray-600">
              Analyzing page...
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Extracting tournament details from the link
            </p>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="mb-2 text-2xl font-bold text-gray-800">
              {extracted ? "Review what we found" : "Fill in what you know"}
            </h1>
            <p className="mb-6 text-sm text-gray-500">
              {extracted
                ? "We pre-filled what we could. Fix anything that looks off."
                : "It\u2019s okay if you don\u2019t know everything \u2014 we\u2019ll fill in the gaps."}
            </p>

            {/* Source link chip */}
            <div className="mb-6 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-sm text-green-700">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                <span className="max-w-[240px] truncate">{sourceUrl}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setExtracted(null);
                  setStep(1);
                  setLatitude(null);
                  setLongitude(null);
                }}
                className="text-xs text-gray-400 hover:text-green-700"
              >
                Edit
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Honeypot — hidden from real users */}
              <div
                style={{ position: "absolute", left: "-9999px" }}
                aria-hidden
              >
                <label htmlFor="website">Website</label>
                <input
                  type="text"
                  id="website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Name */}
              <div>
                <label
                  htmlFor="name"
                  className="mb-1 block text-sm font-semibold text-gray-700"
                >
                  Tournament Name *
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  autoFocus
                  defaultValue={extracted?.name ?? ""}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="e.g. Houston Summer Smash 2026"
                />
              </div>

              {/* Dates */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="dateStart"
                    className="mb-1 block text-sm font-semibold text-gray-700"
                  >
                    Start Date *
                  </label>
                  <input
                    id="dateStart"
                    name="dateStart"
                    type="date"
                    required
                    defaultValue={extracted?.dateStart ?? ""}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="dateEnd"
                    className="mb-1 block text-sm font-semibold text-gray-700"
                  >
                    End Date
                  </label>
                  <input
                    id="dateEnd"
                    name="dateEnd"
                    type="date"
                    defaultValue={extracted?.dateEnd ?? ""}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Venue */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Venue *
                </label>
                <VenueSearch
                  defaultName={extracted?.locationName ?? ""}
                  defaultAddress={extracted?.locationAddress ?? ""}
                  onSelect={(venue: VenueSelection) => {
                    setLatitude(venue.latitude);
                    setLongitude(venue.longitude);
                  }}
                  onClear={() => {
                    setLatitude(null);
                    setLongitude(null);
                  }}
                />
              </div>

              {/* Registration URL — pre-filled with extracted or source link */}
              <div>
                <label
                  htmlFor="registrationUrl"
                  className="mb-1 block text-sm font-semibold text-gray-700"
                >
                  Registration URL
                </label>
                <input
                  id="registrationUrl"
                  name="registrationUrl"
                  type="url"
                  defaultValue={extracted?.registrationUrl ?? sourceUrl}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="https://..."
                />
                <p className="mt-1 text-xs text-gray-400">
                  If different from the source link above. Leave as-is if
                  that&apos;s the registration page.
                </p>
              </div>

              {/* Entry Fee */}
              <div>
                <label
                  htmlFor="entryFee"
                  className="mb-1 block text-sm font-semibold text-gray-700"
                >
                  Entry Fee ($)
                </label>
                <input
                  id="entryFee"
                  name="entryFee"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={extracted?.entryFee ?? ""}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="0 for free"
                />
              </div>

              {/* Skill Levels */}
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-700">
                  Skill Levels
                </p>
                <div className="flex flex-wrap gap-2">
                  {SKILL_LEVELS.map((level) => (
                    <label
                      key={level}
                      className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 transition has-[:checked]:border-green-500 has-[:checked]:bg-green-50 has-[:checked]:text-green-700"
                    >
                      <input
                        type="checkbox"
                        name="skillLevels"
                        value={level}
                        defaultChecked={extracted?.skillLevels?.includes(level)}
                        className="sr-only"
                      />
                      {level}
                    </label>
                  ))}
                </div>
              </div>

              {/* Format */}
              <div>
                <label
                  htmlFor="format"
                  className="mb-1 block text-sm font-semibold text-gray-700"
                >
                  Format
                </label>
                <select
                  id="format"
                  name="format"
                  defaultValue={extracted?.format ?? ""}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="">Select format</option>
                  <option value="round_robin">Round Robin</option>
                  <option value="single_elim">Single Elimination</option>
                  <option value="double_elim">Double Elimination</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="description"
                  className="mb-1 block text-sm font-semibold text-gray-700"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={extracted?.description ?? ""}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Any additional details about the tournament..."
                />
              </div>

              {state === "error" && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMsg}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setExtracted(null);
                    setStep(1);
                    setLatitude(null);
                    setLongitude(null);
                  }}
                  className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={state === "submitting"}
                  className="flex-1 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                >
                  {state === "submitting"
                    ? "Submitting..."
                    : "Submit Tournament"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
