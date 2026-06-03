import { sendDiscordAlert } from "./discord.js";

export interface ResultDrop {
  tournamentName: string;
  eventName: string;
  eventId: string; // db tournament_events.id (the result link's eventId)
  playerId: string; // global players.id (event_players.player_id; the link's playerId)
  playerName: string;
  partnerName: string | null;
  placement: number; // 1 = gold, 2 = silver, 3 = bronze
}

const APP = "https://pickleradar.app";
const HASHTAGS =
  "#houstonpickleball #pickleballhouston #pickleballtournament #pickleballwinner #pickleball #htxpickleball #dinkresponsibly";
const CAP = 8; // don't flood the channel if a huge tournament's results land at once

/**
 * "Result Drops" — after new placements land, push the operator a ready-to-post
 * social prompt for each GOLD medalist: their shareable result-card link plus a
 * copy-paste caption in a fenced code block (same clean-copy shape as the IG
 * content prompt). Posting it tags the player into their own network → the
 * growth loop. Golds only (the headline winners, and the most postable), capped
 * per run. The drop list comes from writePlacements, which only processes
 * tournaments without existing placements — so these are never re-sent.
 */
export async function sendResultDrops(drops: ResultDrop[]): Promise<void> {
  const golds = drops.filter((d) => d.placement === 1 && d.playerId);
  if (golds.length === 0) return;

  for (const d of golds.slice(0, CAP)) {
    const names = [d.playerName, d.partnerName].filter(Boolean).join(" & ");
    const link = `${APP}/results/${d.eventId}/${d.playerId}`;
    const caption =
      `🥇 ${names} — GOLD in ${d.eventName} at ${d.tournamentName}! 🏆\n\n` +
      `Full result card 👇\n${link}\n\n${HASHTAGS}`;
    await sendDiscordAlert({
      title: `🏆 Result Drop — ${d.tournamentName}`,
      description:
        `${names} won gold. Copy-paste to post (tag them!):\n` +
        "```\n" +
        caption +
        "\n```",
    });
  }

  if (golds.length > CAP) {
    await sendDiscordAlert({
      title: "🏆 More result drops",
      description: `+${golds.length - CAP} more gold medalist(s) this run — cards live at ${APP}/results`,
    });
  }
}
