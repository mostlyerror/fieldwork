import { getSupabaseAdmin } from "@/lib/supabase-admin";

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

export default async function SubscribersPage() {
  const supabase = getSupabaseAdmin();

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const [
    { data: subscribers },
    { count: activeCount },
    { count: unsubscribedCount },
    { count: newThisWeek },
  ] = await Promise.all([
    supabase
      .from("email_subscribers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("email_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("email_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "unsubscribed"),
    supabase
      .from("email_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .gte("created_at", sevenDaysAgo),
  ]);

  const allSubscribers = subscribers ?? [];

  const stats = [
    {
      label: "Active Subscribers",
      value: activeCount ?? 0,
      color: "text-green-600",
      bg: "bg-green-50 ring-green-100",
    },
    {
      label: "Unsubscribed",
      value: unsubscribedCount ?? 0,
      color: "text-gray-600",
      bg: "bg-gray-50 ring-gray-100",
    },
    {
      label: "New This Week",
      value: newThisWeek ?? 0,
      color: "text-blue-600",
      bg: "bg-blue-50 ring-blue-100",
    },
  ];

  return (
    <>
      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-3">
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

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Email Subscribers</h1>
        <p className="mt-1 text-sm text-gray-500">
          {allSubscribers.length} subscriber
          {allSubscribers.length !== 1 && "s"}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Subscribed</th>
            </tr>
          </thead>
          <tbody>
            {allSubscribers.map((s) => (
              <tr
                key={s.id}
                className="border-b border-gray-50 last:border-0"
              >
                <td className="px-4 py-2.5 font-medium text-gray-700">
                  {s.email}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      s.status === "active"
                        ? "bg-green-50 text-green-600"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {s.status === "active" ? "Active" : "Unsubscribed"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-400">
                  {timeAgo(s.created_at)}
                </td>
              </tr>
            ))}
            {allSubscribers.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-12 text-center text-gray-400"
                >
                  No subscribers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
