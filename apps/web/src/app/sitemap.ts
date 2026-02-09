import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://pickleradar.app";

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, updated_at")
    .eq("status", "active")
    .order("date_start", { ascending: false });

  const tournamentEntries: MetadataRoute.Sitemap = (tournaments ?? []).map(
    (t) => ({
      url: `${baseUrl}/tournaments/${t.id}`,
      lastModified: new Date(t.updated_at),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })
  );

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/submit`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    ...tournamentEntries,
  ];
}
