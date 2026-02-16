"use client";

import { useState } from "react";
import { devLogin } from "./actions";

export function DevQuickLogin() {
  const isDev =
    process.env.NEXT_PUBLIC_SUPABASE_URL !==
    process.env.NEXT_PUBLIC_SUPABASE_PROD_URL;

  const [pending, setPending] = useState<"admin" | "user" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isDev) return null;

  async function handleClick(role: "admin" | "user") {
    setPending(role);
    setError(null);
    const result = await devLogin(role);
    if (result?.error) {
      setError(result.error);
      setPending(null);
    }
  }

  return (
    <div className="mt-6 rounded-lg border-2 border-dashed border-gray-300 p-4">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">
        Dev Quick Login
      </p>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 p-2 text-center text-xs text-red-600">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => handleClick("admin")}
          disabled={pending !== null}
          className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
        >
          {pending === "admin" ? "Logging in..." : "Admin"}
        </button>
        <button
          onClick={() => handleClick("user")}
          disabled={pending !== null}
          className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
        >
          {pending === "user" ? "Logging in..." : "User"}
        </button>
      </div>
    </div>
  );
}
