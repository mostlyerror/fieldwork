"use client";

import Link from "next/link";
import { useFavorites, type FavKind } from "@/lib/use-favorites";

const SECTIONS: { kind: FavKind; label: string }[] = [
  { kind: "player", label: "Players" },
  { kind: "tournament", label: "Tournaments" },
  { kind: "venue", label: "Venues" },
];

function Star() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="m12 3 2.6 5.6 6.1.7-4.5 4.1 1.2 6L12 16.9 6.6 19.5l1.2-6-4.5-4.1 6.1-.7z" />
    </svg>
  );
}

/** Grouped favorites list — reads localStorage; renders nothing until mounted. */
export function FavoritesList() {
  const { favorites, remove, ready } = useFavorites();
  if (!ready) return null;

  if (favorites.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200/70 bg-white p-8 text-center shadow-card sm:rounded-3xl">
        <p className="t-body font-semibold text-gray-500">No favorites yet</p>
        <p className="mt-1 t-small text-gray-400">
          Tap the star on a player, tournament, or venue to track it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {SECTIONS.map(({ kind, label }) => {
        const items = favorites.filter((f) => f.kind === kind);
        if (items.length === 0) return null;
        return (
          <section key={kind}>
            <h2 className="mb-2 flex items-baseline gap-2 px-0.5 t-label text-gray-400">
              {label}
              <span className="t-caption tabular-nums text-gray-300">{items.length}</span>
            </h2>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-card sm:rounded-3xl">
              {items.map((f) => (
                <div key={`${f.kind}:${f.id}`} className="flex items-center gap-3 px-4 py-3.5">
                  <Link href={f.href} className="min-w-0 flex-1">
                    <p className="truncate t-body font-semibold text-gray-900 hover:text-emerald-700">{f.title}</p>
                    {f.subtitle && <p className="truncate t-caption text-gray-400">{f.subtitle}</p>}
                  </Link>
                  {f.meta && (
                    <span className="shrink-0 t-body font-bold tabular-nums text-emerald-800">{f.meta}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(f.kind, f.id)}
                    aria-label={`Remove ${f.title} from favorites`}
                    className="shrink-0 rounded-full p-2 text-amber-500 transition hover:bg-amber-50"
                  >
                    <Star />
                  </button>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
