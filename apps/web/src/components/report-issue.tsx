"use client";

import { useState } from "react";
import { reportTournamentIssue } from "@/app/actions";

type State = "idle" | "open" | "submitting" | "success" | "error";

export function ReportIssue({
  tournamentId,
  tournamentName,
}: {
  tournamentId: string;
  tournamentName: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (state === "success") {
    return (
      <p className="t-body font-semibold text-emerald-700">
        Thanks — we got it. We&apos;ll take a look.
      </p>
    );
  }

  if (state === "idle") {
    return (
      <p className="t-body font-semibold text-gray-700">
        Something missing or incorrect?{" "}
        <button
          type="button"
          onClick={() => setState("open")}
          className="text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
        >
          Let us know
        </button>
      </p>
    );
  }

  async function handleSubmit(formData: FormData) {
    setState("submitting");
    setErrorMsg("");
    formData.set("tournamentId", tournamentId);
    formData.set("tournamentName", tournamentName);
    const result = await reportTournamentIssue(formData);
    if (result.status === "success") {
      setState("success");
    } else {
      setState("error");
      setErrorMsg(result.message);
    }
  }

  return (
    <form action={handleSubmit} className="mx-auto max-w-md text-left">
      <label htmlFor="report-message" className="block t-body font-semibold text-gray-700">
        What&apos;s wrong with <span className="text-gray-900">{tournamentName}</span>?
      </label>
      <textarea
        id="report-message"
        name="message"
        required
        rows={3}
        autoFocus
        placeholder="e.g. wrong date, missing event, registration link is broken…"
        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
      />
      <input
        type="email"
        name="email"
        placeholder="Your email (optional, so we can follow up)"
        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
      />
      {state === "error" && (
        <p className="mt-2 t-body text-red-600">{errorMsg}</p>
      )}
      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => setState("idle")}
          className="w-full rounded-lg px-4 py-2.5 t-body font-semibold text-gray-600 hover:text-gray-900 sm:w-auto"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={state === "submitting"}
          className="w-full min-h-[44px] rounded-lg bg-emerald-700 px-4 py-2.5 t-body font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50 sm:w-auto"
        >
          {state === "submitting" ? "Sending…" : "Send report"}
        </button>
      </div>
    </form>
  );
}
