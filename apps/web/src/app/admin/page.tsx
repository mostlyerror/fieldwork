import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { approveTournament, rejectTournament } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ key?: string }> };

export default async function AdminPage({ searchParams }: PageProps) {
  const { key } = await searchParams;

  if (!key || key !== process.env.ADMIN_SECRET) {
    redirect("/");
  }

  const { data: pending } = await getSupabaseAdmin()
    .from("tournaments")
    .select("*")
    .eq("status", "pending_review")
    .order("created_at", { ascending: false });

  const tournaments = pending ?? [];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-2 text-2xl font-bold text-gray-800">
          Admin: Pending Tournaments
        </h1>
        <p className="mb-8 text-sm text-gray-500">
          {tournaments.length} tournament(s) awaiting review
        </p>

        {tournaments.length === 0 ? (
          <p className="rounded-xl bg-white p-8 text-center text-gray-400 shadow-sm">
            No pending submissions.
          </p>
        ) : (
          <div className="space-y-4">
            {tournaments.map((t) => (
              <div
                key={t.id}
                className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
              >
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">
                      {t.name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {formatDateRange(t.date_start, t.date_end)} &middot;{" "}
                      {t.location_name}
                    </p>
                  </div>
                  {t.entry_fee != null && (
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(t.entry_fee)}
                    </span>
                  )}
                </div>

                {t.location_address && (
                  <p className="mb-2 text-xs text-gray-400">
                    {t.location_address}
                  </p>
                )}

                {t.description && (
                  <p className="mb-3 whitespace-pre-line text-sm text-gray-600">
                    {t.description}
                  </p>
                )}

                {t.registration_url && (
                  <a
                    href={t.registration_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-4 inline-block text-xs text-green-600 underline"
                  >
                    {t.registration_url}
                  </a>
                )}

                <div className="flex gap-2 border-t border-gray-100 pt-4">
                  <form
                    action={async () => {
                      "use server";
                      await approveTournament(t.id, key!);
                      redirect(`/admin?key=${key}`);
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                    >
                      Approve
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await rejectTournament(t.id, key!);
                      redirect(`/admin?key=${key}`);
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-lg bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-200"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
