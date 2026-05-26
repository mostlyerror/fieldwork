import { supabase } from "./supabase.js";

const BATCH_SIZE = 50;
const DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface PlayerNeedingDuprId {
  id: string;
  name: string;
  slug: string;
}

async function getPlayersWithoutDuprId(limit: number): Promise<PlayerNeedingDuprId[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, name, slug")
    .is("dupr_id", null)
    .not("slug", "is", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[scrape-dupr-ids] Error fetching players:", error);
    return [];
  }

  return (data ?? []).filter((p): p is PlayerNeedingDuprId => p.slug != null);
}

async function fetchDuprIdFromPickleballCom(slug: string): Promise<string | null> {
  try {
    const res = await fetch(`https://pickleball.com/players/${slug}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html",
      },
    });

    if (!res.ok) return null;

    const html = await res.text();
    const match = html.match(/duprId[^A-Z0-9]*([A-Z0-9]{4,8})/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function scrapeDuprIds(): Promise<{ checked: number; found: number }> {
  console.log("[scrape-dupr-ids] Starting DUPR ID scrape from pickleball.com...");

  const players = await getPlayersWithoutDuprId(BATCH_SIZE);
  console.log(`[scrape-dupr-ids] ${players.length} players need DUPR IDs`);

  let found = 0;

  for (const player of players) {
    const duprId = await fetchDuprIdFromPickleballCom(player.slug);

    if (duprId) {
      const { error } = await supabase
        .from("players")
        .update({ dupr_id: duprId })
        .eq("id", player.id);

      if (error) {
        console.error(`[scrape-dupr-ids] Update failed for "${player.name}":`, error);
      } else {
        console.log(`[scrape-dupr-ids] ✓ ${player.name}: ${duprId}`);
        found++;
      }
    }

    await sleep(DELAY_MS);
  }

  console.log(`[scrape-dupr-ids] Done. Checked: ${players.length}, Found: ${found}`);
  return { checked: players.length, found };
}
