"use client";

import { useState, useCallback } from "react";
import { searchPlayers, linkDuprRating } from "./actions";

interface PlayerMatch {
  id: string;
  player_name: string;
  dupr_rating: number;
  location: string | null;
}

export function DuprLinker() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState<"search" | "manual">("search");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (query.length < 2) return;
    setSearching(true);
    const matches = await searchPlayers(query);
    setResults(matches);
    setSearching(false);
  }, [query]);

  async function handleSelect(player: PlayerMatch) {
    setStatus("saving");
    setError(null);

    const formData = new FormData();
    formData.set("dupr_rating_doubles", player.dupr_rating.toString());
    formData.set("name", player.player_name);

    const result = await linkDuprRating(formData);
    if (result?.error) {
      setError(result.error);
      setStatus("idle");
    } else {
      setStatus("saved");
      setResults([]);
      setQuery("");
    }
  }

  async function handleManualSubmit(formData: FormData) {
    setStatus("saving");
    setError(null);

    const result = await linkDuprRating(formData);
    if (result?.error) {
      setError(result.error);
      setStatus("idle");
    } else {
      setStatus("saved");
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 t-body text-red-600">
          {error}
        </div>
      )}

      {status === "saved" && (
        <div className="rounded-lg bg-emerald-50 p-3 t-body text-emerald-700">
          Rating linked successfully!
        </div>
      )}

      <div className="flex gap-2 t-body">
        <button
          type="button"
          onClick={() => setMode("search")}
          className={`rounded-lg px-3 py-1 font-medium transition ${
            mode === "search"
              ? "bg-emerald-50 text-emerald-700"
              : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          Find your rating
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`rounded-lg px-3 py-1 font-medium transition ${
            mode === "manual"
              ? "bg-emerald-50 text-emerald-700"
              : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          Enter manually
        </button>
      </div>

      {mode === "search" && (
        <div>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by your name..."
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching || query.length < 2}
              className="rounded-lg bg-emerald-700 px-4 py-2 t-body font-bold text-white transition hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
            >
              {searching ? "..." : "Search"}
            </button>
          </div>

          {results.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="t-caption text-gray-400">
                Select your profile:
              </p>
              {results.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => handleSelect(player)}
                  disabled={status === "saving"}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left t-body transition hover:border-emerald-300 hover:bg-emerald-50/60 active:scale-[0.99] disabled:opacity-50"
                >
                  <div>
                    <span className="font-medium text-gray-900">
                      {player.player_name}
                    </span>
                    {player.location && (
                      <span className="ml-2 t-caption text-gray-400">
                        {player.location}
                      </span>
                    )}
                  </div>
                  <span className="font-bold tabular-nums text-emerald-800">
                    {player.dupr_rating.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {results.length === 0 && query.length >= 2 && !searching && (
            <p className="mt-2 t-body text-gray-400">
              No matches found. Try a different name or{" "}
              <button
                type="button"
                onClick={() => setMode("manual")}
                className="font-medium text-emerald-700 hover:text-emerald-800"
              >
                enter your rating manually
              </button>
              .
            </p>
          )}
        </div>
      )}

      {mode === "manual" && (
        <form action={handleManualSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="dupr_doubles"
                className="mb-1 block t-body text-gray-700"
              >
                Doubles Rating
              </label>
              <input
                id="dupr_doubles"
                name="dupr_rating_doubles"
                type="number"
                step="0.01"
                min="1.0"
                max="8.0"
                placeholder="e.g. 3.50"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label
                htmlFor="dupr_singles"
                className="mb-1 block t-body text-gray-700"
              >
                Singles Rating
              </label>
              <input
                id="dupr_singles"
                name="dupr_rating_singles"
                type="number"
                step="0.01"
                min="1.0"
                max="8.0"
                placeholder="e.g. 3.75"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={status === "saving"}
            className="rounded-xl bg-emerald-700 px-5 py-2.5 t-body font-bold text-white transition hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
          >
            {status === "saving" ? "Saving..." : "Save rating"}
          </button>
        </form>
      )}
    </div>
  );
}
