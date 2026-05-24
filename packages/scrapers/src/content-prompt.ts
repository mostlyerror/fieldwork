/**
 * Daily Instagram content prompt — sends the next post idea to Discord.
 * Cycles through the queue based on the current day.
 */

import { sendDiscordAlert } from "./utils/discord.js";

interface ContentPost {
  title: string;
  screenshot: string;
  caption: string;
  hashtags: string;
}

const POSTS: ContentPost[] = [
  {
    title: "Field Strength Filter",
    screenshot: "Go to pickleradar.app/houston → scroll to the tournament list → screenshot the filter chips (All / Friendly / Competitive / Stacked) with a few tournament cards visible below.",
    caption: `Filter tournaments by how competitive the field actually is. No more guessing if that 4.0 bracket is full of 4.5s.\n\nLink in bio 👆`,
    hashtags: "#houstonpickleball #pickleballhouston #pickleballtournament #pickleballlife #pickleballplayers #dinkresponsibly #pickleballaddiction #htx #dupr #pickleballbrackets",
  },
  {
    title: "Field Intel Summary",
    screenshot: "Go to pickleradar.app/houston → tap any tournament with a field strength badge → screenshot the 'Field Intel' green banner showing avg DUPR, registered count, and the takeaway line.",
    caption: `We analyze DUPR data for every bracket so you know what you're walking into before you register.\n\nAvg DUPR. Sandbagger %. Field strength rating. All in one place.\n\nLink in bio 👆`,
    hashtags: "#houstonpickleball #pickleballhouston #pickleballtournament #pickleballlife #dupr #pickleballstrategy #pickleballdata #htx #pickleballaddiction",
  },
  {
    title: "Who's Playing — Player List",
    screenshot: "Go to pickleradar.app/houston → tap a tournament → scroll to 'Who's Playing?' → screenshot an expanded event bracket showing player names and DUPR ratings.",
    caption: `See who's already registered and their DUPR ratings. Know your competition before you sign up.\n\nLink in bio 👆`,
    hashtags: "#houstonpickleball #pickleballhouston #pickleballtournament #pickleballlife #dupr #pickleballplayers #dinkresponsibly #htx #pickleballbrackets",
  },
  {
    title: "Sandbagger Radar",
    screenshot: "Go to pickleradar.app/houston → find a tournament with a 'Sandbagger Alert' or 'Stacked' badge → tap it → screenshot the red 'Sandbagger Radar' warning banner.",
    caption: `We're tracking which brackets have players rated above the skill cap. No more surprises.\n\n⚠️ Sandbagger Radar flags brackets where 20%+ of players are rated above the listed skill level.\n\nLink in bio 👆`,
    hashtags: "#houstonpickleball #pickleballhouston #sandbagger #pickleballtournament #dupr #pickleballlife #dinkresponsibly #htx #pickleballaddiction #pickleballstrategy",
  },
  {
    title: "DUPR Distribution Chart",
    screenshot: "Go to pickleradar.app/houston → tap a tournament → expand an event bracket → screenshot the DUPR Distribution bar chart showing the spread of player ratings.",
    caption: `See the full DUPR spread for every bracket before you register. Is the field tight or are there outliers?\n\nLink in bio 👆`,
    hashtags: "#houstonpickleball #pickleballhouston #dupr #pickleballtournament #pickleballdata #pickleballstrategy #pickleballlife #htx #pickleballbrackets",
  },
  {
    title: "Player Profiles",
    screenshot: "Go to pickleradar.app/houston → tap a tournament → expand a bracket → tap any player name → screenshot their profile page showing DUPR and tournament history.",
    caption: `Every player gets a profile. See their DUPR rating and full tournament history across Houston.\n\nLink in bio 👆`,
    hashtags: "#houstonpickleball #pickleballhouston #dupr #pickleballtournament #pickleballplayers #pickleballlife #htx #pickleballaddiction",
  },
  {
    title: "Registration Count",
    screenshot: "Go to pickleradar.app/houston → screenshot a few tournament cards showing the 'X registered across Y events' line at the bottom of the cards.",
    caption: `Know how full a tournament is before you click. We show registered player counts and event breakdowns for every tournament.\n\nLink in bio 👆`,
    hashtags: "#houstonpickleball #pickleballhouston #pickleballtournament #pickleballlife #pickleballplayers #dinkresponsibly #htx #pickleballbrackets",
  },
];

async function main() {
  const startDate = new Date("2026-05-25");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysSinceStart = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceStart < 0) {
    console.log("[content-prompt] Not started yet, skipping.");
    return;
  }

  const postIndex = daysSinceStart % POSTS.length;
  const post = POSTS[postIndex];

  console.log(`[content-prompt] Day ${daysSinceStart}, posting #${postIndex + 1}: ${post.title}`);

  await sendDiscordAlert({
    title: `📸 IG Post #${postIndex + 1}: ${post.title}`,
    description: "Time to post! Here's today's content:",
    color: 0xf97316,
    fields: [
      { name: "📱 Screenshot This", value: post.screenshot },
      { name: "📝 Caption (copy this)", value: post.caption },
      { name: "#️⃣ Hashtags (copy this)", value: post.hashtags },
    ],
  });

  console.log("[content-prompt] Discord prompt sent.");
}

main().catch((err) => {
  console.error("Fatal error in content prompt:", err);
  process.exit(1);
});
