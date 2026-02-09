import { getTournaments } from "@/lib/queries";
import { Homepage } from "@/components/homepage";

export const revalidate = 300; // ISR: 5 minutes

export default async function Home() {
  let tournaments: Awaited<ReturnType<typeof getTournaments>>;
  try {
    tournaments = await getTournaments();
  } catch {
    tournaments = [];
  }

  return <Homepage tournaments={tournaments} />;
}
