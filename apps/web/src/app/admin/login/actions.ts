"use server";

import { createAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export async function loginAction(formData: FormData) {
  const password = formData.get("password") as string;
  const secret = process.env.ADMIN_SECRET;
  if (!password || !secret || password !== secret) {
    redirect("/admin/login?error=1");
  }
  await createAdminSession();
  redirect("/admin");
}
