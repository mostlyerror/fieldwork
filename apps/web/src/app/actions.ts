"use server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

type SubscribeResult =
  | { status: "success" }
  | { status: "already_subscribed" }
  | { status: "error"; message: string };

export async function subscribeEmail(formData: FormData): Promise<SubscribeResult> {
  const email = formData.get("email");

  if (typeof email !== "string" || !email) {
    return { status: "error", message: "Email is required." };
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  const supabase = getSupabaseAdmin();

  // Check if already subscribed (active)
  const { data: existing } = await supabase
    .from("email_subscribers")
    .select("id, status")
    .eq("email", email.toLowerCase())
    .limit(1)
    .single();

  if (existing) {
    if (existing.status === "active") {
      return { status: "already_subscribed" };
    }
    // Re-activate if previously unsubscribed
    await supabase
      .from("email_subscribers")
      .update({ status: "active" })
      .eq("id", existing.id);
    return { status: "success" };
  }

  const { error } = await supabase
    .from("email_subscribers")
    .insert({ email: email.toLowerCase() });

  if (error) {
    // Unique constraint violation = already subscribed
    if (error.code === "23505") {
      return { status: "already_subscribed" };
    }
    console.error("Failed to subscribe email:", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  return { status: "success" };
}
