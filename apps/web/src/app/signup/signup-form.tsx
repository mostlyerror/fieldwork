"use client";

import { useState } from "react";
import { signup } from "./actions";

export function SignupForm({ redirect }: { redirect?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await signup(formData);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {redirect && <input type="hidden" name="redirect" value={redirect} />}

      {error && (
        <div className="rounded-lg bg-red-50 p-3 t-body text-red-600">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="mb-1 block t-body text-gray-700"
        >
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          placeholder="Your name (optional)"
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="mb-1 block t-body text-gray-700"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1 block t-body text-gray-700"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-green-600 px-4 py-2.5 t-body font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
      >
        {pending ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
