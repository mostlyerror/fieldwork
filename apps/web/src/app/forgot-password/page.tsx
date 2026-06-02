"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "./actions";
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
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const email = String(formData.get("email") || "");
      // Routes through the admin generateLink + Brevo API path (see ./actions.ts),
      // bypassing Supabase's flaky custom SMTP entirely. Fast (~1s) and reliable.
      const result = await requestPasswordReset(email, window.location.origin);
      if (result.ok) {
        setSent(true);
      } else {
        setError(
          result.error ||
            "Couldn't send the reset email — try again in a minute.",
        );
      }
    } catch (e) {
      console.error("[forgot-password]", e);
      setError("Something went wrong sending the email. Please try again.");
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
