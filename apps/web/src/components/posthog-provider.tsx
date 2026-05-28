"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

/**
 * Initializes PostHog on the client and tracks $pageview events on route
 * changes. App Router's <Link /> uses soft navigation, so we manually fire
 * pageview events on pathname/searchParams changes.
 *
 * Setup:
 *   - Set NEXT_PUBLIC_POSTHOG_KEY (project token) in env
 *   - Set NEXT_PUBLIC_POSTHOG_HOST (default https://us.i.posthog.com)
 *   - If both unset, this is a no-op (safe for local dev without the keys).
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    // Route through our /ingest proxy so ad blockers don't drop events.
    // The actual destination is configured in next.config.ts rewrites.
    const apiHost = "/ingest";
    const uiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.posthog.com";
    if (!key) {
      console.warn("[PostHog] NEXT_PUBLIC_POSTHOG_KEY is not set — analytics disabled");
      return;
    }
    if (posthog.__loaded) return;
    posthog.init(key, {
      api_host: apiHost,
      ui_host: uiHost,
      person_profiles: "identified_only",
      capture_pageview: false, // we fire $pageview manually below
      capture_pageleave: true,
      loaded: () => {
        console.log(`[PostHog] ready (key=${key.slice(0, 8)}…, proxied via ${apiHost})`);
      },
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <PageviewTracker />
      {children}
    </PHProvider>
  );
}

function PageviewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!posthog.__loaded) return;
    // Use window.location.href so search params are included naturally
    posthog.capture("$pageview", {
      $current_url: typeof window !== "undefined" ? window.location.href : pathname,
    });
  }, [pathname]);

  return null;
}
