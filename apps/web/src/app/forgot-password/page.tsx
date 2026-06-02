"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  AuthShell,
  authButtonClass,
  authErrorClass,
  authHeadingClass,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authSubcopyClass,
} from "@/components/auth/auth-shell";

/** Request a password-reset email that links back to /reset-password. */
export default function ForgotPasswordPage() {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const email = String(formData.get("email") || "");
      // Race against a timeout — Supabase's recover endpoint can hang ~30s when
      // its SMTP send times out, freezing the button. Fail fast with a useful hint.
      const { error } = await Promise.race([
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "The email service didn't respond. Supabase is likely timing out sending via SMTP — check the SMTP host/port/credentials in Supabase Auth settings.",
                ),
              ),
            12000,
          ),
        ),
      ]);
      if (error) {
        console.error("[forgot-password]", error);
        setError(
          error.message ||
            "Couldn't send the reset email — check the email and try again in a minute.",
        );
      } else {
        setSent(true);
      }
    } catch (e) {
      console.error("[forgot-password]", e);
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong sending the email. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell>
      <h1 className={authHeadingClass}>Reset your password</h1>
      <p className={authSubcopyClass}>
        Enter the email on your account and we&rsquo;ll send a reset link. Check
        your spam folder if it doesn&rsquo;t show up within a minute.
      </p>

      {sent ? (
        <p className="rounded-[10px] border border-[#a7f3d0] bg-[#ecfdf5] p-4 text-[0.83rem] leading-relaxed text-[#065f46]">
          If an account exists for that email, a reset link is on its way. Open
          it and set a new password.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(new FormData(e.currentTarget));
          }}
          noValidate
        >
          {error && <div className={authErrorClass}>{error}</div>}

          <div className="mb-5">
            <label htmlFor="email" className={authLabelClass}>
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className={authInputClass}
            />
          </div>

          <button type="submit" disabled={pending} className={authButtonClass}>
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <Link href="/login" className={`mt-5 block text-center text-[0.8rem] ${authLinkClass}`}>
        &larr; Back to sign in
      </Link>
    </AuthShell>
  );
}
