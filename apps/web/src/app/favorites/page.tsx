import type { Metadata } from "next";
import { ServerHeader } from "@/components/server-header";
import { FavoritesList } from "@/components/favorites-list";
import { getDefaultCity } from "@/lib/cities";

export const metadata: Metadata = {
  title: "Your Favorites — PickleRadar",
  description: "Players you're tracking on PickleRadar.",
};

export default function FavoritesPage() {
  const city = getDefaultCity();
  return (
    <div className="min-h-screen bg-background">
      <ServerHeader city={city} />
      <main className="mx-auto max-w-2xl px-3 py-8 sm:px-5">
        <h1 className="t-h1 text-foreground">Favorites</h1>
        <p className="mb-6 mt-1 t-body text-gray-500">Players you&apos;re tracking — saved on this device.</p>
        <FavoritesList />
      </main>
    </div>
  );
}
