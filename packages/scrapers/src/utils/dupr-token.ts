/**
 * Pure helpers for the stored DUPR session (no network, no Supabase), so they
 * can be unit tested. The store itself lives in dupr-client.ts.
 *
 * Why a stored session at all: since 2026-09-08 DUPR answers a fresh login with
 * HTTP 428 and emails a sign-in code. Logging in once per job can't work, so Ben
 * verifies once by hand (src/dupr-login.ts) and every job reuses that token.
 */

export interface DuprSession {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null; // null = unknown; trusted until DUPR answers 401
}

/** Don't hand out a token that dies mid-run. */
export const EXPIRY_MARGIN_MS = 10 * 60 * 1000;

/**
 * Read the `exp` claim of a JWT. Null when the token isn't a JWT or has no exp.
 * GUESS: DUPR access tokens look like JWTs. If they aren't, expiresAt stays
 * null and we fall back to "use it until DUPR says 401".
 */
export function jwtExpiry(token: string): Date | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { exp?: unknown };
    return typeof payload.exp === "number" ? new Date(payload.exp * 1000) : null;
  } catch {
    return null;
  }
}

/** True when the stored access token can be used for this run. */
export function isUsableToken(session: DuprSession | null, now: Date = new Date()): boolean {
  if (!session?.accessToken) return false;
  if (!session.expiresAt) return true;
  return session.expiresAt.getTime() - now.getTime() > EXPIRY_MARGIN_MS;
}

/**
 * Pull tokens out of a DUPR auth response body. Used for login, the code
 * verification call, and refresh, since we expect all three to answer in the
 * same shape. GUESS for verify/refresh: `{ status: "SUCCESS", result: {
 * accessToken, refreshToken } }`, copied from what login returned before 428.
 */
export function sessionFromAuthBody(body: unknown): DuprSession | null {
  const b = body as { status?: string; result?: { accessToken?: unknown; refreshToken?: unknown } } | null;
  const access = b?.result?.accessToken;
  if (b?.status !== "SUCCESS" || typeof access !== "string" || !access) return null;
  const refresh = b.result?.refreshToken;
  return {
    accessToken: access,
    refreshToken: typeof refresh === "string" && refresh ? refresh : null,
    expiresAt: jwtExpiry(access),
  };
}
