import Link from "next/link";
import type { City } from "@/lib/cities";
import { PaddleIcon } from "./paddle-icon";

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
          className="group inline-flex items-center gap-2 font-sans text-xl font-black text-[#1a1a1a] tracking-tight transition-opacity hover:opacity-80"
          style={{ letterSpacing: "-0.5px" }}
        >
          <PaddleIcon size={26} className="transition-transform duration-300 group-hover:-rotate-12" />
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
        </div>
      </div>
    </nav>
  );
}
