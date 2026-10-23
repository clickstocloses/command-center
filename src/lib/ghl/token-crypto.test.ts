import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "./token-crypto";

const key = randomBytes(32);

describe("token encryption at rest", () => {
  it("round trips", () => {
    const sealed = encryptToken("access-token-value", key);
    expect(decryptToken(sealed, key)).toBe("access-token-value");
  });

  it("never stores the plain text", () => {
    expect(encryptToken("hello-token", key)).not.toContain("hello-token");
  });

  it("produces different ciphertext each time (random IV)", () => {
    expect(encryptToken("same", key)).not.toBe(encryptToken("same", key));
  });

  it("rejects tampering", () => {
    const sealed = encryptToken("token", key);
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptToken(parts.join("."), key)).toThrow();
  });

  it("rejects the wrong key", () => {
    const sealed = encryptToken("token", key);
    expect(() => decryptToken(sealed, randomBytes(32))).toThrow();
  });

  it("rejects a key that is not 32 bytes", () => {
    expect(() => encryptToken("token", randomBytes(16))).toThrow(/32 bytes/);
  });

  it("rejects an unknown format", () => {
    expect(() => decryptToken("plain-text-token", key)).toThrow(/format/);
  });
});
