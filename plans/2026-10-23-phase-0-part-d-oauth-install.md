# Phase 0 Part D: HighLevel OAuth Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tom installs the Command Center app on a test sub-account. The callback exchanges the code for tokens, creates the `clients` row and an encrypted `ghl_installations` row, and the client appears on the admin dashboard.

**Architecture:** One module, `src/lib/ghl/`, owns everything HighLevel: env, token encryption at rest, the OAuth exchange and refresh, saving installations, and `ghlFetch`, the only function that calls the HighLevel API. Route handlers under `/api/oauth/` are thin. Tokens are AES-256-GCM encrypted with `GHL_TOKEN_ENCRYPTION_KEY` before they touch the database, and only the secret-key Supabase client reads them.

**Tech Stack:** Next.js route handlers, Node `crypto`, HighLevel API v2 at `services.leadconnectorhq.com`, Supabase secret client.

**Status:** In progress 2026-10-23. Portal setup done the same day (see `knowledge/ghl-facts.md`).

---

## Decisions

- **Callback path is `/api/oauth/callback`.** The portal rejects redirect URLs containing `ghl`.
- **Location tokens only.** The app targets sub-accounts, so every install yields a token with `userType: Location` and a `locationId`. An agency-level token (no `locationId`) is rejected with a clear message.
- **The install creates the client.** After the exchange, `GET /locations/{id}` fills name, time zone and website. Status starts at `onboarding_not_started`. Re-installing updates the installation row and clears `uninstalled_at`; the client row keeps its data.
- **Refresh on demand, not on a timer, for now.** `getLocationAccessToken()` refreshes when the token expires within 5 minutes and on a 401. The Inngest cron that refreshes ahead of expiry is Part F.
- **No `state` parameter.** Installs start from HighLevel's own marketplace link, which doesn't carry one. The code is single-use and the exchange needs the client secret, so the exposure is someone attaching a location they control inside Tom's agency to this app, which changes nothing.
- **Public result pages.** `/install/done` and `/install/error` need no login, because the person installing may be a team member who isn't signed into the admin app in that browser.

## File structure

```
src/lib/ghl/env.ts                        GHL_* env getters, API base URL and Version header
src/lib/ghl/token-crypto.ts  (+ .test.ts) encryptToken / decryptToken, AES-256-GCM, "v1.iv.tag.ciphertext"
src/lib/ghl/oauth.ts         (+ .test.ts) buildInstallUrl, exchangeCodeForTokens, refreshAccessToken, parseTokenResponse
src/lib/ghl/installations.ts              saveInstallation, getLocationAccessToken (decrypt, refresh when due)
src/lib/ghl/client.ts                     ghlFetch(locationId, path, init): auth, Version header, one retry after refresh on 401
src/lib/ghl/locations.ts                  fetchLocation(locationId)
src/app/api/oauth/install/route.ts        GET: redirect to the install URL (handy link for Tom)
src/app/api/oauth/callback/route.ts       GET: code -> tokens -> location -> save -> audit -> /install/done
src/app/install/done/page.tsx             "Installed on <name>", link to the admin
src/app/install/error/page.tsx            plain-language reason, link to retry
src/app/(admin)/admin/(protected)/page.tsx  adds an "Install on a sub-account" button
```

## Tasks

### Task D1: Env and token encryption (TDD)

- [ ] `env.ts`: `ghlEnv()` returns clientId, clientSecret, sharedSecret, appId, tokenEncryptionKey (decoded, must be 32 bytes). Throws naming the missing variable.
- [ ] Failing tests for `token-crypto.ts`: round trip; different ciphertext for the same input twice (random IV); tampering fails; wrong key fails; rejects a key that isn't 32 bytes.
- [ ] Implement with `crypto.createCipheriv("aes-256-gcm")`.

### Task D2: OAuth exchange (TDD for the pure parts)

- [ ] Failing tests: `buildInstallUrl()` contains the client id, the encoded callback and all 13 scopes; `parseTokenResponse()` rejects a payload without `locationId` or `refresh_token` and returns typed data otherwise.
- [ ] `exchangeCodeForTokens(code)` posts `application/x-www-form-urlencoded` to `/oauth/token` with `client_id`, `client_secret`, `grant_type=authorization_code`, `code`, `user_type=Location`, `redirect_uri`. `refreshAccessToken(refreshToken)` posts `grant_type=refresh_token`, `user_type=Location`.

### Task D3: Save and read installations

- [ ] `saveInstallation()`: upsert `clients` on `ghl_location_id`, then upsert `ghl_installations` on `ghl_location_id` with encrypted tokens, `token_expires_at = now + expires_in - 60s`, scopes split on spaces, `uninstalled_at = null`.
- [ ] `getLocationAccessToken(locationId)`: load, decrypt, refresh if `token_expires_at` is within 5 minutes, persist the new pair, return the access token. Records `last_refresh_error` on failure.
- [ ] `ghlFetch()`: adds `Authorization: Bearer`, `Version: 2021-07-28`, `Accept: application/json`. On 401, refresh once and retry.

### Task D4: Routes and pages

- [ ] `/api/oauth/install`: 302 to `buildInstallUrl()`.
- [ ] `/api/oauth/callback`: reads `code` (and `error`), runs the exchange, `fetchLocation`, `saveInstallation`, writes `audit_log` action `ghl.install`, redirects to `/install/done?location=<id>`. Any failure logs the cause server-side and redirects to `/install/error?reason=<short code>`. Never puts tokens in a URL or a log.
- [ ] Result pages, branded, inside Suspense where they read search params.
- [ ] Dashboard button linking to `/api/oauth/install`.

### Task D5: Prove it

- [ ] `npm run check` and `npm run build` green.
- [ ] Tom installs on a test sub-account through the portal's install link (or the dashboard button). Expected: lands on `/install/done` with the location name; `/admin` lists the new client; `ghl_installations` has one row with encrypted tokens (never plain text); `audit_log` has `ghl.install`.
- [ ] Record what the real token response and location response looked like (field names only) in `knowledge/ghl-facts.md`.
- [ ] Commit. Update CLAUDE.md status.

### Part D done when

A real sub-account is installed, shows on the dashboard, and `ghlFetch` can read its location with the stored token.
