import { describe, expect, it } from "vitest";
import { EMBED_SESSION_TTL_SECONDS, issueEmbedSession, verifyEmbedSession } from "./embed-session";

const secret = Buffer.alloc(32, 7);
const other = Buffer.alloc(32, 9);
const claims = { clientId: "11111111-1111-4111-8111-111111111111", locationId: "loc_1", ghlUserId: "usr_1", isStaff: false };

describe("embed session", () => {
  it("round-trips the claims", () => {
    const token = issueEmbedSession(claims, secret, 1_000_000_000_000);
    const session = verifyEmbedSession(token, secret, 1_000_000_000_000 + 60_000);
    expect(session).toMatchObject(claims);
    expect(session?.expiresAt).toBe(1_000_000_000 + EMBED_SESSION_TTL_SECONDS);
  });

  it("rejects an expired token", () => {
    const token = issueEmbedSession(claims, secret, 1_000_000_000_000);
    expect(verifyEmbedSession(token, secret, 1_000_000_000_000 + (EMBED_SESSION_TTL_SECONDS + 1) * 1000)).toBeNull();
  });

  it("rejects a token signed with another secret, a tampered body, and garbage", () => {
    const token = issueEmbedSession(claims, secret);
    expect(verifyEmbedSession(token, other)).toBeNull();
    const [body, signature] = token.split(".");
    const tampered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), isStaff: true })).toString("base64url");
    expect(verifyEmbedSession(`${tampered}.${signature}`, secret)).toBeNull();
    expect(verifyEmbedSession("not.a.token", secret)).toBeNull();
    expect(verifyEmbedSession(null, secret)).toBeNull();
    expect(verifyEmbedSession("", secret)).toBeNull();
  });

  it("refuses a short secret", () => {
    expect(() => issueEmbedSession(claims, Buffer.alloc(8))).toThrow(/32/);
  });
});
