import { describe, it, expect } from "vitest";
import { EXPIRY_MARGIN_MS, isUsableToken, jwtExpiry, redactAuthBody, sessionFromAuthBody } from "../src/utils/dupr-token.js";

function fakeJwt(payload: object): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${enc({ alg: "HS256" })}.${enc(payload)}.sig`;
}

describe("jwtExpiry", () => {
  it("reads the exp claim", () => {
    expect(jwtExpiry(fakeJwt({ exp: 1_800_000_000 }))?.toISOString()).toBe(new Date(1_800_000_000_000).toISOString());
  });

  it("returns null for non-JWTs and missing exp", () => {
    expect(jwtExpiry("opaque-token")).toBeNull();
    expect(jwtExpiry(fakeJwt({ sub: "x" }))).toBeNull();
    expect(jwtExpiry("a.!!!.c")).toBeNull();
  });
});

describe("isUsableToken", () => {
  const now = new Date("2026-09-29T12:00:00Z");

  it("rejects a missing session or token", () => {
    expect(isUsableToken(null, now)).toBe(false);
    expect(isUsableToken({ accessToken: null, refreshToken: "r", expiresAt: null }, now)).toBe(false);
  });

  it("trusts a token with unknown expiry", () => {
    expect(isUsableToken({ accessToken: "t", refreshToken: null, expiresAt: null }, now)).toBe(true);
  });

  it("rejects a token that expires inside the margin", () => {
    const soon = new Date(now.getTime() + EXPIRY_MARGIN_MS - 1000);
    const later = new Date(now.getTime() + EXPIRY_MARGIN_MS + 60_000);
    expect(isUsableToken({ accessToken: "t", refreshToken: null, expiresAt: soon }, now)).toBe(false);
    expect(isUsableToken({ accessToken: "t", refreshToken: null, expiresAt: later }, now)).toBe(true);
  });
});

describe("sessionFromAuthBody", () => {
  it("reads access and refresh tokens from a SUCCESS body", () => {
    const token = fakeJwt({ exp: 1_800_000_000 });
    const s = sessionFromAuthBody({ status: "SUCCESS", result: { accessToken: token, refreshToken: "r1" } });
    expect(s).toEqual({ accessToken: token, refreshToken: "r1", expiresAt: new Date(1_800_000_000_000) });
  });

  it("allows a missing refresh token", () => {
    expect(sessionFromAuthBody({ status: "SUCCESS", result: { accessToken: "t" } })?.refreshToken).toBeNull();
  });

  it("returns null for failures and odd shapes", () => {
    expect(sessionFromAuthBody(null)).toBeNull();
    expect(sessionFromAuthBody({ status: "FAILURE", result: { accessToken: "t" } })).toBeNull();
    expect(sessionFromAuthBody({ status: "SUCCESS", result: {} })).toBeNull();
  });
});

describe("redactAuthBody", () => {
  it("hides tokens and keeps everything else", () => {
    const body = { status: "SUCCESS", result: { accessToken: "a", refreshToken: "r", challengeId: "c" } };
    expect(redactAuthBody(body)).toEqual({
      status: "SUCCESS",
      result: { accessToken: "[redacted]", refreshToken: "[redacted]", challengeId: "c" },
    });
    expect(body.result.accessToken).toBe("a"); // original untouched
  });

  it("passes through bodies with no result object", () => {
    expect(redactAuthBody(null)).toBeNull();
    expect(redactAuthBody({ status: "FAILURE", message: "x" })).toEqual({ status: "FAILURE", message: "x" });
  });
});
