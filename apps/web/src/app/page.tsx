import { getTournaments } from "@/lib/queries";
import { TournamentBrowser } from "@/components/tournament-browser";

export const revalidate = 300; // ISR: 5 minutes

export default async function Home() {
  let tournaments: Awaited<ReturnType<typeof getTournaments>>;
  try {
    tournaments = await getTournaments();
  } catch {
    tournaments = [];
  }

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Upcoming Tournaments</h1>
      <TournamentBrowser tournaments={tournaments} />
    </>
  );
}
