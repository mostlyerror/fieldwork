/**
 * DUPR fetch wrapper.
 *
 * DUPR's edge blocks datacenter IPs (GitHub Actions returns 400/FAILURE on
 * login while the same request from a residential IP returns 200/SUCCESS).
 * To run DUPR pulls from CI we route them through a residential proxy.
 *
 * Set DUPR_PROXY_URL to a proxy endpoint (e.g. http://user:pass@host:port) and
 * every DUPR request goes through it. When unset (local dev), requests go
 * direct — so nothing changes on a machine whose IP DUPR already accepts.
 *
 * This is a drop-in replacement for `fetch` at DUPR call sites: same signature,
 * it just injects undici's ProxyAgent as the dispatcher when configured.
 */
import { ProxyAgent } from "undici";

let agent: ProxyAgent | null | undefined;

function proxyDispatcher(): ProxyAgent | null {
  if (agent !== undefined) return agent; // memoized (incl. the "no proxy" null)
  const url = process.env.DUPR_PROXY_URL?.trim();
  agent = url ? new ProxyAgent(url) : null;
  if (url) {
    // Don't log the credentials — just the host so we can confirm it's wired.
    let host = "(unparseable)";
    try {
      host = new URL(url).host;
    } catch {
      /* leave as unparseable */
    }
    console.log(`[dupr-fetch] routing DUPR requests through proxy ${host}`);
  }
  return agent;
}

/** `fetch`, but routed through the residential proxy when DUPR_PROXY_URL is set. */
export function duprFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const dispatcher = proxyDispatcher();
  if (!dispatcher) return fetch(url, init);
  // `dispatcher` is an undici extension to RequestInit, not in the DOM types.
  return fetch(url, { ...init, dispatcher } as RequestInit);
}
