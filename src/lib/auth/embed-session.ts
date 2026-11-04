import { createHmac, timingSafeEqual } from "node:crypto";

export const EMBED_SESSION_TTL_SECONDS = 15 * 60;

export type EmbedSessionClaims = {
  clientId: string;
  locationId: string;
  ghlUserId: string;
  isStaff: boolean;
};

export type EmbedSession = EmbedSessionClaims & { expiresAt: number };

function checkSecret(secret: Buffer): void {
  if (secret.length < 32) throw new Error("The embed session secret must be at least 32 bytes.");
}

function sign(body: string, secret: Buffer): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/** A short-lived token the embed page keeps in memory and sends as a Bearer header. */
export function issueEmbedSession(claims: EmbedSessionClaims, secret: Buffer, now = Date.now()): string {
  checkSecret(secret);
  const session: EmbedSession = { ...claims, expiresAt: Math.floor(now / 1000) + EMBED_SESSION_TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/** Null for anything that isn't a valid, unexpired token signed with this secret. */
export function verifyEmbedSession(token: string | null | undefined, secret: Buffer, now = Date.now()): EmbedSession | null {
  checkSecret(secret);
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as EmbedSession;
    if (typeof session.expiresAt !== "number" || session.expiresAt * 1000 <= now) return null;
    if (typeof session.clientId !== "string" || typeof session.locationId !== "string" || typeof session.ghlUserId !== "string") return null;
    return { ...session, isStaff: session.isStaff === true };
  } catch {
    return null;
  }
}

/** The secret from the environment, decoded. Server only. */
export function embedSessionSecret(): Buffer {
  const value = process.env.EMBED_SESSION_SECRET;
  if (!value) throw new Error("Missing environment variable EMBED_SESSION_SECRET. See .env.example.");
  const secret = Buffer.from(value, "base64");
  checkSecret(secret);
  return secret;
}
