"use client";

import { useState } from "react";
import Link from "next/link";
import { login } from "./actions";
import {
  authButtonClass,
  authErrorClass,
  authInputClass,
  authLabelClass,
  authLinkClass,
} from "@/components/auth/auth-shell";

export function LoginForm({ redirect }: { redirect?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await login(formData);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(new FormData(e.currentTarget));
      }}
      noValidate
    >
      {redirect && <input type="hidden" name="redirect" value={redirect} />}

      {error && <div className={authErrorClass}>{error}</div>}

      <div className="mb-4">
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

      <div className="mb-4">
        <label htmlFor="password" className={authLabelClass}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="current-password"
          placeholder="Your password"
          className={authInputClass}
        />
      </div>

      <Link
        href="/forgot-password"
        className={`-mt-1 mb-5 block text-right text-[0.78rem] ${authLinkClass}`}
      >
        Forgot password?
      </Link>

      <button type="submit" disabled={pending} className={authButtonClass}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
