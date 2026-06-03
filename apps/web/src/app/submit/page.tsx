"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
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
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-3xl px-3 sm:px-5 py-16 text-center">
          <h1 className="t-h1 text-gray-900 mb-2">
            Thanks for submitting!
          </h1>
          <p className="text-gray-500 mb-8">
            Your tournament will appear on PickleRadar after review.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={resetForm}
              className="rounded-lg border border-gray-200 px-6 py-3 t-body font-bold text-gray-700 transition hover:bg-gray-50"
            >
              Submit another
            </button>
            <Link
              href="/"
              className="inline-block rounded-lg bg-emerald-700 px-6 py-3 t-body font-bold text-white transition hover:bg-emerald-800"
            >
              Back to tournaments
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-3xl px-3 sm:px-5 py-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center t-body text-gray-400 hover:text-emerald-700"
        >
          &larr; Back to tournaments
        </Link>

        {step === 1 && (
          <div>
            <h1 className="mb-2 t-h1 text-gray-900">
              Spotted a tournament?
            </h1>
            <p className="mb-8 text-gray-500">
              Paste the link and we&apos;ll take it from there.
            </p>

            <form onSubmit={handleStep1} className="space-y-4">
              <div>
                <label
                  htmlFor="sourceUrl"
                  className="mb-1 block t-body font-semibold text-gray-700"
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
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-base focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  placeholder="Instagram post, registration page, Facebook event..."
                />
                <p className="mt-1.5 t-caption text-gray-400">
                  Any link where you found the tournament — we&apos;ll figure
                  out the rest.
                </p>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-emerald-700 px-6 py-3 t-body font-bold text-white transition hover:bg-emerald-800"
              >
                Next
              </button>
            </form>
          </div>
        )}

        {step === "extracting" && (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-700" />
            <p className="t-body text-gray-600">
              Analyzing page...
            </p>
            <p className="mt-1 t-caption text-gray-400">
              Extracting tournament details from the link
            </p>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="mb-2 t-h1 text-gray-900">
              {extracted ? "Review what we found" : "Fill in what you know"}
            </h1>
            <p className="mb-6 t-body text-gray-500">
              {extracted
                ? "We pre-filled what we could. Fix anything that looks off."
                : "It’s okay if you don’t know everything — we’ll fill in the gaps."}
            </p>

            {/* Source link chip */}
            <div className="mb-6 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 t-body text-gray-600">
                <svg
                  className="h-3.5 w-3.5 flex-shrink-0"
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
                <span className="max-w-[240px] truncate break-all">
                  {sourceUrl}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setExtracted(null);
                  setStep(1);
                  setLatitude(null);
                  setLongitude(null);
                }}
                className="px-2 py-1 t-body text-gray-400 hover:text-emerald-700"
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
                  className="mb-1 block t-body font-semibold text-gray-700"
                >
                  Tournament Name *
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  autoFocus
                  defaultValue={extracted?.name ?? ""}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  placeholder="e.g. Houston Summer Smash 2026"
                />
              </div>

              {/* Dates */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="dateStart"
                    className="mb-2 block t-body font-semibold text-gray-700"
                  >
                    Start Date *
                  </label>
                  <input
                    id="dateStart"
                    name="dateStart"
                    type="date"
                    required
                    defaultValue={extracted?.dateStart ?? ""}
                    className="min-h-[44px] w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  />
                </div>
                <div>
                  <label
                    htmlFor="dateEnd"
                    className="mb-2 block t-body font-semibold text-gray-700"
                  >
                    End Date
                  </label>
                  <input
                    id="dateEnd"
                    name="dateEnd"
                    type="date"
                    defaultValue={extracted?.dateEnd ?? ""}
                    className="min-h-[44px] w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  />
                </div>
              </div>

              {/* Venue */}
              <div>
                <label className="mb-1 block t-body font-semibold text-gray-700">
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
                  className="mb-1 block t-body font-semibold text-gray-700"
                >
                  Registration URL
                </label>
                <input
                  id="registrationUrl"
                  name="registrationUrl"
                  type="url"
                  defaultValue={extracted?.registrationUrl ?? sourceUrl}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  placeholder="https://..."
                />
                <p className="mt-1 t-caption text-gray-400">
                  If different from the source link above. Leave as-is if
                  that&apos;s the registration page.
                </p>
              </div>

              {/* Entry Fee */}
              <div>
                <label
                  htmlFor="entryFee"
                  className="mb-1 block t-body font-semibold text-gray-700"
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
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  placeholder="0 for free"
                />
              </div>

              {/* Skill Levels */}
              <div>
                <p className="mb-2 t-body font-semibold text-gray-700">
                  Skill Levels
                </p>
                <div className="flex flex-wrap gap-2 sm:gap-2.5">
                  {SKILL_LEVELS.map((level) => (
                    <label
                      key={level}
                      className="flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 px-3 py-2 t-caption text-gray-700 transition has-[:checked]:border-emerald-700 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-800 sm:min-h-[44px] sm:px-3.5 sm:py-2.5"
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
                  className="mb-1 block t-body font-semibold text-gray-700"
                >
                  Format
                </label>
                <select
                  id="format"
                  name="format"
                  defaultValue={extracted?.format ?? ""}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
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
                  className="mb-1 block t-body font-semibold text-gray-700"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={extracted?.description ?? ""}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  placeholder="Any additional details about the tournament..."
                />
              </div>

              {state === "error" && (
                <p className="rounded-lg bg-red-50 px-4 py-3 t-body text-red-700">
                  {errorMsg}
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between sm:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setExtracted(null);
                    setStep(1);
                    setLatitude(null);
                    setLongitude(null);
                  }}
                  className="w-full min-h-[44px] rounded-lg border border-gray-200 px-6 py-3 t-body font-bold text-gray-600 transition hover:bg-gray-50 sm:w-auto"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={state === "submitting"}
                  className="w-full min-h-[44px] flex-1 rounded-lg bg-emerald-700 px-6 py-3 t-body font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50 sm:w-auto"
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

      <Footer />
    </div>
  );
}
