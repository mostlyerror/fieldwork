import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase-server";

export async function getUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getUserProfile() {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data;
}

export async function getUserRole(): Promise<string | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return data?.role ?? null;
}

export async function requireAdmin() {
  const role = await getUserRole();
  if (role !== "admin") redirect("/login");
}
