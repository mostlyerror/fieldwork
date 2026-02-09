"use client";

import { useState } from "react";
import Link from "next/link";
import { SKILL_LEVELS } from "@/lib/constants";

type FormState = "idle" | "submitting" | "success" | "error";

export default function SubmitTournamentPage() {
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

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
      name: fd.get("name") as string,
      dateStart: fd.get("dateStart") as string,
      dateEnd: (fd.get("dateEnd") as string) || undefined,
      locationName: fd.get("locationName") as string,
      locationAddress: (fd.get("locationAddress") as string) || undefined,
      skillLevels: skillLevels.length > 0 ? skillLevels : undefined,
      format: (fd.get("format") as string) || undefined,
      entryFee: fd.get("entryFee")
        ? Number(fd.get("entryFee"))
        : undefined,
      registrationUrl: fd.get("registrationUrl") as string,
      description: (fd.get("description") as string) || undefined,
    };

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-tournament`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        <nav className="bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-3xl">{"\u{1F3D3}"}</span>
              <span className="text-xl font-bold text-green-700">
                PickleRadar
              </span>
            </Link>
          </div>
        </nav>
        <main className="mx-auto max-w-3xl px-5 py-16 text-center">
          <div className="text-5xl mb-4">{"\u2705"}</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Thanks for submitting!
          </h1>
          <p className="text-gray-500 mb-8">
            Your tournament will appear on PickleRadar after review.
          </p>
          <Link
            href="/"
            className="inline-block rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            Back to tournaments
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/50 via-white to-amber-50/30">
      <nav className="bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-3xl">{"\u{1F3D3}"}</span>
            <span className="text-xl font-bold text-green-700">
              PickleRadar
            </span>
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center text-sm text-gray-400 hover:text-green-700"
        >
          &larr; Back to tournaments
        </Link>

        <h1 className="mb-2 text-2xl font-bold text-gray-800">
          Submit a Tournament
        </h1>
        <p className="mb-8 text-sm text-gray-500">
          Know about an upcoming pickleball tournament in the Houston area?
          Submit it here and we&apos;ll add it to PickleRadar after a quick
          review.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Honeypot — hidden from real users */}
          <div style={{ position: "absolute", left: "-9999px" }} aria-hidden>
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
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label
              htmlFor="locationName"
              className="mb-1 block text-sm font-semibold text-gray-700"
            >
              Venue Name *
            </label>
            <input
              id="locationName"
              name="locationName"
              required
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="e.g. Memorial Park Pickleball Center"
            />
          </div>

          <div>
            <label
              htmlFor="locationAddress"
              className="mb-1 block text-sm font-semibold text-gray-700"
            >
              Venue Address
            </label>
            <input
              id="locationAddress"
              name="locationAddress"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="e.g. 7600 Memorial Dr, Houston, TX 77024"
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
                    className="sr-only"
                  />
                  {level}
                </label>
              ))}
            </div>
          </div>

          {/* Format + Fee */}
          <div className="grid gap-4 sm:grid-cols-2">
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
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                <option value="">Select format</option>
                <option value="round_robin">Round Robin</option>
                <option value="single_elim">Single Elimination</option>
                <option value="double_elim">Double Elimination</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
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
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                placeholder="0 for free"
              />
            </div>
          </div>

          {/* Registration URL */}
          <div>
            <label
              htmlFor="registrationUrl"
              className="mb-1 block text-sm font-semibold text-gray-700"
            >
              Registration URL *
            </label>
            <input
              id="registrationUrl"
              name="registrationUrl"
              type="url"
              required
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="https://..."
            />
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
              rows={4}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="Any additional details about the tournament..."
            />
          </div>

          {state === "error" && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={state === "submitting"}
            className="w-full rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            {state === "submitting" ? "Submitting..." : "Submit Tournament"}
          </button>
        </form>
      </main>
    </div>
  );
}
