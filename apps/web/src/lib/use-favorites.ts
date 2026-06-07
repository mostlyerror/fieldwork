"use client";

import { useEffect, useState } from "react";

/**
 * Client-side favorites — a list of players you're tracking, persisted in
 * localStorage (no account needed). We store enough to render the favorites list
 * without a fetch (name + rating + location). A custom event keeps every mounted
 * hook (e.g. a profile star + the header) in sync within the tab; the native
 * `storage` event syncs across tabs.
 */

const KEY = "pr:favorites:v1";
const EVT = "pr:favorites";

export interface FavPlayer {
  id: string;
  name: string;
  doubles: number | null;
  location: string | null;
}

function read(): FavPlayer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FavPlayer[]) : [];
  } catch {
    return [];
  }
}

function write(list: FavPlayer[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* private mode / quota exceeded — ignore */
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavPlayer[]>([]);
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

  const isFavorite = (id: string) => favorites.some((f) => f.id === id);
  const toggle = (f: FavPlayer) => {
    const cur = read();
    write(cur.some((x) => x.id === f.id) ? cur.filter((x) => x.id !== f.id) : [f, ...cur]);
  };
  const remove = (id: string) => write(read().filter((x) => x.id !== id));

  return { favorites, isFavorite, toggle, remove, ready };
}
