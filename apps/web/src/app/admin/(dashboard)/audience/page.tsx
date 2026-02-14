import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { SocialPostCard } from "@/components/social-post-card";

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

export default async function AudiencePage() {
  const db = getSupabaseAdmin();

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const [
    { data: actionable },
    { data: recent },
    { data: subscribers },
    { count: activeCount },
    { count: unsubscribedCount },
    { count: newThisWeek },
  ] = await Promise.all([
    db
      .from("social_posts")
      .select("*")
      .in("status", ["queued", "failed"])
      .order("created_at", { ascending: false }),
    db
      .from("social_posts")
      .select("*")
      .in("status", ["published", "rejected"])
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("email_subscribers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    db
      .from("email_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    db
      .from("email_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "unsubscribed"),
    db
      .from("email_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .gte("created_at", sevenDaysAgo),
  ]);

  const queuedPosts = actionable ?? [];
  const recentPosts = recent ?? [];
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
    <div className="grid grid-cols-1 gap-[41px] xl:grid-cols-[62fr_38fr]">
      {/* Left column — Social Queue */}
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Social Queue</h1>
          <p className="mt-1 text-sm text-gray-500">
            {queuedPosts.length} post{queuedPosts.length !== 1 && "s"} awaiting
            review
          </p>
        </div>

        {queuedPosts.length === 0 ? (
          <div className="rounded-xl bg-white p-16 text-center shadow-sm ring-1 ring-gray-100">
            <p className="text-4xl">{"\u{1F4F1}"}</p>
            <p className="mt-3 text-lg font-bold text-gray-300">Queue empty</p>
            <p className="mt-1 text-sm text-gray-400">
              Posts will appear here after the Monday digest runs.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {queuedPosts.map((post) => (
              <SocialPostCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {recentPosts.length > 0 && (
          <>
            <div className="mb-4 mt-8 border-t border-gray-100 pt-8">
              <h2 className="text-lg font-bold text-gray-800">Recent Posts</h2>
            </div>
            <div className="space-y-4">
              {recentPosts.map((post) => (
                <SocialPostCard key={post.id} post={post} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Right column — Subscribers */}
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">
            Email Subscribers
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {allSubscribers.length} subscriber
            {allSubscribers.length !== 1 && "s"}
          </p>
        </div>

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
      </div>
    </div>
  );
}
