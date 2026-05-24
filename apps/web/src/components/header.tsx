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
    <nav className="bg-[#FFFDF7]/90 backdrop-blur-md border-b border-orange-100/50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href={homeHref} className="flex items-center gap-2.5 group">
          <span className="text-4xl transition-transform group-hover:rotate-12 group-hover:scale-110">{"\u{1F3D3}"}</span>
          <div>
            <span className="block text-xl font-extrabold text-emerald-600">
              PickleRadar
            </span>
            <span className="block text-[11px] font-medium text-emerald-600/50">
              Your {cityName} pickleball community
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/submit"
            className="rounded-full border-2 border-emerald-200 bg-emerald-50/50 px-4 py-1.5 text-sm font-bold text-emerald-700 transition-all hover:bg-emerald-100 hover:border-emerald-300 hover:scale-105"
          >
            + Submit
          </Link>
          {user !== undefined && <AuthNav user={user} />}
        </div>
      </div>
    </nav>
  );
}
