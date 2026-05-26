import Link from "next/link";
import type { City } from "@/lib/cities";
import type { User } from "@supabase/supabase-js";
import { AuthNav } from "./auth-nav";

export function Header({
  city,
  user,
}: {
  city?: City;
  user?: User | null;
}) {
  const cityName = city?.name ?? "Houston";
  const homeHref = city ? `/${city.slug}` : "/";

  return (
    <nav className="bg-[#FFFDF7] border-b-2 border-[#1a1a1a]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link
          href={homeHref}
          className="font-sans text-xl font-black text-[#1a1a1a] tracking-tight hover:opacity-80 transition-opacity"
          style={{ letterSpacing: "-0.5px" }}
        >
          PickleRadar
        </Link>

        <div className="flex items-center gap-6">
          <span className="hidden sm:inline text-sm font-medium text-gray-400">
            {cityName}
          </span>
          <Link
            href="/submit"
            className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors whitespace-nowrap"
          >
            + Submit
          </Link>
          {user !== undefined && <AuthNav user={user} />}
        </div>
      </div>
    </nav>
  );
}
