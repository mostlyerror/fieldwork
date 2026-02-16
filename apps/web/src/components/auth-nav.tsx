"use client";

import Link from "next/link";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

export function AuthNav({ user }: { user: User | null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-full bg-green-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-green-700"
      >
        Log in
      </Link>
    );
  }

  const initial = (user.email?.[0] ?? "U").toUpperCase();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700 transition hover:bg-green-200"
      >
        {initial}
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl bg-white py-2 shadow-lg ring-1 ring-gray-100">
            <p className="border-b border-gray-100 px-4 pb-2 text-xs text-gray-400 truncate">
              {user.email}
            </p>
            <Link
              href="/profile"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Profile & DUPR
            </Link>
            <button
              onClick={handleLogout}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
