"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ADMIN_STATUS } from "@/lib/admin-status";

type AttentionLevel = "attention" | "critical";

/**
 * Compact tab labels for the mobile bottom bar — the desktop bar uses the
 * full `label`, mobile uses `short` so five tabs fit at ~360px.
 */
const NAV_ITEMS: {
  href: string;
  label: string;
  short: string;
  icon: (props: { className?: string }) => React.ReactElement;
}[] = [
  { href: "/admin", label: "Review", short: "Review", icon: IconReview },
  {
    href: "/admin/tournaments",
    label: "All Tournaments",
    short: "Tourneys",
    icon: IconTrophy,
  },
  { href: "/admin/audience", label: "Audience", short: "Audience", icon: IconUsers },
  { href: "/admin/scraping", label: "Scraping", short: "Scraping", icon: IconRadar },
  {
    href: "/admin/flyer-import",
    label: "Flyer Import",
    short: "Flyer",
    icon: IconImage,
  },
];

function isActiveRoute(href: string, pathname: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

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
    <>
      {/* ---------- DESKTOP TOP BAR (lg+) ---------- */}
      <header className="sticky top-0 z-30 hidden border-b border-emerald-900/10 bg-cream/85 backdrop-blur-md lg:block">
        <div className="mx-auto flex h-[52px] w-full max-w-[1800px] items-center justify-between px-6 lg:px-8">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl">{"\u{1F3D3}"}</span>
              <span className="t-h3 font-extrabold tracking-tight text-emerald-800">
                PickleRadar
              </span>
            </Link>
            <span className="t-label rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
              Admin
            </span>
          </div>

          {/* Nav links + logout */}
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label }) => {
              const isActive = isActiveRoute(href, pathname);
              const level = attention?.[href];
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={`t-body relative rounded-full px-3.5 py-1.5 font-semibold transition ${
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
                  className="t-body rounded-full px-3 py-1.5 font-semibold text-emerald-900/40 transition hover:text-emerald-900/70"
                >
                  Log out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- MOBILE TOP BAR (<lg): brand + logout ---------- */}
      <header className="sticky top-0 z-30 flex h-[52px] items-center justify-between border-b border-emerald-900/10 bg-cream/90 px-4 backdrop-blur-md lg:hidden">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="text-lg">{"\u{1F3D3}"}</span>
          <span className="t-h3 truncate font-extrabold tracking-tight text-emerald-800">
            PickleRadar
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-700">
            Admin
          </span>
        </Link>
        <form action={logoutAction} className="flex-none">
          <button
            type="submit"
            className="t-body -mr-1 inline-flex min-h-[44px] items-center rounded-full px-3 font-semibold text-emerald-900/45 transition active:text-emerald-900/70"
          >
            Log out
          </button>
        </form>
      </header>

      {/* ---------- MOBILE BOTTOM TAB BAR (<lg) ---------- */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-50 flex border-t border-emerald-900/10 bg-cream/95 backdrop-blur-md lg:hidden"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxShadow: "0 -8px 24px -16px rgba(0,0,0,.18)",
        }}
      >
        {NAV_ITEMS.map(({ href, short, icon: Icon }) => {
          const isActive = isActiveRoute(href, pathname);
          const level = attention?.[href];
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`t-caption relative flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 font-bold leading-none transition active:opacity-60 ${
                isActive ? "text-emerald-700" : "text-emerald-900/45"
              }`}
            >
              <span
                className={`grid h-6 w-10 place-items-center rounded-full transition ${
                  isActive
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "text-emerald-900/55"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                {level && (
                  <span
                    aria-hidden="true"
                    className={`absolute right-[18%] top-1 h-2 w-2 rounded-full ring-2 ring-cream ${ADMIN_STATUS[level].dot}`}
                  />
                )}
              </span>
              <span className="max-w-full truncate">{short}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Inline icons — stroked, 24x24 viewBox, inherit `currentColor`.
 * ------------------------------------------------------------------ */

function IconReview({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function IconTrophy({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconRadar({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34" />
      <path d="M4 6h.01" />
      <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35" />
      <path d="M16.24 7.76A6 6 0 1 0 8.23 16.67" />
      <path d="M12 18h.01" />
      <path d="M17.99 11.66A6 6 0 0 1 15.77 16.67" />
      <circle cx="12" cy="12" r="2" />
      <path d="m13.41 10.59 5.66-5.66" />
    </svg>
  );
}

function IconImage({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}
