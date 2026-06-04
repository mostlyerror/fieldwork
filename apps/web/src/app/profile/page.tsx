import { redirect } from "next/navigation";
import { getUser, getUserProfile } from "@/lib/auth";
import { ServerHeader } from "@/components/server-header";
import { ProfileForm } from "./profile-form";
import { DuprLinker } from "./dupr-linker";

export const metadata = {
  title: "Profile — PickleRadar",
};

export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/login?redirect=/profile");

  const profile = await getUserProfile();

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/50 via-white to-amber-50/30">
      <ServerHeader />
      <main className="mx-auto max-w-2xl px-3 sm:px-5 py-8">
        <h1 className="mb-8 t-h1 text-gray-900">
          Your Profile
        </h1>

        <div className="space-y-6">
          {/* Basic info */}
          <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-card sm:rounded-3xl">
            <h2 className="mb-4 t-body font-bold uppercase tracking-wide text-gray-500">
              Account
            </h2>
            <p className="mb-4 t-body text-gray-500">{user.email}</p>
            <ProfileForm profile={profile} />
          </div>

          {/* Rating */}
          <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-card sm:rounded-3xl">
            <h2 className="mb-1 t-body font-bold uppercase tracking-wide text-gray-500">
              Rating
            </h2>
            <p className="mb-4 t-caption text-gray-400">
              Link your rating for personalized tournament recommendations
            </p>

            {profile?.dupr_rating_doubles != null || profile?.dupr_rating_singles != null ? (
              <div className="mb-5 grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100 pt-4">
                <div className="min-w-0 px-2.5 first:pl-0 last:pr-0">
                  <div className="t-label text-gray-400">Doubles</div>
                  <div className={`mt-1 t-h3 tabular-nums ${profile.dupr_rating_doubles != null ? "text-emerald-800" : "text-gray-300"}`}>
                    {profile.dupr_rating_doubles != null
                      ? profile.dupr_rating_doubles.toFixed(2)
                      : "--"}
                  </div>
                </div>
                <div className="min-w-0 px-2.5 first:pl-0 last:pr-0">
                  <div className="t-label text-gray-400">Singles</div>
                  <div className={`mt-1 t-h3 tabular-nums ${profile.dupr_rating_singles != null ? "text-emerald-800" : "text-gray-300"}`}>
                    {profile.dupr_rating_singles != null
                      ? profile.dupr_rating_singles.toFixed(2)
                      : "--"}
                  </div>
                </div>
              </div>
            ) : null}

            <DuprLinker />
          </div>
        </div>
      </main>
    </div>
  );
}
