# Embed session token

**Date:** 2026-11-04
**Status:** decided, implemented in `src/lib/auth/embed-session.ts`

## The decision

After the HighLevel single sign-on payload is decrypted and the sub-account passes the install and active checks, the server issues its own HMAC-SHA256 signed token (15 minutes; claims `clientId`, `locationId`, `ghlUserId`, `isStaff`). The embed page keeps it in memory and sends it as a Bearer header. Embed API routes verify it and read data with the secret-key Supabase client, scoped by the `clientId` from the token.

It is not a Supabase JWT. The trust-model note left open whether custom HS256 JWTs would keep working once the cloud project moves to asymmetric signing keys; Supabase now marks HS256 as not recommended. Nothing in Phase 0 or 1 needs the browser to query Supabase directly, so the question is moot.

## What stays

The client RLS policies (`current_client_id()`) remain and are tested. If a browser-side Supabase query is ever needed, mint a Supabase-signed token then, with the signing key the project uses at that time.
