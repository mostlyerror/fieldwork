"use client";

import { useState, useTransition, useEffect } from "react";
import { searchPlayers, requestClaim, type PlayerCandidate } from "./actions";
import { track } from "@/lib/analytics";

type SendState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent" }
  | { status: "already_claimed_by_another" }
  | { status: "error"; message: string };

export function FindClient({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<PlayerCandidate[] | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [send, setSend] = useState<SendState>({ status: "idle" });

  useEffect(() => {
    track("claim_flow_started");
  }, []);

  function handleSearch() {
    if (!query.trim()) return;
    track("claim_flow_searched", { queryLength: query.trim().length });
    startSearch(async () => {
      const results = await searchPlayers(query);
      setCandidates(results);
      setPickedId(null);
    });
  }

  function handlePick(candidateId: string) {
    setPickedId(candidateId);
    track("claim_flow_candidate_picked", { candidateId });
  }

  async function handleConfirm() {
    if (!pickedId || !email) return;
    setSend({ status: "sending" });
    const r = await requestClaim(email, pickedId);
    setSend(r);
    if (r.status === "sent") {
      track("claim_flow_confirmation_sent", { candidateId: pickedId });
    }
  }

  if (send.status === "sent") {
    return (
      <div className="animate-fade-up rounded-xl border-2 border-emerald-700 bg-white p-6 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-700 text-white animate-pop">
          <span className="text-2xl">✓</span>
        </div>
        <h2 className="mt-4 t-h2 text-gray-900">Check your inbox</h2>
        <p className="mt-2 t-body text-gray-500">
          We sent a confirmation link to <strong>{email}</strong>. Click it to finish claiming your profile.
        </p>
        <p className="mt-4 t-caption text-gray-400">The link expires in 7 days.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email */}
      <div>
        <label htmlFor="email" className="block t-label tracking-widest text-gray-500">
          Your email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="mt-2 w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-2.5 text-base focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
        <p className="mt-1 t-caption text-gray-400">We&apos;ll link this to your profile and send your tournament alerts here.</p>
      </div>

      {/* Search */}
      <div>
        <label htmlFor="q" className="block t-label tracking-widest text-gray-500">
          Your name
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:gap-2">
          <input
            id="q"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Ben Poon"
            className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-2.5 text-base focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100 sm:flex-1"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="w-full min-h-[44px] rounded-lg bg-emerald-700 px-5 py-2.5 t-body font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50 sm:w-auto sm:shrink-0"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {/* Candidates */}
      {candidates !== null && (
        <div>
          <p className="t-label tracking-widest text-gray-500">
            {candidates.length === 0 ? "No matches" : `${candidates.length} match${candidates.length === 1 ? "" : "es"}`}
          </p>
          {candidates.length === 0 ? (
            <p className="mt-3 t-body text-gray-500">
              Try a different spelling, or add a last name / last initial.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {candidates.map((c) => {
                const picked = c.id === pickedId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => handlePick(c.id)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition ${
                        picked ? "bg-emerald-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div>
                        <p className="t-body font-semibold text-gray-900">{c.name}</p>
                        <p className="t-caption text-gray-500">
                          {c.location ?? "Location unknown"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.dupr_doubles != null && (
                          <span className="t-body font-bold text-emerald-700">
                            {c.dupr_doubles.toFixed(2)}
                          </span>
                        )}
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                            picked ? "border-emerald-700 bg-emerald-700 text-white" : "border-gray-300"
                          }`}
                        >
                          {picked ? "✓" : ""}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Confirm */}
      {pickedId && (
        <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
          <p className="t-body text-gray-700">
            We&apos;ll email a confirmation link to <strong>{email || "your email"}</strong>. Click it to finish.
          </p>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!email || send.status === "sending"}
            className="mt-3 w-full rounded-lg bg-emerald-700 px-5 py-3 t-body font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50"
          >
            {send.status === "sending" ? "Sending..." : "Send confirmation email"}
          </button>
          {send.status === "already_claimed_by_another" && (
            <p className="mt-2 t-caption text-red-600">
              That player is already claimed by someone else. If that&apos;s wrong, email us.
            </p>
          )}
          {send.status === "error" && (
            <p className="mt-2 t-caption text-red-600">{send.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
