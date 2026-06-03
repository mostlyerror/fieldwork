import Link from "next/link";
import type { City } from "@/lib/cities";
import { LogoMark } from "./logo-mark";

export function Header({
  city,
}: {
  city?: City;
  user?: unknown;
}) {
  const cityName = city?.name ?? "Houston";
  const homeHref = city ? `/${city.slug}` : "/";

  return (
    <nav className="bg-[#FFFDF7] border-b-2 border-[#1a1a1a]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-3 sm:px-5 py-4">
        <Link
          href={homeHref}
          className="group inline-flex items-center gap-2 font-sans t-h2 font-black text-[#1a1a1a] transition-opacity hover:opacity-80"
          style={{ letterSpacing: "-0.5px" }}
        >
          <LogoMark size={28} className="transition-transform duration-500 group-hover:rotate-45" />
          PickleRadar
        </Link>

        <div className="flex items-center gap-6">
          <span className="hidden sm:inline t-body text-gray-400">
            {cityName}
          </span>
          <Link
            href="/submit"
            className="t-body text-gray-500 hover:text-gray-900 transition-colors whitespace-nowrap"
          >
            + Submit
          </Link>
        </div>
      </div>
    </nav>
  );
}
