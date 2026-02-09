"use server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";

export async function approveTournament(id: string) {
  await requireAdmin();
  const { error } = await getSupabaseAdmin()
    .from("tournaments")
    .update({ status: "active" })
    .eq("id", id);
  if (error) throw new Error("Failed to approve tournament");
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
