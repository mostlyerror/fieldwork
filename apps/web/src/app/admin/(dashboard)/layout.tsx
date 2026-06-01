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
        <main className="mx-auto w-full max-w-[1800px] px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-7 lg:pb-7">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
