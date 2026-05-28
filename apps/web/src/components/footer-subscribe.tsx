"use client";

import { useState, useRef } from "react";
import { subscribeEmail } from "@/app/actions";

export function FooterSubscribe() {
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setState("submitting");
    const result = await subscribeEmail(formData);
    if (result.status === "success" || result.status === "already_subscribed") {
      setState("success");
      formRef.current?.reset();
    } else {
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="mt-3 inline-flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs text-white animate-pop">✓</span>
        <p className="text-sm font-semibold text-emerald-600 animate-fade-up">Boom — you&apos;re in.</p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={handleSubmit} className="mt-3 flex flex-col gap-2">
      <input
        type="text"
        name="name"
        placeholder="Your name (optional)"
        className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
      <div className="flex gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="you@email.com"
          className="w-full min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={state === "submitting"}
          className="shrink-0 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50"
        >
          {state === "submitting" ? "..." : "Subscribe"}
        </button>
      </div>
    </form>
  );
}
