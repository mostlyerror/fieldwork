"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { posthogServer } from "@/lib/posthog-server";

// Hard gate for the one-click dev-login bypass: it must be IMPOSSIBLE in
// production. NODE_ENV is "production" on every Vercel build (prod AND preview)
// and "development" under `next dev`, so this is safe-by-construction — it can't
// drift via a missing/forgotten env var the way the old URL-comparison gate could.
// Defense-in-depth on top of this: the localhost-only UI check in dev-quick-login,
// and devLogin still requires DEV_ADMIN_* / DEV_USER_* creds to exist at all.
function isDevEnvironment() {
  return process.env.NODE_ENV !== "production";
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
