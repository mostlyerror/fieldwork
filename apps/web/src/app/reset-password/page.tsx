"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * Password-recovery handler. Supabase's reset email lands here with the recovery
 * token in the URL hash (#access_token=...&type=recovery); the browser client
 * parses it on load and establishes a short-lived recovery session, which lets
 * us call updateUser({ password }) to set a new password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [status, setStatus] = useState<"loading" | "ready" | "invalid" | "done">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let resolved = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        resolved = true;
        setStatus("ready");
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        resolved = true;
        setStatus("ready");
      }
    });
    // No recovery session materialised → the link is missing or expired.
    const t = setTimeout(() => {
      if (!resolved) setStatus("invalid");
    }, 2500);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, [supabase]);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const password = String(formData.get("password") || "");
    const confirm = String(formData.get("confirm") || "");
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      setPending(false);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      setPending(false);
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        console.error("[reset-password]", error);
        setError(
          error.message ||
            "Couldn't update the password. Request a new reset link and try again.",
        );
        return;
      }
      setStatus("done");
      setTimeout(() => router.push("/admin"), 1600);
    } catch (e) {
      console.error("[reset-password]", e);
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
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
            Set a new password
          </h1>

          {status === "loading" && (
            <p className="text-center text-sm text-gray-500">
              Verifying your reset link&hellip;
            </p>
          )}

          {status === "invalid" && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-red-600">
                This reset link is invalid or has expired.
              </p>
              <Link
                href="/forgot-password"
                className="inline-block rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Request a new link
              </Link>
            </div>
          )}

          {status === "done" && (
            <p className="text-center text-sm font-medium text-green-700">
              Password updated. Redirecting&hellip;
            </p>
          )}

          {status === "ready" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(new FormData(e.currentTarget));
              }}
              className="space-y-4"
            >
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}
              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  New password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <div>
                <label
                  htmlFor="confirm"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Confirm password
                </label>
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                {pending ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
