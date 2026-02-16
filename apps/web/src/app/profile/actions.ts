"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

export async function searchPlayers(query: string) {
  if (!query || query.length < 2) return [];

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("event_players")
    .select("player_name, dupr_rating")
    .ilike("player_name", `%${query}%`)
    .not("dupr_rating", "is", null)
    .order("dupr_rating", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error searching players:", error);
    return [];
  }

  // Deduplicate by name, keep highest rating
  const seen = new Map<string, { player_name: string; dupr_rating: number }>();
  for (const row of data ?? []) {
    const key = row.player_name.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, {
        player_name: row.player_name,
        dupr_rating: row.dupr_rating,
      });
    }
  }

  return Array.from(seen.values());
}

export async function linkDuprRating(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const ratingDoubles = formData.get("dupr_rating_doubles") as string;
  const ratingSingles = formData.get("dupr_rating_singles") as string;
  const name = formData.get("name") as string;

  const updates: Record<string, unknown> = {};
  if (ratingDoubles) updates.dupr_rating_doubles = parseFloat(ratingDoubles);
  if (ratingSingles) updates.dupr_rating_singles = parseFloat(ratingSingles);
  if (name) updates.name = name;
  updates.dupr_last_synced = new Date().toISOString();

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("users")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  return { success: true };
}

export async function updateProfile(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const name = formData.get("name") as string;
  const skillLevel = formData.get("skill_level") as string;

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("users")
    .update({
      name: name || null,
      skill_level: skillLevel || null,
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  return { success: true };
}
