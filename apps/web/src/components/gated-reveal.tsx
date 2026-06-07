"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { track } from "@/lib/analytics";

/**
 * Soft give-to-get gate: the children stay in the DOM (SEO sees them), but are
 * blurred with a "sign up to reveal" CTA for signed-out viewers. Resolves the
 * viewer's session client-side so the host page stays cacheable. Defaults to
 * obscured until the session is known, so we never flash deep content to a
 * signed-out visitor.
 */
export function GatedReveal({
  children,
  title = "See the full scouting report",
  blurb = "Rating trend, head-to-head & partner chemistry.",
  surface = "deep_stats",
}: {
  children: React.ReactNode;
  title?: string;
  blurb?: string;
  surface?: string;
}) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const trackedView = useRef(false);

  useEffect(() => {
    let active = true;
    const sb = createSupabaseBrowserClient();
    sb.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(!!data.session);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (active) setSignedIn(!!session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Fire once when a signed-out viewer actually sees the gate.
  useEffect(() => {
    if (signedIn === false && !trackedView.current) {
      trackedView.current = true;
      track("profile_gate_viewed", { surface });
    }
  }, [signedIn, surface]);

  const obscured = signedIn !== true; // blur until confirmed signed-in
  const showCta = signedIn === false; // CTA only once confirmed signed-out

  return (
    <div className="relative">
      <div
        className={obscured ? "pointer-events-none select-none blur-[7px]" : ""}
        aria-hidden={obscured || undefined}
      >
        {children}
      </div>
      {showCta && (
        <div className="absolute inset-0 flex items-start justify-center px-4 pt-10">
          <div className="max-w-xs rounded-2xl border border-gray-200 bg-white/95 px-5 py-5 text-center shadow-card backdrop-blur-sm">
            <div className="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" className="h-[18px] w-[18px]">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </div>
            <p className="t-body font-bold text-gray-900">{title}</p>
            <p className="mt-1 t-small text-gray-500">{blurb}</p>
            <Link
              href="/signup"
              onClick={() => track("profile_gate_signup_clicked", { surface, via: "signup" })}
              className="mt-3.5 inline-flex rounded-xl bg-emerald-700 px-5 py-2.5 t-small font-bold text-white transition active:scale-[0.98] hover:bg-emerald-800"
            >
              Sign up free
            </Link>
            <Link
              href="/login"
              onClick={() => track("profile_gate_signup_clicked", { surface, via: "login" })}
              className="mt-2 block t-caption text-gray-400 hover:text-gray-600"
            >
              or log in
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
