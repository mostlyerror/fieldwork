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
      <main className="mx-auto max-w-2xl px-5 py-8">
        <h1 className="mb-8 text-3xl font-extrabold tracking-tight text-gray-900">
          Your Profile
        </h1>

        <div className="space-y-6">
          {/* Basic info */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">
              Account
            </h2>
            <p className="mb-4 text-sm text-gray-500">{user.email}</p>
            <ProfileForm profile={profile} />
          </div>

          {/* Rating */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-gray-500">
              Rating
            </h2>
            <p className="mb-4 text-xs text-gray-400">
              Link your rating for personalized tournament recommendations
            </p>

            {profile?.dupr_rating_doubles != null || profile?.dupr_rating_singles != null ? (
              <div className="mb-4 flex gap-4">
                {profile.dupr_rating_doubles != null && (
                  <div className="rounded-xl bg-green-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase text-green-600">
                      Doubles
                    </p>
                    <p className="text-2xl font-extrabold text-green-700">
                      {profile.dupr_rating_doubles.toFixed(2)}
                    </p>
                  </div>
                )}
                {profile.dupr_rating_singles != null && (
                  <div className="rounded-xl bg-blue-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase text-blue-600">
                      Singles
                    </p>
                    <p className="text-2xl font-extrabold text-blue-700">
                      {profile.dupr_rating_singles.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            <DuprLinker />
          </div>
        </div>
      </main>
    </div>
  );
}
