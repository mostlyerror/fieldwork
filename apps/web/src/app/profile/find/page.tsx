import type { Metadata } from "next";
import { ServerHeader } from "@/components/server-header";
import { getDefaultCity } from "@/lib/cities";
import { FindClient } from "./find-client";

export const metadata: Metadata = {
  title: "Claim your profile — PickleRadar",
  description: "Find your player profile to get personalized tournament alerts.",
};

type PageProps = { searchParams: Promise<{ email?: string }> };

export default async function FindProfilePage({ searchParams }: PageProps) {
  const { email } = await searchParams;
  const city = getDefaultCity();
  return (
    <div className="min-h-screen bg-background">
      <ServerHeader city={city} />
      <main className="mx-auto max-w-xl px-5 py-10">
        <h1 className="text-3xl font-extrabold text-gray-900">Claim your player profile</h1>
        <p className="mt-2 text-base text-gray-500">
          Search for yourself below. We&apos;ll email a confirmation link so we know it&apos;s really you.
        </p>
        <div className="mt-8">
          <FindClient initialEmail={email ?? ""} />
        </div>
      </main>
    </div>
  );
}
