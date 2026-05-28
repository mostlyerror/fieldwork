"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { posthogServer } from "@/lib/posthog-server";

export async function signup(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = (formData.get("name") as string) || null;
  const redirectTo = (formData.get("redirect") as string) || "/profile";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Create user row
  if (data.user) {
    const admin = getSupabaseAdmin();
    await admin.from("users").upsert(
      {
        id: data.user.id,
        email: data.user.email,
        name,
      },
      { onConflict: "id" },
    );
    posthogServer?.capture({
      distinctId: data.user.id,
      event: "user_signed_up",
      properties: {
        $set: { email: data.user.email, name: name ?? null },
        $set_once: { first_seen: new Date().toISOString() },
      },
    });
  }

  redirect(redirectTo);
}
