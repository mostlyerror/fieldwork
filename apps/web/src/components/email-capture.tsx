"use client";

import { useState, useRef } from "react";
import { subscribeEmail } from "@/app/actions";

type State = "idle" | "submitting" | "success" | "already_subscribed" | "error";

export function EmailCapture() {
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setState("submitting");
    setErrorMsg("");

    const result = await subscribeEmail(formData);

    switch (result.status) {
      case "success":
        setState("success");
        formRef.current?.reset();
        break;
      case "already_subscribed":
        setState("already_subscribed");
        break;
      case "error":
        setState("error");
        setErrorMsg(result.message);
        break;
    }
  }

  if (state === "success") {
    return (
      <div className="mx-auto max-w-xl px-5 pb-6">
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-100">
          <p className="text-2xl">{"🎉"}</p>
          <p className="mt-2 font-bold text-gray-800">You&apos;re in!</p>
          <p className="mt-1 text-sm text-gray-500">
            We&apos;ll send you a weekly roundup of Houston tournaments every Monday.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-5 pb-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <p className="mb-1 text-center text-sm font-semibold text-gray-700">
          {"📬"} Get the weekly tournament digest
        </p>
        <p className="mb-4 text-center text-xs text-gray-400">
          Every Monday — the same roundup we post on Instagram, straight to your inbox.
        </p>
        <form ref={formRef} action={handleSubmit} className="flex gap-2">
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm placeholder-gray-300 focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
          />
          <button
            type="submit"
            disabled={state === "submitting"}
            className="whitespace-nowrap rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {state === "submitting" ? "..." : "Subscribe"}
          </button>
        </form>
        {state === "already_subscribed" && (
          <p className="mt-2 text-center text-xs text-amber-600">
            You&apos;re already subscribed! Check your inbox on Mondays.
          </p>
        )}
        {state === "error" && (
          <p className="mt-2 text-center text-xs text-red-500">{errorMsg}</p>
        )}
      </div>
    </div>
  );
}
