import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { PendingTournamentCard } from "@/components/pending-tournament-card";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function AdminPage() {
  const supabase = getSupabaseAdmin();

  const [
    { data: pending },
    { count: activeCount },
    { count: subscriberCount },
    { data: lastScrapeData },
  ] = await Promise.all([
    supabase
      .from("tournaments")
      .select("*")
      .eq("status", "pending_review")
      .order("created_at", { ascending: false }),
    supabase
      .from("tournaments")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("email_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("scraper_runs")
      .select("started_at, status")
      .order("started_at", { ascending: false })
      .limit(1),
  ]);

  const tournaments = pending ?? [];
  const lastScrape = lastScrapeData?.[0] ?? null;

  const stats = [
    {
      label: "Pending Review",
      value: tournaments.length,
      color: "text-amber-600",
      bg: "bg-amber-50 ring-amber-100",
    },
    {
      label: "Active Tournaments",
      value: activeCount ?? 0,
      color: "text-green-600",
      bg: "bg-green-50 ring-green-100",
    },
    {
      label: "Email Subscribers",
      value: subscriberCount ?? 0,
      color: "text-blue-600",
      bg: "bg-blue-50 ring-blue-100",
    },
    {
      label: "Last Scrape",
      value: lastScrape ? timeAgo(lastScrape.started_at) : "never",
      color: "text-gray-600",
      bg: "bg-gray-50 ring-gray-100",
    },
  ];

  return (
    <>
      {/* Quick stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl p-4 shadow-sm ring-1 ${stat.bg}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {stat.label}
            </p>
            <p className={`mt-1 text-2xl font-bold ${stat.color}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Pending Review</h1>
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
            <PendingTournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      )}
    </>
  );
}
