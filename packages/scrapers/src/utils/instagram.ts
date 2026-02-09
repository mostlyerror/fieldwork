/**
 * Instagram Content Publishing API integration.
 *
 * Posts tournament images + captions to Instagram via the Graph API.
 * Requires a Facebook Business Page + linked Instagram Business/Creator account.
 *
 * Env vars: INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID, APP_URL
 */

interface InstagramConfig {
  accessToken: string;
  userId: string;
  appUrl: string;
}

interface TournamentPost {
  id: string;
  name: string;
  dateStart: string;
  dateEnd?: string | null;
  locationName: string;
  entryFee?: number | null;
  skillLevels?: string[] | null;
}

const GRAPH_API = "https://graph.facebook.com/v21.0";

export function getInstagramConfig(): InstagramConfig | null {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  const appUrl = process.env.APP_URL ?? "https://pickleradar.app";

  if (!accessToken || !userId) return null;
  return { accessToken, userId, appUrl };
}

function buildCaption(tournament: TournamentPost, appUrl: string): string {
  const lines: string[] = [];

  lines.push(`\u{1F3D3} ${tournament.name}`);
  lines.push("");

  // Date
  const start = new Date(tournament.dateStart + "T00:00:00");
  const dateStr = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (tournament.dateEnd && tournament.dateEnd !== tournament.dateStart) {
    const end = new Date(tournament.dateEnd + "T00:00:00");
    const endStr = end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    lines.push(`\u{1F4C5} ${dateStr} – ${endStr}`);
  } else {
    lines.push(`\u{1F4C5} ${dateStr}`);
  }

  // Location
  lines.push(`\u{1F4CD} ${tournament.locationName}`);

  // Fee
  if (tournament.entryFee != null) {
    lines.push(
      `\u{1F4B0} ${tournament.entryFee === 0 ? "Free" : `$${tournament.entryFee}`}`
    );
  }

  // Skill levels
  if (tournament.skillLevels && tournament.skillLevels.length > 0) {
    lines.push(`\u{1F3AF} ${tournament.skillLevels.join(" / ")}`);
  }

  lines.push("");
  lines.push(`\u{1F517} ${appUrl}/tournaments/${tournament.id}`);
  lines.push("");
  lines.push(
    "#pickleball #pickleballtournament #houstonpickleball #pickleradar #htx"
  );

  return lines.join("\n");
}

export async function postTournamentToInstagram(
  tournament: TournamentPost,
  config: InstagramConfig
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  const imageUrl = `${config.appUrl}/tournaments/${tournament.id}/opengraph-image`;
  const caption = buildCaption(tournament, config.appUrl);

  try {
    // Step 1: Create media container
    const containerRes = await fetch(
      `${GRAPH_API}/${config.userId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          caption,
          access_token: config.accessToken,
        }),
      }
    );

    if (!containerRes.ok) {
      const err = await containerRes.text();
      return { success: false, error: `Container creation failed: ${err}` };
    }

    const { id: containerId } = (await containerRes.json()) as { id: string };

    // Step 2: Publish the container
    const publishRes = await fetch(
      `${GRAPH_API}/${config.userId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: config.accessToken,
        }),
      }
    );

    if (!publishRes.ok) {
      const err = await publishRes.text();
      return { success: false, error: `Publish failed: ${err}` };
    }

    const { id: mediaId } = (await publishRes.json()) as { id: string };
    return { success: true, mediaId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
