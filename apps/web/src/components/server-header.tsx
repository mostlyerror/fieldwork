import { getUser } from "@/lib/auth";
import { Header } from "./header";
import type { City } from "@/lib/cities";

export async function ServerHeader({ city }: { city?: City }) {
  const user = await getUser();
  return <Header city={city} user={user} />;
}
