import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { matchCityName, getDefaultCity } from "@/lib/cities";

export default async function Home() {
  const headersList = await headers();
  const ipCity = headersList.get("x-vercel-ip-city");
  const matched = ipCity ? matchCityName(ipCity) : undefined;
  const city = matched ?? getDefaultCity();
  redirect(`/${city.slug}`);
}
