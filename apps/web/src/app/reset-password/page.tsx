"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  AuthShell,
  authButtonClass,
  authErrorClass,
  authHeadingClass,
  authInputClass,
  authLabelClass,
  authSubcopyClass,
} from "@/components/auth/auth-shell";

/**
 * Password-recovery handler. Supabase's reset email lands here with the recovery
 * token in the URL hash (#access_token=...&refresh_token=...&type=recovery).
 *
 * We CANNOT rely on the client auto-detecting it: @supabase/ssr's browser client
 * defaults to the PKCE flow, whose detectSessionInUrl only handles a ?code= query
 * param and ignores the implicit #access_token hash entirely. So we parse the hash
 * ourselves and call setSession() explicitly — that establishes the short-lived
 * recovery session regardless of flow type, after which updateUser({ password })
 * can set the new password.
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
    let active = true;

    async function establish() {
      const raw = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(raw);

      // Supabase puts a failed/expired verification's error in the hash.
      if (params.get("error_code") || params.get("error")) {
        if (active) setStatus("invalid");
        return;
      }

      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      // The recovery link delivers tokens in the hash → set the session explicitly.
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (!active) return;
        if (error) {
          console.error("[reset-password] setSession failed", error);
          setStatus("invalid");
        } else {
          // Strip the tokens from the URL so they aren't left in history.
          window.history.replaceState(null, "", window.location.pathname);
          setStatus("ready");
        }
        return;
      }

      // No hash tokens — fall back to an existing (e.g. cookie) session.
      const { data } = await supabase.auth.getSession();
      if (active) setStatus(data.session ? "ready" : "invalid");
    }

    establish();
    return () => {
      active = false;
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
    <AuthShell>
      <h1 className={authHeadingClass}>Set a new password</h1>
      <p className={authSubcopyClass}>
        Choose something you haven&rsquo;t used before. You&rsquo;ll be signed in
        automatically once it&rsquo;s saved.
      </p>

      {status === "loading" && (
        <p className="text-[0.83rem] text-[#6b7280]">
          Verifying your reset link&hellip;
        </p>
      )}

      {status === "invalid" && (
        <div className="space-y-4">
          <p className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-[0.83rem] text-red-700">
            This reset link is invalid or has expired.
          </p>
          <Link href="/forgot-password" className={authButtonClass}>
            Request a new link
          </Link>
        </div>
      )}

      {status === "done" && (
        <p className="rounded-[10px] border border-[#a7f3d0] bg-[#ecfdf5] p-4 text-[0.83rem] font-medium text-[#065f46]">
          Password updated. Redirecting&hellip;
        </p>
      )}

      {status === "ready" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(new FormData(e.currentTarget));
          }}
          noValidate
        >
          {error && <div className={authErrorClass}>{error}</div>}

          <div className="mb-4">
            <label htmlFor="password" className={authLabelClass}>
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className={authInputClass}
            />
          </div>

          <div className="mb-5">
            <label htmlFor="confirm" className={authLabelClass}>
              Confirm password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Re-enter it"
              className={authInputClass}
            />
          </div>

          <button type="submit" disabled={pending} className={authButtonClass}>
            {pending ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
