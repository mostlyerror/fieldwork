import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { AdminTournamentsTable } from "@/components/admin-tournaments-table";

export default async function AllTournamentsPage() {
  const { data } = await getSupabaseAdmin()
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return <AdminTournamentsTable tournaments={data ?? []} />;
}
