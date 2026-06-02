"use client";

import { useEffect } from "react";

/**
 * Safety net for password recovery. Supabase redirects the reset link to the
 * Site URL (or any non-allowlisted redirect falls back to it), so the recovery
 * token can land in the hash on "/" or "/houston" instead of "/reset-password".
 * Those pages ignore it. This catches a recovery hash anywhere and forwards it,
 * hash intact, to /reset-password — which knows how to consume it.
 *
 * Mounted globally in the root layout; a no-op on every normal page load.
 */
export function RecoveryRedirect() {
  useEffect(() => {
    if (window.location.pathname === "/reset-password") return;
    const hash = window.location.hash;
    if (!hash || !hash.includes("type=recovery")) return;

    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    if (params.get("type") === "recovery" && params.get("access_token")) {
      window.location.replace(`/reset-password${hash}`);
    }
  }, []);

  return null;
}
