"use server";

import { createAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export async function loginAction(formData: FormData) {
  const password = formData.get("password") as string;
  const secret = process.env.ADMIN_SECRET;

  console.log("[login] password length:", password?.length, "secret length:", secret?.length);
  console.log("[login] match:", password === secret);

  if (!password || !secret || password !== secret) {
    redirect("/admin/login?error=1");
  }
  await createAdminSession();
  redirect("/admin");
}
