"use server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

function verifySecret(secret: string | null) {
  const expected = process.env.ADMIN_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("Unauthorized");
  }
}

export async function approveTournament(id: string, secret: string) {
  verifySecret(secret);
  const { error } = await getSupabaseAdmin()
    .from("tournaments")
    .update({ status: "active" })
    .eq("id", id);
  if (error) throw new Error("Failed to approve tournament");
  return { success: true };
}

export async function rejectTournament(id: string, secret: string) {
  verifySecret(secret);
  const { error } = await getSupabaseAdmin()
    .from("tournaments")
    .delete()
    .eq("id", id);
  if (error) throw new Error("Failed to reject tournament");
  return { success: true };
}
