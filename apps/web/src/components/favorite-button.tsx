"use client";

import { useFavorites, type FavItem } from "@/lib/use-favorites";

function Star({ filled, className = "h-4 w-4" }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m12 3 2.6 5.6 6.1.7-4.5 4.1 1.2 6L12 16.9 6.6 19.5l1.2-6-4.5-4.1 6.1-.7z" />
    </svg>
  );
}

/** Toggle a player / tournament / venue in your local favorites. */
export function FavoriteButton({
  item,
  compact = false,
}: {
  item: FavItem;
  compact?: boolean;
}) {
  const { isFavorite, toggle, ready } = useFavorites();
  const fav = ready && isFavorite(item.kind, item.id);

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => toggle(item)}
        aria-pressed={fav}
        aria-label={fav ? "Remove from favorites" : "Add to favorites"}
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition active:scale-95 ${
          fav
            ? "border-amber-300 bg-amber-50 text-amber-500"
            : "border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600"
        }`}
      >
        <Star filled={fav} className="h-[18px] w-[18px]" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => toggle(item)}
      aria-pressed={fav}
      className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 t-body font-bold transition active:scale-[0.98] ${
        fav
          ? "border-amber-300 bg-amber-50 text-amber-700"
          : "border-gray-200 bg-white text-gray-600 shadow-card hover:border-gray-300"
      }`}
    >
      <Star filled={fav} />
      {fav ? "Favorited" : "Favorite"}
    </button>
  );
}
