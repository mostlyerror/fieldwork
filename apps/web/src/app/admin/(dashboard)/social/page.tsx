import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { SocialPostCard } from "@/components/social-post-card";

export default async function SocialAdminPage() {
  const db = getSupabaseAdmin();

  const { data: actionable } = await db
    .from("social_posts")
    .select("*")
    .in("status", ["queued", "failed"])
    .order("created_at", { ascending: false });

  const { data: recent } = await db
    .from("social_posts")
    .select("*")
    .in("status", ["published", "rejected"])
    .order("created_at", { ascending: false })
    .limit(10);

  const queuedPosts = actionable ?? [];
  const recentPosts = recent ?? [];

  return (
    <>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Social Queue</h1>
        <p className="mt-1 text-sm text-gray-500">
          {queuedPosts.length} post{queuedPosts.length !== 1 && "s"} awaiting
          review
        </p>
      </div>

      {/* Queued / Failed posts */}
      {queuedPosts.length === 0 ? (
        <div className="rounded-2xl bg-white p-16 text-center shadow-sm ring-1 ring-gray-100">
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

      {/* Recent history */}
      {recentPosts.length > 0 && (
        <>
          <div className="mb-4 mt-12 border-t border-gray-100 pt-8">
            <h2 className="text-lg font-bold text-gray-800">Recent Posts</h2>
          </div>
          <div className="space-y-4">
            {recentPosts.map((post) => (
              <SocialPostCard key={post.id} post={post} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
