"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * A "back" affordance that returns to wherever the user actually came from.
 * If there's same-origin history (e.g. they arrived from a tournament page),
 * it pops the browser stack. If they landed cold (search engine, shared link,
 * new tab), it falls back to a sensible labeled destination.
 */
export function BackLink({
  fallbackHref,
  fallbackLabel,
  className,
}: {
  fallbackHref: string;
  fallbackLabel: string;
  className?: string;
}) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(
      window.history.length > 1 &&
        document.referrer !== "" &&
        document.referrer.startsWith(window.location.origin),
    );
  }, []);

  if (canGoBack) {
    return (
      <button type="button" onClick={() => router.back()} className={className}>
        &larr; Back
      </button>
    );
  }

  return (
    <Link href={fallbackHref} className={className}>
      &larr; {fallbackLabel}
    </Link>
  );
}
