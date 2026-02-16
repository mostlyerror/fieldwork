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
    <nav className="bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href={homeHref} className="flex items-center gap-2">
          <span className="text-3xl">{"\u{1F3D3}"}</span>
          <div>
            <span className="block text-xl font-bold text-green-700">
              PickleRadar
            </span>
            <span className="block text-[11px] text-gray-400">
              Your {cityName} pickleball community
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/submit"
            className="rounded-full border border-green-200 px-3 py-1 text-sm font-medium text-green-700 transition hover:bg-green-50"
          >
            + Submit
          </Link>
          {user !== undefined && <AuthNav user={user} />}
        </div>
      </div>
    </nav>
  );
}
