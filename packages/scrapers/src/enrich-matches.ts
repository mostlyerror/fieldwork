import { fetchAllMatchHistory } from "./utils/match-history.js";
import { duprFetch } from "./utils/dupr-fetch.js";

const DUPR_API_BASE = "https://api.dupr.gg";

async function authenticate(): Promise<string | null> {
  const email = process.env.DUPR_EMAIL;
  const password = process.env.DUPR_PASSWORD;

  if (!email || !password) {
    console.error("[enrich-matches] Missing DUPR_EMAIL or DUPR_PASSWORD env vars");
    return null;
  }

  const res = await duprFetch(`${DUPR_API_BASE}/auth/v1.0/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    console.error(`[enrich-matches] Auth failed: ${res.status} ${res.statusText}`);
    return null;
  }

  const data = await res.json();
  if (data.status !== "SUCCESS") {
    console.error("[enrich-matches] Auth response not SUCCESS:", data);
    return null;
  }

  return data.result.accessToken as string;
}

async function main() {
  console.log("Match History Enrichment — standalone run");
  console.log("=".repeat(40));

  const token = await authenticate();
  if (!token) {
    console.error("Authentication failed. Exiting.");
    process.exit(1);
  }

  console.log("[enrich-matches] Authenticated with DUPR");

  const result = await fetchAllMatchHistory(token);

  console.log("\nSummary:");
  console.log(`  Players checked:    ${result.playersChecked}`);
  console.log(`  Matches upserted:   ${result.matchesInserted}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
