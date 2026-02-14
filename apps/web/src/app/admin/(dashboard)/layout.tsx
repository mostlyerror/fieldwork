import { redirect } from "next/navigation";
import { requireAdmin, destroyAdminSession } from "@/lib/admin-auth";
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
          await destroyAdminSession();
          redirect("/admin/login");
        }}
      />
      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-10">{children}</main>
    </div>
  );
}
