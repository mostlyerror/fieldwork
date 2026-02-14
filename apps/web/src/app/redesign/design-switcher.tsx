"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const designs = [
  { num: 1, href: "/redesign/1" },
  { num: 2, href: "/redesign/2" },
  { num: 3, href: "/redesign/3" },
  { num: 4, href: "/redesign/4" },
  { num: 5, href: "/redesign/5" },
];

export default function DesignSwitcher() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-1.5 rounded-full border border-white/10 bg-gray-900/90 px-3 py-2 shadow-2xl shadow-black/20 backdrop-blur-xl">
      {designs.map((d) => {
        const isActive = pathname === d.href;
        return (
          <Link
            key={d.num}
            href={d.href}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all duration-200 ${
              isActive
                ? "scale-110 bg-green-600 text-white shadow-lg shadow-green-600/40"
                : "text-white/40 hover:bg-white/10 hover:text-white"
            }`}
          >
            {d.num}
          </Link>
        );
      })}
    </div>
  );
}
