import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AdminNav } from "@/components/admin-nav";
import { ToastProvider } from "@/components/admin/toast";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <ToastProvider>
      <div className="min-h-screen bg-cream text-emerald-950">
        <AdminNav
          logoutAction={async () => {
            "use server";
            const supabase = await createSupabaseServerClient();
            await supabase.auth.signOut();
            redirect("/login");
          }}
        />
        <main className="mx-auto max-w-[1180px] px-6 py-7">{children}</main>
      </div>
    </ToastProvider>
  );
}
