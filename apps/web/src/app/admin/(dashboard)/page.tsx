import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { approveTournament, rejectTournament } from "./actions";

export default async function AdminPage() {
  const { data: pending } = await getSupabaseAdmin()
    .from("tournaments")
    .select("*")
    .eq("status", "pending_review")
    .order("created_at", { ascending: false });

  const tournaments = pending ?? [];

  return (
    <>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">
          Pending Tournaments
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {tournaments.length} submission{tournaments.length !== 1 && "s"}{" "}
          awaiting review
        </p>
      </div>

      {tournaments.length === 0 ? (
        <div className="rounded-2xl bg-white p-16 text-center shadow-sm ring-1 ring-gray-100">
          <p className="text-4xl">{"\u{1F3D3}"}</p>
          <p className="mt-3 text-lg font-bold text-gray-300">All clear</p>
          <p className="mt-1 text-sm text-gray-400">
            No pending submissions right now.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tournaments.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition duration-200 hover:shadow-md hover:ring-green-200"
            >
              <div className="mb-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-gray-800">
                    {t.name}
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {formatDateRange(t.date_start, t.date_end)} &middot;{" "}
                    {t.location_name}
                  </p>
                </div>
                {t.entry_fee != null && (
                  <span className="shrink-0 text-sm font-bold text-green-600">
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
                <p className="mb-3 whitespace-pre-line text-sm leading-relaxed text-gray-600">
                  {t.description}
                </p>
              )}

              {t.registration_url && (
                <a
                  href={t.registration_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-4 inline-block text-xs text-green-600 underline decoration-green-200 underline-offset-2 hover:text-green-700"
                >
                  {t.registration_url}
                </a>
              )}

              <div className="flex gap-2 border-t border-gray-100 pt-4">
                <form
                  action={async () => {
                    "use server";
                    await approveTournament(t.id);
                    redirect("/admin");
                  }}
                >
                  <button
                    type="submit"
                    className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
                  >
                    Approve
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await rejectTournament(t.id);
                    redirect("/admin");
                  }}
                >
                  <button
                    type="submit"
                    className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-red-600 ring-1 ring-gray-200 transition hover:ring-red-300"
                  >
                    Reject
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
