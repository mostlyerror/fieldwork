"use client";

import { useEffect, useState } from "react";

/**
 * Client-side favorites — players, tournaments, and venues you're tracking,
 * persisted in localStorage (no account needed). Each item stores enough to
 * render the favorites list without a fetch (title + subtitle + meta + href). A
 * custom event keeps every mounted hook in sync within the tab; the native
 * `storage` event syncs across tabs.
 */

const KEY = "pr:favorites:v1";
const EVT = "pr:favorites";

export type FavKind = "player" | "tournament" | "venue";

export interface FavItem {
  kind: FavKind;
  id: string; // unique within its kind (player id, tournament id, venue slug)
  href: string;
  title: string;
  subtitle: string | null;
  meta: string | null; // right-aligned (e.g. a rating or a date)
}

type LegacyPlayer = { id: string; name: string; doubles: number | null; location: string | null };

function normalize(raw: unknown): FavItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.kind === "string" && typeof o.id === "string" && typeof o.href === "string") {
    return o as unknown as FavItem;
  }
  // Migrate the old player-only shape.
  if (typeof o.id === "string" && typeof o.name === "string") {
    const p = o as unknown as LegacyPlayer;
    return {
      kind: "player",
      id: p.id,
      href: `/players/${p.id}`,
      title: p.name,
      subtitle: p.location ?? null,
      meta: p.doubles != null ? p.doubles.toFixed(2) : null,
    };
  }
  return null;
}

function read(): FavItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as unknown[]).map(normalize).filter((x): x is FavItem => x != null);
  } catch {
    return [];
  }
}

function write(list: FavItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* private mode / quota exceeded — ignore */
  }
}

const sameItem = (a: FavItem, kind: FavKind, id: string) => a.kind === kind && a.id === id;

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFavorites(read());
    setReady(true);
    const sync = () => setFavorites(read());
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const isFavorite = (kind: FavKind, id: string) => favorites.some((f) => sameItem(f, kind, id));
  const toggle = (item: FavItem) => {
    const cur = read();
    write(
      cur.some((x) => sameItem(x, item.kind, item.id))
        ? cur.filter((x) => !sameItem(x, item.kind, item.id))
        : [item, ...cur],
    );
  };
  const remove = (kind: FavKind, id: string) => write(read().filter((x) => !sameItem(x, kind, id)));

  return { favorites, isFavorite, toggle, remove, ready };
}
