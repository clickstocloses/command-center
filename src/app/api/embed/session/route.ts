import { NextResponse, type NextRequest } from "next/server";
import { writeAuditLog } from "@/lib/audit/log";
import { resolveEmbedClient } from "@/lib/auth/embed-client";
import { EMBED_SESSION_TTL_SECONDS, embedSessionSecret, issueEmbedSession } from "@/lib/auth/embed-session";
import { ghlEnv } from "@/lib/ghl/env";
import { decryptSsoPayload } from "@/lib/ghl/sso";
import { clientStatusLabel } from "@/app/(embed)/embed/status";

export type EmbedSessionResponse = {
  token: string;
  expiresInSeconds: number;
  client: { name: string; status: string; statusLabel: string };
  user: { name: string | null; isStaff: boolean };
};

/**
 * The embed page posts the encrypted payload HighLevel handed it. We decrypt it
 * with the shared secret, check the sub-account, and hand back a session token
 * the page keeps in memory. No cookies: Safari blocks them inside the iframe.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { payload?: unknown } | null;
  if (!body || typeof body.payload !== "string" || !body.payload) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  let user;
  try {
    user = decryptSsoPayload(body.payload, ghlEnv().sharedSecret);
  } catch (cause) {
    // The payload itself is never logged: it is the user's identity.
    console.error("embed session: decrypt failed", cause instanceof Error ? cause.message : cause);
    return NextResponse.json({ error: "bad_payload" }, { status: 401 });
  }

  const resolved = await resolveEmbedClient(user);
  if (!resolved.ok) {
    console.warn("embed session refused", resolved.reason, { location: user.activeLocation });
    return NextResponse.json({ error: resolved.reason }, { status: 403 });
  }

  const token = issueEmbedSession(
    { clientId: resolved.client.id, locationId: user.activeLocation as string, ghlUserId: user.userId, isStaff: resolved.isStaff },
    embedSessionSecret(),
  );

  await writeAuditLog({
    actorType: "client_user",
    actorId: user.userId,
    clientId: resolved.client.id,
    action: "client.sso",
    after: { type: user.type, role: user.role, is_staff: resolved.isStaff },
  });

  const response: EmbedSessionResponse = {
    token,
    expiresInSeconds: EMBED_SESSION_TTL_SECONDS,
    client: { name: resolved.client.name, status: resolved.client.status, statusLabel: clientStatusLabel(resolved.client.status) },
    user: { name: user.userName, isStaff: resolved.isStaff },
  };
  return NextResponse.json(response, { headers: { "Cache-Control": "private, no-store" } });
}
