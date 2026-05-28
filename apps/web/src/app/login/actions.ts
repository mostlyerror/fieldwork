"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { posthogServer } from "@/lib/posthog-server";

function isDevEnvironment() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL !==
    process.env.NEXT_PUBLIC_SUPABASE_PROD_URL
  );
}

export async function devLogin(role: "admin" | "user") {
  if (!isDevEnvironment()) {
    throw new Error("devLogin is only available in the dev environment");
  }

  const email =
    role === "admin"
      ? process.env.DEV_ADMIN_EMAIL
      : process.env.DEV_USER_EMAIL;
  const password =
    role === "admin"
      ? process.env.DEV_ADMIN_PASSWORD
      : process.env.DEV_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(`Missing DEV_${role.toUpperCase()}_EMAIL or DEV_${role.toUpperCase()}_PASSWORD env vars`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const admin = getSupabaseAdmin();
    await admin.from("users").upsert(
      { id: user.id, email: user.email },
      { onConflict: "id" },
    );

    const { data: profile } = await admin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "admin") {
      redirect("/admin");
    }
  }

  redirect("/");
}

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectTo = (formData.get("redirect") as string) || "/";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Ensure user row exists in the users table
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const admin = getSupabaseAdmin();
    await admin.from("users").upsert(
      { id: user.id, email: user.email },
      { onConflict: "id" },
    );

    posthogServer?.capture({
      distinctId: user.id,
      event: "user_logged_in",
      properties: {
        $set: { email: user.email },
      },
    });

    // Check role for admin redirect
    const { data: profile } = await admin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "admin") {
      redirect("/admin");
    }
  }

  redirect(redirectTo);
}
