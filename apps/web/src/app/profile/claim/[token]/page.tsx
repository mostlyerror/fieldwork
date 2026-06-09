import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ServerHeader } from "@/components/server-header";
import { getDefaultCity } from "@/lib/cities";
import { TrackConfirmed } from "./track-confirmed";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

interface ClaimRow {
  id: string;
  subscriber_id: string;
  player_id: string;
  confirmed_at: string | null;
  expires_at: string;
}

async function confirmClaim(token: string): Promise<
  | { status: "ok"; playerName: string | null; subscriberEmail: string | null }
  | { status: "expired" }
  | { status: "already_confirmed" }
  | { status: "not_found" }
  | { status: "error" }
> {
  const supabase = getSupabaseAdmin();

  const { data: claim } = await supabase
    .from("player_claims")
    .select("id, subscriber_id, player_id, confirmed_at, expires_at")
    .eq("token", token)
    .maybeSingle<ClaimRow>();

  if (!claim) return { status: "not_found" };
  if (claim.confirmed_at) return { status: "already_confirmed" };
  if (new Date(claim.expires_at) < new Date()) return { status: "expired" };

  const now = new Date().toISOString();

  const { error: claimUpdateErr } = await supabase
    .from("player_claims")
    .update({ confirmed_at: now })
    .eq("id", claim.id);
  if (claimUpdateErr) return { status: "error" };

  const { error: subErr } = await supabase
    .from("email_subscribers")
    .update({
      player_id: claim.player_id,
      link_status: "linked",
      linked_at: now,
      // Clicking the email link is the real consent moment: (re)activate the
      // subscription here (a previously-unsubscribed person opting back in) and
      // opt them into smart alerts. getLinkedSubscribers() filters on status
      // 'active' + wants_smart_alerts, so without both the success screen's
      // "you'll get personalized alerts" promise silently never fires.
      status: "active",
      wants_smart_alerts: true,
    })
    .eq("id", claim.subscriber_id);
  if (subErr) return { status: "error" };

  const [{ data: player }, { data: subscriber }] = await Promise.all([
    supabase
      .from("players")
      .select("name")
      .eq("id", claim.player_id)
      .single(),
    supabase
      .from("email_subscribers")
      .select("email")
      .eq("id", claim.subscriber_id)
      .single(),
  ]);

  return {
    status: "ok",
    playerName: (player?.name as string) ?? null,
    subscriberEmail: (subscriber?.email as string) ?? null,
  };
}

export default async function ClaimPage({ params }: PageProps) {
  const { token } = await params;
  const result = await confirmClaim(token);
  const city = getDefaultCity();

  return (
    <div className="min-h-screen bg-background">
      <ServerHeader city={city} />
      <main className="mx-auto max-w-md px-3 sm:px-5 py-16 text-center">
        {result.status === "ok" && (
          <>
            <TrackConfirmed playerName={result.playerName} subscriberEmail={result.subscriberEmail} />
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-700 text-white animate-pop">
              <span className="text-3xl">✓</span>
            </div>
            <h1 className="mt-6 t-h1 text-gray-900 animate-fade-up">You&apos;re linked.</h1>
            <p className="mt-2 t-body text-gray-500 animate-fade-up stagger-1">
              {result.playerName ? `Welcome, ${result.playerName}.` : "Profile claimed."} You&apos;ll start getting personalized alerts for tournaments that match you.
            </p>
            <Link
              href={`/${city.slug}`}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 t-body font-bold text-white shadow-sm transition-all hover:bg-emerald-800 hover:-translate-y-0.5 animate-fade-up stagger-2"
            >
              Browse tournaments →
            </Link>
          </>
        )}
        {result.status === "already_confirmed" && (
          <>
            <h1 className="t-h1 text-gray-900">Already confirmed.</h1>
            <p className="mt-2 t-body text-gray-500">This link was already used.</p>
            <Link href={`/${city.slug}`} className="mt-6 inline-block t-body font-bold text-emerald-700 hover:underline">
              Back to tournaments →
            </Link>
          </>
        )}
        {result.status === "expired" && (
          <>
            <h1 className="t-h1 text-gray-900">Link expired.</h1>
            <p className="mt-2 t-body text-gray-500">
              That link is older than 7 days. Start a new claim.
            </p>
            <Link href="/profile/find" className="mt-6 inline-block t-body font-bold text-emerald-700 hover:underline">
              Start over →
            </Link>
          </>
        )}
        {result.status === "not_found" && (
          <>
            <h1 className="t-h1 text-gray-900">Link not found.</h1>
            <p className="mt-2 t-body text-gray-500">
              The link may have been mistyped or removed.
            </p>
            <Link href="/profile/find" className="mt-6 inline-block t-body font-bold text-emerald-700 hover:underline">
              Start over →
            </Link>
          </>
        )}
        {result.status === "error" && (
          <>
            <h1 className="t-h1 text-gray-900">Something went wrong.</h1>
            <p className="mt-2 t-body text-gray-500">Try again, or email us if it keeps happening.</p>
          </>
        )}
      </main>
    </div>
  );
}
