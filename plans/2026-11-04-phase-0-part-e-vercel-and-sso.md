# Phase 0 Part E: Vercel Deploy and Custom Page SSO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Command Center runs at a public Vercel URL with the cloud database, Tom logs in there with his real email, and a client opening the Command Center menu item inside a demo sub-account sees "Onboarding not started" with their name, through the HighLevel single sign-on handshake.

**Architecture:** Two halves. First the app goes online: the foundation branch merges to `main`, a Vercel project deploys `main` to a stable production URL with the cloud Supabase keys, and HighLevel's portal learns that URL. Then the embed: the `/embed` page asks the HighLevel parent window for the encrypted user payload, posts it to `/api/embed/session`, the server decrypts it with the shared secret (Node `crypto`, no new package), checks the sub-account is installed and active, records the user, and returns a short-lived signed session token the page keeps in memory. No cookies anywhere in the embed, because Safari blocks them in iframes.

**Tech Stack:** Vercel CLI, Next.js 16 route handlers and client components, Node `crypto` (AES-256-CBC with OpenSSL key derivation to match CryptoJS, HMAC-SHA256 for session tokens), Supabase secret client, Vitest.

**Status:** In progress. Part 2 (Tasks 7 to 11, the handshake code) done 2026-11-04 on `feat/part-e-vercel-sso`, proven locally with curl and the RLS suite. Part 1 (going online) and Part 3 (end to end) wait on Tom: Vercel CLI upgrade and the foundation merge to `main`.

---

## Needs Tom first

1. **Upgrade the Vercel CLI** (global tool, not a project dependency). It's at 59 and the current release is 65. Run in any terminal: `npm i -g vercel@latest`
2. **Merge the foundation branch to `main`** on GitHub (Task 1). Nothing deploys to production until `main` has the code.
3. **Three clicks in the Supabase dashboard** (Task 4): signups off, the sign-in email template, the site URL. The Supabase tools Claude has can change the database but not these auth settings.
4. **HighLevel developer portal edits** (Task 5): a second redirect URL and the Custom Page live URL. Claude drives the browser like today; Tom logs in.
5. **One install from the production URL** (Task 6) so the cloud database gets real sub-accounts. The four demo sub-accounts installed today live only in the local database.
6. No new npm packages. No money spent: Vercel Pro is already paid, Supabase stays on its current plan, and the embed makes no AI calls.

**Deferred on purpose:** custom SMTP for login emails. Supabase's built-in sender delivers to organization members, and Tom is one, so his cloud login works. Before Mark or a VA logs in, pick a provider (Resend or similar) and ask Tom.

## Decisions

- **Production URL is the only URL HighLevel knows.** Preview deploys get their own addresses that change per push, and HighLevel needs fixed ones for the OAuth redirect and the Custom Page. So `main` deploys to production at a fixed `*.vercel.app` address (custom domain `command.clickstocloses.com` later), and that address goes into the portal. Previews still work for the admin app and for looking at UI. OAuth installs and the embed are tested on production.
- **Local keeps working.** `.env.local` still points at the local stack. The Custom Page "Testing URL" stays `http://localhost:3000/embed` so the embed can be tried locally if HighLevel serves it to the developer's own agency.
- **The embed session is our own token, not a Supabase JWT.** The trust-model decision left open whether custom HS256 JWTs would be accepted once the cloud project moves to asymmetric signing keys. Supabase now marks HS256 "not recommended for production". So the server issues an HMAC-SHA256 signed token (15 minutes, claims `clientId`, `locationId`, `ghlUserId`, `isStaff`), verifies it on every embed API call, and reads client data with the secret key scoped by the `clientId` from the verified token. The client RLS policies stay as a safety net for the day a browser-side Supabase query is needed. Record this in `docs/decisions/`.
- **Decrypt in Node, no `crypto-js`.** HighLevel encrypts with `CryptoJS.AES.encrypt(text, secret)`: OpenSSL "Salted__" format, key and IV from EVP_BytesToKey with MD5, AES-256-CBC. Node's `crypto` reproduces it in 20 lines, and `openssl enc -aes-256-cbc -md md5` produces test fixtures that prove it.
- **"Active" in Phase 0** means: an installation row exists for the location with `uninstalled_at` null, and the client's `status` is not `paused` or `churned`. The SaaS subscription check (PRD open question 2) waits until the field is confirmed.
- **Staff inside the embed** is only a flag for now (`isStaff` true when the SSO email matches an active staff row). Staff-only controls in the embed come with Phase 1.
- **The embed page never trusts the URL.** The sub-account comes from the decrypted payload's `activeLocation` and nothing else.

## File structure

```
src/lib/ghl/sso.ts                (+ .test.ts)   decryptSsoPayload(payload, sharedSecret): SsoUser. Pure.
src/lib/auth/embed-session.ts     (+ .test.ts)   issueEmbedSession / verifyEmbedSession. Pure, HMAC with EMBED_SESSION_SECRET.
src/lib/auth/embed-client.ts                     resolveEmbedClient(user): the install + active checks, client_users upsert, staff flag. Secret key.
src/lib/embed/handshake.ts                       requestUserData(): the postMessage round trip. Browser only, no secrets.
src/app/api/embed/session/route.ts               POST { payload } -> { token, client, user } or a typed error.
src/app/(embed)/embed/page.tsx                   server shell that renders EmbedApp
src/app/(embed)/embed/EmbedApp.tsx               "use client": handshake, token in memory, the first screen
src/app/(embed)/embed/status.ts                  status -> label map shared by the chip and the copy
docs/decisions/2026-11-04-embed-session-token.md
.env.example, .env.local                         EMBED_SESSION_SECRET
knowledge/ghl-facts.md                           Custom Page SSO section filled in
```

## Part 1: online

### Task 1: Merge the foundation to `main`

- [ ] **Step 1: Open the pull request.** Tom opens this in a browser, titles it "Phase 0 foundation: app shell, database, admin login, HighLevel install", and merges it:

```
https://github.com/clickstocloses/command-center/compare/main...feat/app-scaffold
```

- [ ] **Step 2: Sync locally and start the next branch.**

```bash
git checkout main && git pull && git checkout -b feat/part-e-vercel-sso
```

Expected: `main` is at the merge commit, new branch created.

**Tom can test by:** the GitHub repo's `main` branch shows today's commits.

### Task 2: Create the Vercel project and connect GitHub

- [x] **Step 1: Link.** From the project folder. Answer: set up and deploy? `Y`. Scope: `automated-agency-systems`. Link to existing project? `N`. Project name: `command-center`. Directory: `./`. Modify settings? `N`.

```bash
vercel link --scope automated-agency-systems
```

Expected: `.vercel/project.json` appears (gitignored, confirmed in `.gitignore` line 21).

- [x] **Step 2: Find the production address.**

```bash
vercel project inspect command-center --scope automated-agency-systems
```

Expected: a line with the production domain, normally `command-center.vercel.app` or `command-center-<suffix>.vercel.app`. Write it down as `PROD_URL` (with `https://`) for the next tasks.

- [x] **Step 3: Connect the GitHub repo** so every push gets a preview and `main` deploys to production.

```bash
vercel git connect https://github.com/clickstocloses/command-center.git --scope automated-agency-systems
```

Expected: "Connected GitHub repository". If it says the Vercel GitHub app isn't installed on `clickstocloses`, Tom installs it from the link the command prints (or Vercel dashboard, project Settings, Git, Connect), then rerun.

**Tom can test by:** https://vercel.com/automated-agency-systems/command-center shows the project.

### Task 3: Production environment variables and first deploy

The values come from `.env.local`: the three `# CLOUD_` lines hold the cloud Supabase values, the `GHL_*` lines are the same in production, and `EMBED_SESSION_SECRET` is new.

- [x] **Step 1: Add the embed secret locally** (the `[` characters below are literal; this appends two lines to `.env.local` and `.env.example`).

```bash
printf '\n# Part E: signs the in-memory embed session token. 32 random bytes, base64\nEMBED_SESSION_SECRET=%s\n' "$(openssl rand -base64 32)" >> .env.local
printf '\n# Part E: embed session\nEMBED_SESSION_SECRET=         # server only. 32 random bytes, base64. Signs the in-memory embed session token\n' >> .env.example
```

- [x] **Step 2: Push the variables to Vercel.** One line per variable, for `production` and again for `preview`. The values are read from `.env.local` so nothing is typed into the chat. Run this once with `ENV=production`, then once with `ENV=preview`.

```bash
ENV=production
val() { grep -E "^$1=" .env.local | head -1 | cut -d= -f2- | sed -E 's/[[:space:]]+#.*$//'; }
cval() { grep -E "^# CLOUD_$1=" .env.local | head -1 | cut -d= -f2- | sed -E 's/[[:space:]]+#.*$//'; }
printf '%s' "$(cval NEXT_PUBLIC_SUPABASE_URL)"             | vercel env add NEXT_PUBLIC_SUPABASE_URL $ENV
printf '%s' "$(cval NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)" | vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY $ENV
printf '%s' "$(cval SUPABASE_SECRET_KEY)"                  | vercel env add SUPABASE_SECRET_KEY $ENV
for name in GHL_APP_ID GHL_CLIENT_ID GHL_CLIENT_SECRET GHL_SHARED_SECRET GHL_TOKEN_ENCRYPTION_KEY EMBED_SESSION_SECRET; do
  printf '%s' "$(val $name)" | vercel env add $name $ENV
done
printf '%s' "PROD_URL" | vercel env add NEXT_PUBLIC_APP_URL $ENV
```

Replace `PROD_URL` with the address from Task 2 (for `preview`, use it too: previews can't do OAuth anyway, and the value keeps links sane). Expected: "Added Environment Variable" ten times per environment.

- [x] **Step 3: Check the list, values hidden.**

```bash
vercel env ls
```

Expected: ten names, each listed for Production and Preview. No value is printed.

- [x] **Step 4: First production deploy** (from the `main` checkout so it matches what Git will deploy later).

```bash
git checkout main && vercel --prod --scope automated-agency-systems && git checkout feat/part-e-vercel-sso
```

Expected: build passes (it mirrors `npm run build`), ends with the production URL.

> Done 2026-11-04 from the `feat/part-e-vercel-sso` working tree instead of `main`, because `main` still held only the first commit. Production URL: `https://command-center-five-navy.vercel.app`. Vercel created the project with the framework preset "Other"; fixed with `vercel project update command-center --framework nextjs --yes`. The link step also appended duplicate `.vercel` and `.env*` lines to `.gitignore`, reverted.

- [x] **Step 5: Smoke test.**

```bash
curl -s -o /dev/null -w "%{http_code}\n" PROD_URL/ && curl -s -o /dev/null -w "%{http_code}\n" PROD_URL/admin/login
```

Expected: `200` and `200`.

**Tom can test by:** opening `PROD_URL` and seeing the Clicks to Closes landing page, and `PROD_URL/admin/login` showing the login form.

### Task 4: Cloud Supabase auth settings (Tom, in the dashboard)

- [ ] **Step 1: Signups off.** https://supabase.com/dashboard/project/hblynaefpbskueyfghqj/auth/providers, open Email, turn off "Allow new users to sign up", keep Email enabled, save. (This is the per-project setting that matches local `[auth] enable_signup = false`. Do not turn off the Email provider itself; that disables login.)
- [ ] **Step 2: Sign-in email shows the code.** https://supabase.com/dashboard/project/hblynaefpbskueyfghqj/auth/templates, Magic Link: subject `Your Command Center sign-in code`, body replaced with the contents of `supabase/templates/magic_link.html`, save.
- [ ] **Step 3: URLs.** https://supabase.com/dashboard/project/hblynaefpbskueyfghqj/auth/url-configuration: Site URL `PROD_URL`, Redirect URLs add `PROD_URL/admin/auth/confirm` and `https://*-automated-agency-systems.vercel.app/admin/auth/confirm` (so preview deploys can log in too), save.
- [ ] **Step 4: Log in online.** Open `PROD_URL/admin/login`, enter `tom@clickstocloses.com`. The code arrives in Tom's real inbox (Supabase's sender delivers to organization members). Enter it.

Expected: the dashboard loads with "Owner", and the client list is empty (the cloud database has no fake clients; only real installs land there).

**Tom can test by:** Step 4.

### Task 5: Tell HighLevel the production URL (Claude drives the browser, Tom logged in)

- [ ] **Step 1: Second redirect URL.** Portal, Command Center, Advanced Settings, Auth (`https://marketplace.gohighlevel.com/app-settings/6adbaef517cfbe55659d0934/version/6adbaef517cfbe55659d0934/advanced/auth`): under Redirect URLs add `PROD_URL/api/oauth/callback`, keep the localhost one, Save. Reload and confirm both are listed.
- [ ] **Step 2: Custom Page live URL.** Portal, Command Center, Modules, Custom Pages, the page with id `6adbb028b2f372a738f49bf1`: Live URL `PROD_URL/embed`, Testing URL stays `http://localhost:3000/embed`, Save. Note the exact field names in `knowledge/ghl-facts.md`.

**Tom can test by:** nothing yet; Task 6 proves it.

### Task 6: Install from production

- [ ] **Step 1:** Tom opens `PROD_URL/api/oauth/install` in his HighLevel-logged-in browser, picks the same demo sub-accounts, approves.

Expected: `PROD_URL/install/done` lists the sub-accounts. `PROD_URL/admin` lists them as clients.

- [ ] **Step 2: Verify the cloud rows, tokens stay hidden.** Run through the Supabase connector's `execute_sql` on project `hblynaefpbskueyfghqj`:

```sql
select c.name, c.status, i.token_source, i.token_expires_at > now() as token_live
from public.clients c join public.ghl_installations i on i.client_id = c.id
order by c.name;
```

Expected: one row per demo sub-account, `token_source = 'agency'`, `token_live = true`.

- [ ] **Step 3: Commit the env example change and update CLAUDE.md** ("Where the repo actually is": the app is online at `PROD_URL`; the Commands table's `/ship` note now has a real preview). Commit on `feat/part-e-vercel-sso`.

```bash
git add .env.example CLAUDE.md && git commit -m "Record the Vercel production URL and the embed session secret name" && git push -u origin feat/part-e-vercel-sso
```

**Tom can test by:** the admin dashboard at `PROD_URL/admin` shows the demo sub-accounts.

## Part 2: the handshake

### Task 7: Decrypt the SSO payload (TDD)

**Files:**
- Create: `src/lib/ghl/sso.ts`, `src/lib/ghl/sso.test.ts`

- [x] **Step 1: Failing test.** The fixture was made with `openssl enc -aes-256-cbc -md md5 -pass pass:test-shared-secret -base64 -A`, which is byte-for-byte what `CryptoJS.AES.encrypt` produces.

```ts
import { describe, expect, it } from "vitest";
import { decryptSsoPayload } from "./sso";

// Produced by: printf '%s' '<json below>' | openssl enc -aes-256-cbc -md md5 -pass pass:test-shared-secret -base64 -A
const FIXTURE =
  "U2FsdGVkX19rkKV9eDTTMEYUBHTAqMW/YErzDTKOmZQpxskIQpPaYs8B/Ca8Fvm6bqPhM3ZEO/TJbgHctyM4+ZZaI8NiLFSmJM6Ba94Z55Mt+8RTnqO6Fn6u8dtZ51etRq+bMWyvjYcgxV7LUgWufIU9Ubye030lUCuXlBvxVSnTCMgsntAw9dRDLqSqvRr2K/TdOvf9gD1Lsexe7iY2SA2RFft2+Z3TwH1asLEyvLxte/31aLH6iNk9Dr/UE1ED";
const SECRET = "test-shared-secret";

describe("decryptSsoPayload", () => {
  it("decrypts a CryptoJS-style payload and returns the user", () => {
    const user = decryptSsoPayload(FIXTURE, SECRET);
    expect(user).toEqual({
      userId: "usr_test_1",
      companyId: "co_test_1",
      role: "admin",
      type: "location",
      activeLocation: "loc_fake_northside",
      userName: "Casey Client",
      email: "casey@example.com",
    });
  });

  it("fails with the wrong secret", () => {
    expect(() => decryptSsoPayload(FIXTURE, "nope")).toThrow(/decrypt/i);
  });

  it("rejects something that is not a Salted__ payload", () => {
    expect(() => decryptSsoPayload(Buffer.from("hello world, not encrypted at all").toString("base64"), SECRET)).toThrow(/format/i);
    expect(() => decryptSsoPayload("", SECRET)).toThrow(/format/i);
  });

  it("rejects decrypted JSON that lacks the required fields", () => {
    // Encrypted {"hello":"world"} with the same secret.
    const noFields = "U2FsdGVkX184L2f8r9XZ0pLmTak1dOaNawCeiZFEmE/+3hSk8U5NboQC/QxxRRhw";
    expect(() => decryptSsoPayload(noFields, SECRET)).toThrow(/userId/i);
  });
});
```

- [x] **Step 2: Run, expect failure.** `npx vitest run src/lib/ghl/sso.test.ts` fails with "Failed to load" or "is not a function".

- [x] **Step 3: Implement.**

```ts
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
```

- [x] **Step 4: Run, expect pass.** `npx vitest run src/lib/ghl/sso.test.ts` shows 4 passed.

- [x] **Step 5: Commit.**

```bash
git add src/lib/ghl/sso.ts src/lib/ghl/sso.test.ts && git commit -m "Decrypt the HighLevel Custom Page SSO payload with Node crypto"
```

### Task 8: The embed session token (TDD)

**Files:**
- Create: `src/lib/auth/embed-session.ts`, `src/lib/auth/embed-session.test.ts`

- [x] **Step 1: Failing test.**

```ts
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
```

- [x] **Step 2: Run, expect failure.** `npx vitest run src/lib/auth/embed-session.test.ts`

- [x] **Step 3: Implement.**

```ts
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
```

- [x] **Step 4: Run, expect pass.** 4 passed.

- [x] **Step 5: Commit.**

```bash
git add src/lib/auth/embed-session.ts src/lib/auth/embed-session.test.ts && git commit -m "Add the signed in-memory embed session token"
```

### Task 9: Resolve the client and the session route

**Files:**
- Create: `src/lib/auth/embed-client.ts`, `src/app/api/embed/session/route.ts`, `src/app/(embed)/embed/status.ts`

- [x] **Step 1: Status labels** (shared by the API, the chip and the copy).

```ts
// src/app/(embed)/embed/status.ts
export const CLIENT_STATUS_LABELS: Record<string, string> = {
  onboarding_not_started: "Onboarding not started",
  onboarding_in_progress: "Onboarding in progress",
  onboarding_complete: "Onboarding complete",
  active: "Active",
  paused: "Paused",
  churned: "Closed",
};

export function clientStatusLabel(status: string): string {
  return CLIENT_STATUS_LABELS[status] ?? status;
}
```

- [x] **Step 2: The checks.** Secret key, scoped by the location from the decrypted payload.

```ts
// src/lib/auth/embed-client.ts
import { createSecretSupabase } from "@/lib/supabase/server";
import type { SsoUser } from "@/lib/ghl/sso";

export type EmbedClient = { id: string; name: string; status: string };

export type ResolveResult =
  | { ok: true; client: EmbedClient; isStaff: boolean }
  | { ok: false; reason: "no_location" | "not_installed" | "inactive" };

const INACTIVE_STATUSES = new Set(["paused", "churned"]);

/**
 * The three checks from PRD 4.1, Phase 0 version: the location has the app
 * installed, the client isn't paused or closed, and the user is recorded as
 * one of that client's users. The SaaS subscription check comes later.
 */
export async function resolveEmbedClient(user: SsoUser): Promise<ResolveResult> {
  if (!user.activeLocation) return { ok: false, reason: "no_location" };
  const supabase = createSecretSupabase();

  const { data: client, error } = await supabase
    .from("clients")
    .select("id, name, status, ghl_installations!inner(uninstalled_at)")
    .eq("ghl_location_id", user.activeLocation)
    .maybeSingle();
  if (error) throw new Error(`Could not look up the client: ${error.message}`);
  const installation = (client?.ghl_installations as { uninstalled_at: string | null }[] | { uninstalled_at: string | null } | undefined);
  const uninstalledAt = Array.isArray(installation) ? installation[0]?.uninstalled_at : installation?.uninstalled_at;
  if (!client || uninstalledAt) return { ok: false, reason: "not_installed" };
  if (INACTIVE_STATUSES.has(client.status)) return { ok: false, reason: "inactive" };

  const { error: userError } = await supabase.from("client_users").upsert(
    {
      client_id: client.id,
      ghl_user_id: user.userId,
      name: user.userName,
      email: user.email,
      role: user.role,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "client_id,ghl_user_id" },
  );
  if (userError) throw new Error(`Could not record the client user: ${userError.message}`);

  let isStaff = false;
  if (user.email) {
    const { data: staff } = await supabase
      .from("staff")
      .select("id")
      .eq("email", user.email.trim().toLowerCase())
      .eq("active", true)
      .maybeSingle();
    isStaff = Boolean(staff);
  }

  return { ok: true, client: { id: client.id, name: client.name, status: client.status }, isStaff };
}
```

- [x] **Step 3: The route.** POST only. Never logs the payload.

```ts
// src/app/api/embed/session/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { writeAuditLog } from "@/lib/audit/log";
import { resolveEmbedClient } from "@/lib/auth/embed-client";
import { embedSessionSecret, issueEmbedSession, EMBED_SESSION_TTL_SECONDS } from "@/lib/auth/embed-session";
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
```

- [x] **Step 4: Typecheck and lint.** `npm run typecheck && npm run lint` both clean. If the `ghl_installations!inner` select trips the type of `client.ghl_installations`, keep the cast shown above; it's the one place the join shape is read.

- [x] **Step 5: Local proof with curl.** With `npm run up` running, encrypt a payload for the local demo install "Demo Onboarding" (`yXnrwLhFCcFhLtGsQhpr`) using the real local shared secret, then post it:

```bash
SECRET="$(grep -E '^GHL_SHARED_SECRET=' .env.local | cut -d= -f2-)"
PAYLOAD="$(printf '%s' '{"userId":"usr_curl","companyId":"co_curl","role":"admin","type":"location","activeLocation":"yXnrwLhFCcFhLtGsQhpr","userName":"Curl Test","email":"curl@example.com"}' | openssl enc -aes-256-cbc -md md5 -pass "pass:$SECRET" -base64 -A)"
curl -s -X POST http://localhost:3000/api/embed/session -H 'Content-Type: application/json' -d "{\"payload\":\"$PAYLOAD\"}"
```

Expected: JSON with a `token`, `client.name` "Demo Onboarding", `client.statusLabel` "Onboarding not started". A second call with `activeLocation` set to `loc_nope` returns `{"error":"not_installed"}` with 403. A call with `"payload":"garbage"` returns 401.

- [x] **Step 6: Commit.**

```bash
git add src/lib/auth/embed-client.ts src/app/api/embed/session/route.ts "src/app/(embed)/embed/status.ts" && git commit -m "Add the embed session route: decrypt SSO, check the client, issue a token"
```

### Task 10: The embed page

**Files:**
- Create: `src/lib/embed/handshake.ts`, `src/app/(embed)/embed/EmbedApp.tsx`
- Modify: `src/app/(embed)/embed/page.tsx`

- [x] **Step 1: The handshake helper.** Browser only. Resolves with the encrypted payload or rejects after the timeout (which is what happens when the page is opened outside HighLevel).

```ts
// src/lib/embed/handshake.ts
const REQUEST = "REQUEST_USER_DATA";
const RESPONSE = "REQUEST_USER_DATA_RESPONSE";

/**
 * Ask the HighLevel parent window for the encrypted user payload. The payload is
 * encrypted with the shared secret, so the origin of the reply doesn't need to be
 * trusted; only the server can read it.
 */
export function requestUserData(timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (window.parent === window) {
      reject(new Error("not_in_iframe"));
      return;
    }
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("timeout"));
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      const data = event.data as { message?: unknown; payload?: unknown } | null;
      if (!data || data.message !== RESPONSE) return;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      if (typeof data.payload === "string" && data.payload) resolve(data.payload);
      else reject(new Error("empty_payload"));
    }

    window.addEventListener("message", onMessage);
    window.parent.postMessage({ message: REQUEST }, "*");
  });
}
```

- [x] **Step 2: The client component.** Token in React state only. Re-runs the handshake on every load.

```tsx
// src/app/(embed)/embed/EmbedApp.tsx
"use client";

import { useEffect, useState } from "react";
import { StatusChip } from "@/components/brand/StatusChip";
import { Wordmark } from "@/components/brand/Wordmark";
import { requestUserData } from "@/lib/embed/handshake";
import type { EmbedSessionResponse } from "@/app/api/embed/session/route";

type State =
  | { kind: "connecting" }
  | { kind: "ready"; session: EmbedSessionResponse }
  | { kind: "error"; code: string };

const ERROR_COPY: Record<string, string> = {
  not_in_iframe: "Open Command Center from the menu inside your HighLevel account.",
  timeout: "HighLevel didn't answer. Refresh the page, or open Command Center from the menu again.",
  not_installed: "Command Center isn't set up on this account yet. Contact Clicks to Closes.",
  inactive: "Your account isn't active. Contact Clicks to Closes.",
  no_location: "Open Command Center from inside a sub-account, not the agency view.",
  bad_payload: "We couldn't verify your HighLevel session. Refresh and try again.",
};

export function EmbedApp() {
  const [state, setState] = useState<State>({ kind: "connecting" });

  useEffect(() => {
    let cancelled = false;
    async function connect() {
      try {
        const payload = await requestUserData();
        const response = await fetch("/api/embed/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload }),
        });
        const body = (await response.json()) as EmbedSessionResponse | { error: string };
        if (cancelled) return;
        if (!response.ok || "error" in body) {
          setState({ kind: "error", code: "error" in body ? body.error : "bad_payload" });
          return;
        }
        setState({ kind: "ready", session: body });
      } catch (cause) {
        if (!cancelled) setState({ kind: "error", code: cause instanceof Error ? cause.message : "timeout" });
      }
    }
    void connect();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "connecting") {
    return (
      <main className="page">
        <header className="row" style={{ justifyContent: "space-between" }}>
          <Wordmark />
          <StatusChip label="Connecting" />
        </header>
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main className="page">
        <header className="row" style={{ justifyContent: "space-between" }}>
          <Wordmark />
          <StatusChip label="Not connected" />
        </header>
        <section className="panel">
          <h2>We couldn&apos;t open Command Center</h2>
          <p className="notice notice-error">{ERROR_COPY[state.code] ?? ERROR_COPY.bad_payload}</p>
        </section>
      </main>
    );
  }

  const { client, user } = state.session;
  return (
    <main className="page">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <Wordmark />
        <StatusChip label={client.statusLabel} />
      </header>
      <section className="panel">
        <h2>Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}</h2>
        <p>
          This is Command Center for <strong>{client.name}</strong>.
        </p>
        <p className="muted">
          Your onboarding hasn&apos;t started yet. When it opens, this is where you&apos;ll answer the setup
          questions, record your voice profile and see everything we build for you.
        </p>
        {user.isStaff ? <p className="mono muted">Staff view</p> : null}
      </section>
    </main>
  );
}
```

- [x] **Step 3: The page.** Replace the placeholder.

```tsx
// src/app/(embed)/embed/page.tsx
import { EmbedApp } from "./EmbedApp";

// Loaded inside the HighLevel Custom Page iframe. Everything that needs to know
// who is asking happens in EmbedApp after the single sign-on handshake.
export default function EmbedPage() {
  return <EmbedApp />;
}
```

- [x] **Step 4: Check and build.** `npm run check` green, `npm run build` green (the route type import `EmbedSessionResponse` is a type-only import, so no server code reaches the browser bundle; confirm with `grep -c sharedSecret .next/static -r` returning 0).

- [x] **Step 5: Look at it outside HighLevel.** Open http://localhost:3000/embed. Expected: the "We couldn't open Command Center" panel with the "Open Command Center from the menu inside your HighLevel account." line, in brand styling, within a second.

- [x] **Step 6: Commit and push** (the push gives a Vercel preview URL for the UI, once Task 2 Step 3 connected Git).

```bash
git add src/lib/embed/handshake.ts "src/app/(embed)/embed/" && git commit -m "Embed page: SSO handshake, in-memory session, first screen" && git push
```

**Tom can test by:** Step 5 locally, or the preview URL's `/embed`.

### Task 11: Decision note and facts

**Files:**
- Create: `docs/decisions/2026-11-04-embed-session-token.md`
- Modify: `knowledge/ghl-facts.md` (the "Custom Page SSO" section), `docs/decisions/2026-10-22-database-trust-model.md` (the "Open" item)

- [x] **Step 1: Decision note.**

```markdown
# Embed session token

**Date:** 2026-11-04
**Status:** decided, implemented in `src/lib/auth/embed-session.ts`

## The decision

After the HighLevel single sign-on payload is decrypted and the sub-account passes the install and active checks, the server issues its own HMAC-SHA256 signed token (15 minutes; claims `clientId`, `locationId`, `ghlUserId`, `isStaff`). The embed page keeps it in memory and sends it as a Bearer header. Embed API routes verify it and read data with the secret-key Supabase client, scoped by the `clientId` from the token.

It is not a Supabase JWT. The trust-model note left open whether custom HS256 JWTs would keep working once the cloud project moves to asymmetric signing keys; Supabase now marks HS256 as not recommended. Nothing in Phase 0 or 1 needs the browser to query Supabase directly, so the question is moot.

## What stays

The client RLS policies (`current_client_id()`) remain and are tested. If a browser-side Supabase query is ever needed, mint a Supabase-signed token then, with the signing key the project uses at that time.
```

- [x] **Step 2: Facts.** Replace the "(To fill in during Phase 0 Part E...)" line with what was learned: the message names (`REQUEST_USER_DATA` out, `REQUEST_USER_DATA_RESPONSE` in, payload in `event.data.payload`), the encryption (CryptoJS passphrase mode, reproduced with `openssl enc -aes-256-cbc -md md5`), the fields (`userId`, `companyId`, `role`, `type` agency or location, `activeLocation` only in a location context, `userName`, `email`), where the Live and Testing URLs are set, and anything the end-to-end test in Task 12 reveals (for example whether the Testing URL is served to the developer's own agency).

- [x] **Step 3: Close the open item** in the trust-model note: "Resolved 2026-11-04: not needed, see `2026-11-04-embed-session-token.md`."

- [x] **Step 4: Commit.**

```bash
git add docs/decisions knowledge/ghl-facts.md && git commit -m "Record the embed session decision and the Custom Page SSO facts"
```

## Part 3: prove it

### Task 12: End to end inside HighLevel

- [ ] **Step 1: Ship to production.** Open the pull request for `feat/part-e-vercel-sso`, Tom merges it, Vercel deploys `main`. Confirm with:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST PROD_URL/api/embed/session -H 'Content-Type: application/json' -d '{"payload":"garbage"}'
```

Expected: `401`.

- [ ] **Step 2: Tom opens the menu item.** In HighLevel, switch into "Demo Onboarding" (or any demo sub-account from Task 6), click "Command Center" in the left menu.

Expected: the page loads inside HighLevel, the chip says "Onboarding not started", the heading says "Welcome, Tom", and the panel names the sub-account. Since Tom's email is on the staff list, the small "Staff view" line shows too.

- [ ] **Step 3: Check the trail** through the Supabase connector on the cloud project:

```sql
select cu.name, cu.email, cu.role, cu.last_seen_at, c.name as client
from public.client_users cu join public.clients c on c.id = cu.client_id
order by cu.last_seen_at desc limit 5;
select action, actor_id, created_at from public.audit_log where action = 'client.sso' order by created_at desc limit 5;
```

Expected: one `client_users` row for Tom under that client, one `client.sso` audit row.

- [ ] **Step 4: Safari.** Tom repeats Step 2 in Safari. Expected: identical, because nothing depends on cookies.

- [ ] **Step 5: Not installed.** Tom switches to a sub-account that does not have the app and types the Custom Page URL by hand if the menu item is absent. Expected: either no menu item (HighLevel hides it) or the "isn't set up on this account yet" message. Either is correct.

- [ ] **Step 6: Close out.** Mark this plan Done. Update `CLAUDE.md`: Part E done, the app's production URL, `/ship` now hands back real preview links, "Next up" becomes Part F then the Phase 1 ports. Commit on a small branch and merge.

**Tom can test by:** Step 2. That is the Phase 0 roadmap's "done when" line, minus usage metering, which is Part F.

## Part E done when

Tom opens Command Center from the menu inside a demo sub-account on the production URL and sees "Onboarding not started" with his name; the cloud database shows the client user and the audit row; the same works in Safari.
