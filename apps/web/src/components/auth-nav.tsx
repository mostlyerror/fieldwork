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
        className="whitespace-nowrap text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
      >
        Sign in
      </Link>
    );
  }

  const displayName = user.user_metadata?.full_name as string | undefined;
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
        className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
      >
        {displayName ?? initial}
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-48 rounded-none border border-[#1a1a1a] bg-[#FFFDF7] py-2 shadow-md">
            <p className="border-b border-gray-200 px-4 pb-2 text-xs text-gray-400 truncate">
              {user.email}
            </p>
            <Link
              href="/profile"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Profile
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
