import { createDecipheriv, createHash } from "node:crypto";

export type SsoUser = {
  userId: string;
  companyId: string;
  role: string;
  type: "agency" | "location";
  activeLocation: string | null;
  userName: string | null;
  email: string | null;
};

const SALT_HEADER = Buffer.from("Salted__", "latin1");
const KEY_BYTES = 32;
const IV_BYTES = 16;

/**
 * CryptoJS.AES.encrypt(text, passphrase) is OpenSSL's legacy format: "Salted__",
 * an 8 byte salt, then AES-256-CBC. Key and IV come from EVP_BytesToKey with MD5
 * and one round. This is the same derivation, so no crypto-js dependency.
 */
function deriveKeyAndIv(passphrase: Buffer, salt: Buffer): { key: Buffer; iv: Buffer } {
  const chunks: Buffer[] = [];
  let previous = Buffer.alloc(0);
  let total = 0;
  while (total < KEY_BYTES + IV_BYTES) {
    previous = createHash("md5").update(Buffer.concat([previous, passphrase, salt])).digest();
    chunks.push(previous);
    total += previous.length;
  }
  const material = Buffer.concat(chunks);
  return { key: material.subarray(0, KEY_BYTES), iv: material.subarray(KEY_BYTES, KEY_BYTES + IV_BYTES) };
}

function text(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value ? value : null;
}

function parseSsoUser(raw: unknown): SsoUser {
  if (!raw || typeof raw !== "object") throw new Error("SSO payload did not decrypt to an object.");
  const record = raw as Record<string, unknown>;
  const userId = text(record, "userId");
  const companyId = text(record, "companyId");
  if (!userId) throw new Error("SSO payload has no userId.");
  if (!companyId) throw new Error("SSO payload has no companyId.");
  const type = record.type === "agency" ? "agency" : "location";
  return {
    userId,
    companyId,
    role: text(record, "role") ?? "user",
    type,
    activeLocation: text(record, "activeLocation"),
    userName: text(record, "userName"),
    email: text(record, "email"),
  };
}

export function decryptSsoPayload(payloadBase64: string, sharedSecret: string): SsoUser {
  const raw = Buffer.from(payloadBase64, "base64");
  // Header, salt and at least one cipher block.
  if (raw.length < 32 || !raw.subarray(0, 8).equals(SALT_HEADER)) {
    throw new Error("SSO payload is not in the expected format.");
  }
  const salt = raw.subarray(8, 16);
  const { key, iv } = deriveKeyAndIv(Buffer.from(sharedSecret, "utf8"), salt);

  let plain: string;
  try {
    const decipher = createDecipheriv("aes-256-cbc", key, iv);
    plain = Buffer.concat([decipher.update(raw.subarray(16)), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("SSO payload could not be decrypted. Check GHL_SHARED_SECRET.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(plain);
  } catch {
    throw new Error("SSO payload could not be decrypted to JSON. Check GHL_SHARED_SECRET.");
  }
  return parseSsoUser(parsed);
}
