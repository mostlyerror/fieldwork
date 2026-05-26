"use client";

import { useRouter } from "next/navigation";

export function BackButton({
  fallbackHref,
  label = "Back",
  className,
}: {
  fallbackHref?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        // If there's browser history, go back. Otherwise navigate to the fallback.
        if (window.history.length > 1) {
          router.back();
        } else if (fallbackHref) {
          router.push(fallbackHref);
        } else {
          router.push("/");
        }
      }}
      className={
        className ??
        "mb-6 inline-flex items-center text-sm text-gray-400 hover:text-emerald-700"
      }
    >
      &larr; {label}
    </button>
  );
}
