/**
 * One-off probe: does DUPR expose a per-player profile endpoint that returns
 * verified/provisional rating flags for OTHER players (not just yourself)?
 * Compares the search hit's `ratings` block to GET /player/v1.0/{id}.
 *
 *   DUPR_EMAIL=... DUPR_PASSWORD=... npx tsx scripts/probe-profile-endpoint.ts <query>
 */
const API = "https://api.dupr.gg";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function headers(token?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json, text/plain, */*",
    "User-Agent": UA,
    Origin: "https://dashboard.dupr.com",
    Referer: "https://dashboard.dupr.com/",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function main() {
  const query = process.argv[2] ?? "Ben Poon";
  const lr = await fetch(`${API}/auth/v1.0/login/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email: process.env.DUPR_EMAIL, password: process.env.DUPR_PASSWORD }),
  });
  const ld = await lr.json();
  if (ld?.status !== "SUCCESS") {
    console.error("login failed:", lr.status, ld?.status);
    process.exit(1);
  }
  const tok = ld.result.accessToken;
  console.log("login ok");

  const sr = await fetch(`${API}/player/v1.0/search`, {
    method: "POST",
    headers: headers(tok),
    body: JSON.stringify({ query, limit: 3, offset: 0, includeUnclaimedPlayers: true, filter: {} }),
  });
  const sd = await sr.json();
  const hit = sd?.result?.hits?.[0];
  if (!hit) {
    console.error("no search hits for", query);
    process.exit(1);
  }
  console.log("\n=== SEARCH HIT ===");
  console.log(JSON.stringify(hit, null, 2));

  await new Promise((r) => setTimeout(r, 1500));

  // Candidate profile endpoints
  for (const path of [`/player/v1.0/${hit.id}`, `/player/v1.0/${hit.id}/profile`, `/player/v1.0/${hit.id}/verified-rating`]) {
    const pr = await fetch(`${API}${path}`, { method: "GET", headers: headers(tok) });
    console.log(`\n=== GET ${path} → ${pr.status} ===`);
    if (pr.ok) {
      const pd = await pr.json().catch(() => null);
      console.log(JSON.stringify(pd, null, 2)?.slice(0, 3000));
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
}

main();
