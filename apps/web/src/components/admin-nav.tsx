"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ADMIN_STATUS } from "@/lib/admin-status";

type AttentionLevel = "attention" | "critical";

const NAV_ITEMS: {
  href: string;
  label: string;
}[] = [
  { href: "/admin", label: "Review" },
  { href: "/admin/tournaments", label: "All Tournaments" },
  { href: "/admin/audience", label: "Audience" },
  { href: "/admin/scraping", label: "Scraping" },
  { href: "/admin/flyer-import", label: "Flyer Import" },
];

export function AdminNav({
  logoutAction,
  attention,
}: {
  logoutAction: () => Promise<void>;
  /**
   * Per-section attention dots, keyed by nav href.
   * Wiring the actual per-section computation happens in a later step —
   * this just renders a small colored dot when a level is provided.
   */
  attention?: Partial<Record<string, AttentionLevel>>;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-emerald-900/10 bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex h-[52px] max-w-full items-center justify-between px-[22px]">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">{"\u{1F3D3}"}</span>
            <span className="text-[17px] font-extrabold tracking-tight text-emerald-800">
              PickleRadar
            </span>
          </Link>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.09em] text-emerald-700">
            Admin
          </span>
        </div>

        {/* Nav links + logout */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label }) => {
            const isActive =
              href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(href);
            const level = attention?.[href];
            return (
              <Link
                key={href}
                href={href}
                className={`relative rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-emerald-900/55 hover:text-emerald-900"
                }`}
              >
                {label}
                {level && (
                  <span
                    aria-hidden="true"
                    className={`absolute right-1 top-1 h-2 w-2 rounded-full ring-2 ${
                      ADMIN_STATUS[level].dot
                    } ${isActive ? "ring-emerald-600" : "ring-cream"}`}
                  />
                )}
              </Link>
            );
          })}
          <div className="ml-2 border-l border-emerald-900/10 pl-3">
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full px-3 py-1.5 text-sm font-semibold text-emerald-900/40 transition hover:text-emerald-900/70"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
