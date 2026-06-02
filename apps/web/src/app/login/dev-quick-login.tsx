"use client";

import { useState, useEffect } from "react";
import { devLogin } from "./actions";

export function DevQuickLogin() {
  const [isLocal, setIsLocal] = useState(false);
  const [pending, setPending] = useState<"admin" | "user" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = window.location.hostname;
    setIsLocal(host === "localhost" || host === "127.0.0.1");
  }, []);

  if (!isLocal) return null;

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
    <div
      className="mt-7 rounded-xl border-2 border-dashed border-[#d1d5db] bg-[#f9fafb] px-[18px] py-4"
      role="region"
      aria-label="Developer quick login"
    >
      <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#fef3c7] px-2 py-[3px] text-[0.65rem] font-bold uppercase tracking-[0.06em] text-[#92400e]">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M8 2L14.9 14H1.1L8 2Z" stroke="#92400e" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M8 7v3" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="12.5" r="0.8" fill="#92400e" />
        </svg>
        Dev only &nbsp;&middot;&nbsp; localhost
      </span>

      <p className="mb-2.5 text-[0.78rem] font-semibold text-[#374151]">
        Quick login &mdash; skip the form
      </p>

      {error && (
        <div className="mb-2.5 rounded-lg bg-red-50 p-2 text-center text-[0.72rem] text-red-600">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleClick("admin")}
          disabled={pending !== null}
          className="flex-1 rounded-lg border-[1.5px] border-[#d1d5db] bg-white px-3 py-[9px] text-[0.78rem] font-semibold text-[#374151] transition hover:bg-[#f3f4f6] disabled:opacity-50"
        >
          {pending === "admin" ? "Signing in…" : "Admin user"}
        </button>
        <button
          type="button"
          onClick={() => handleClick("user")}
          disabled={pending !== null}
          className="flex-1 rounded-lg border-[1.5px] border-[#d1d5db] bg-white px-3 py-[9px] text-[0.78rem] font-semibold text-[#374151] transition hover:bg-[#f3f4f6] disabled:opacity-50"
        >
          {pending === "user" ? "Signing in…" : "Regular user"}
        </button>
      </div>
    </div>
  );
}
