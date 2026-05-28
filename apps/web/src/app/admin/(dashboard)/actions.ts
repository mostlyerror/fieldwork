"use server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth";
import { posthogServer } from "@/lib/posthog-server";

export async function approveTournament(id: string) {
  await requireAdmin();
  const { error } = await getSupabaseAdmin()
    .from("tournaments")
    .update({ status: "active" })
    .eq("id", id);
  if (error) throw new Error("Failed to approve tournament");
  posthogServer?.capture({
    distinctId: "pickleradar-admin",
    event: "tournament_approved",
    properties: { tournament_id: id },
  });
  return { success: true };
}

export async function rejectTournament(id: string) {
  await requireAdmin();
  const { error } = await getSupabaseAdmin()
    .from("tournaments")
    .delete()
    .eq("id", id);
  if (error) throw new Error("Failed to reject tournament");
  return { success: true };
}

export async function updateAndApproveTournament(
  id: string,
  fields: {
    name?: string;
    date_start?: string;
    date_end?: string | null;
    location_name?: string;
    location_address?: string | null;
    entry_fee?: number | null;
    skill_levels?: string[] | null;
    format?: string | null;
    description?: string | null;
  }
) {
  await requireAdmin();
  const { error } = await getSupabaseAdmin()
    .from("tournaments")
    .update({ ...fields, status: "active" })
    .eq("id", id);
  if (error) throw new Error("Failed to approve tournament");
  return { success: true };
}
