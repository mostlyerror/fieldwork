"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

/** Request a password-reset email that links back to /reset-password. */
export default function ForgotPasswordPage() {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const email = String(formData.get("email") || "");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPending(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-green-50/50 via-white to-amber-50/30 px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="text-3xl">{"\u{1F3D3}"}</span>
          <span className="text-2xl font-bold text-green-700">PickleRadar</span>
        </Link>
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
          <h1 className="mb-6 text-center text-xl font-bold text-gray-900">
            Reset your password
          </h1>
          {sent ? (
            <p className="text-center text-sm text-gray-600">
              If an account exists for that email, a reset link is on its way.
              Open it and set a new password.
            </p>
          ) : (
            <form action={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}
          <p className="mt-4 text-center text-sm text-gray-500">
            <Link
              href="/login"
              className="font-medium text-green-600 hover:text-green-700"
            >
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
