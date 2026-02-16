import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";
import { CITIES, getNearestCity } from "@/lib/cities";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://pickleradar.app";

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, latitude, longitude, updated_at")
    .eq("status", "active")
    .order("date_start", { ascending: false });

  const tournamentEntries: MetadataRoute.Sitemap = (tournaments ?? []).map(
    (t) => {
      const citySlug =
        t.latitude != null && t.longitude != null
          ? getNearestCity(t.latitude, t.longitude).slug
          : "houston";
      return {
        url: `${baseUrl}/${citySlug}/tournaments/${t.id}`,
        lastModified: new Date(t.updated_at),
        changeFrequency: "daily" as const,
        priority: 0.8,
      };
    },
  );

  const cityEntries: MetadataRoute.Sitemap = Object.values(CITIES).map(
    (city) => ({
      url: `${baseUrl}/${city.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1,
    }),
  );

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...cityEntries,
    {
      url: `${baseUrl}/submit`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    ...tournamentEntries,
  ];
}
