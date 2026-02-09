"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const designs = [
  { num: 1, href: "/redesign/1" },
  { num: 2, href: "/redesign/2" },
  { num: 3, href: "/redesign/3" },
  { num: 4, href: "/redesign/4" },
  { num: 5, href: "/redesign/5" },
  { num: 6, href: "/redesign/6" },
  { num: 7, href: "/redesign/7" },
  { num: 8, href: "/redesign/8" },
  { num: 9, href: "/redesign/9" },
  { num: 10, href: "/redesign/10" },
];

export default function DesignSwitcher() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-1 rounded-full border border-gray-200 bg-white/90 px-2.5 py-1.5 shadow-lg backdrop-blur-xl">
      {designs.map((d) => {
        const isActive = pathname === d.href;
        return (
          <Link
            key={d.num}
            href={d.href}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ${
              isActive
                ? "scale-110 bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            {d.num}
          </Link>
        );
      })}
    </div>
  );
}
