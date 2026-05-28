import { beforeAll, describe, it, expect } from "vitest";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const TEST_TIMEOUT = 10_000;

let serverReachable = false;

async function pingServer(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(BASE_URL, {
      redirect: "manual",
      signal: controller.signal,
    });
    return res.status > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

beforeAll(async () => {
  serverReachable = await pingServer();
  if (!serverReachable) {
    console.log(
      `Smoke tests skipped — start the dev server first (${BASE_URL})`,
    );
  }
});

describe("smoke: critical routes", () => {
  const maybeIt = (name: string, fn: () => Promise<void>) =>
    it(
      name,
      async () => {
        if (!serverReachable) return;
        await fn();
      },
      TEST_TIMEOUT,
    );

  maybeIt("GET / redirects to /houston", async () => {
    const res = await fetch(`${BASE_URL}/`, { redirect: "manual" });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/houston");
  });

  maybeIt("GET /houston returns 200 with expected content", async () => {
    const res = await fetch(`${BASE_URL}/houston`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(/Tournaments|Houston/.test(body)).toBe(true);
  });

  maybeIt("GET /houston/tournaments/:id returns 200", async () => {
    const res = await fetch(
      `${BASE_URL}/houston/tournaments/711296c4-80a5-4ef8-bf60-62bf78e29775`,
    );
    expect(res.status).toBe(200);
  });

  maybeIt("GET /players/:id returns 200", async () => {
    const res = await fetch(
      `${BASE_URL}/players/cefe879a-23d5-4563-9e69-c1f17ca558fe`,
    );
    expect(res.status).toBe(200);
  });

  maybeIt("GET /profile/find returns 200", async () => {
    const res = await fetch(`${BASE_URL}/profile/find`);
    expect(res.status).toBe(200);
  });

  maybeIt("GET /profile/claim/:badToken returns 200", async () => {
    const res = await fetch(
      `${BASE_URL}/profile/claim/bogus-token-doesnt-exist`,
    );
    expect(res.status).toBe(200);
  });

  maybeIt("GET /submit returns 200", async () => {
    const res = await fetch(`${BASE_URL}/submit`);
    expect(res.status).toBe(200);
  });

  maybeIt("GET /404-route-doesnt-exist returns 404", async () => {
    const res = await fetch(`${BASE_URL}/404-route-doesnt-exist`);
    // Next.js dev server returns 200 with not-found.tsx; production returns 404.
    // Accept either, but require the not-found page to be served.
    const body = await res.text();
    expect([404, 200]).toContain(res.status);
    expect(/Not Found|404/i.test(body)).toBe(true);
  });

  maybeIt("GET /api/og returns 200 image/png", async () => {
    const res = await fetch(
      `${BASE_URL}/api/og?id=711296c4-80a5-4ef8-bf60-62bf78e29775`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain("image/png");
  });

  maybeIt("GET /api/result-card returns 200 image/png", async () => {
    const res = await fetch(
      `${BASE_URL}/api/result-card?eventId=ac8f6f2a-0a75-4cb1-835b-aa98212729a0&playerId=cefe879a-23d5-4563-9e69-c1f17ca558fe&style=editorial`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain("image/png");
  });
});
