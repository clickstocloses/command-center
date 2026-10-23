import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * HighLevel OAuth tokens are encrypted before they reach the database, so a
 * database leak alone doesn't expose client accounts. AES-256-GCM, random IV,
 * stored as "v1.<iv>.<tag>.<ciphertext>" in base64url.
 */

const VERSION = "v1";
const IV_BYTES = 12;

function assertKey(key: Buffer): void {
  if (key.length !== 32) throw new Error("Token encryption key must be 32 bytes.");
}

export function encryptToken(plainText: string, key: Buffer): string {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const cipherText = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), cipherText.toString("base64url")].join(".");
}

export function decryptToken(sealed: string, key: Buffer): string {
  assertKey(key);
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("Unknown encrypted token format.");
  const [, ivPart, tagPart, cipherPart] = parts;
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plain = Buffer.concat([decipher.update(Buffer.from(cipherPart, "base64url")), decipher.final()]);
  return plain.toString("utf8");
}
