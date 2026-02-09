"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/admin", label: "Tournaments" },
  { href: "/admin/social", label: "Social Queue" },
];

export function AdminNav({
  logoutAction,
}: {
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3 lg:px-10">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <span className="text-xl">{"\u{1F3D3}"}</span>
          <span className="text-lg font-bold text-green-700">PickleRadar</span>
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-green-600">
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
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-green-600 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-800 hover:ring-1 hover:ring-gray-200"
                }`}
              >
                {label}
              </Link>
            );
          })}
          <div className="ml-2 border-l border-gray-200 pl-3">
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full px-3 py-1.5 text-sm font-medium text-gray-400 transition hover:text-gray-600"
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
