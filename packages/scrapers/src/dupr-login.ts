/**
 * One-time manual DUPR login. Ben runs this by hand when DUPR asks for the
 * emailed sign-in code (HTTP 428). It logs in, asks for the code on stdin,
 * sends it to DUPR, and saves the session to dupr_session so scheduled jobs
 * reuse it instead of logging in every run.
 *
 *   cd packages/scrapers && npm run dupr:login
 *
 * Needs DUPR_EMAIL, DUPR_PASSWORD, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * (picked up from apps/web/.env.local). Run it from a machine DUPR accepts
 * (home IP), or set DUPR_PROXY_URL. It prints DUPR's raw answers so the
 * guessed verify call in dupr-client.ts can be fixed if it's wrong.
 */
import { createInterface } from "node:readline/promises";
import { interactiveDuprLogin, saveDuprSession } from "./utils/dupr-client.js";

async function askCode(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question("DUPR emailed a sign-in code. Enter it: ");
  } finally {
    rl.close();
  }
}

async function main() {
  const session = await interactiveDuprLogin(askCode);
  if (!session) {
    console.error("[dupr-login] No session. Check the DUPR answers printed above.");
    process.exit(1);
  }
  await saveDuprSession(session);
  const expires = session.expiresAt ? session.expiresAt.toISOString() : "unknown (not a JWT)";
  console.log(
    `[dupr-login] Saved. Refresh token: ${session.refreshToken ? "yes" : "no"}. Access token expires: ${expires}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[dupr-login] Fatal:", err);
    process.exit(1);
  });
