import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AdminNav } from "@/components/admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/50 via-white to-amber-50/30">
      <AdminNav
        logoutAction={async () => {
          "use server";
          const supabase = await createSupabaseServerClient();
          await supabase.auth.signOut();
          redirect("/login");
        }}
      />
      <main className="mx-auto max-w-full px-[33px] py-6">{children}</main>
    </div>
  );
}
