# Database trust model

**Date:** 2026-10-22
**Status:** decided, implemented in `supabase/migrations/20261023020000_foundation.sql`

## The decision

The database recognizes three callers, and row-level security is written and tested for all of them from day one.

1. **The server with the secret key.** Bypasses RLS. Used by the SSO route, the OAuth callback, Inngest jobs and AI metering. It scopes every query in code.
2. **A staff member** signed in through Supabase Auth with email OTP. `auth.uid()` matches `staff.auth_user_id`. `is_staff()` and `is_owner()` gate the policies. The database only distinguishes owner from team. Finer permissions are a JSON checklist on the staff row that server code checks, so a new permission is a config change, not a migration.
3. **A client session.** After HighLevel SSO is verified, the server mints a short-lived JWT carrying a `client_id` claim. `current_client_id()` reads it. A client can read its own `clients` and `client_users` rows and nothing else. Until Part E mints that token, client reads go through the server.

## Rules that fall out of it

- `ghl_installations` has no RLS policies at all. Only the secret key can touch tokens. Staff dashboards that need token health read a view without the token columns (to add in Part D).
- `usage_events` and `audit_log` are append-only from the server. Staff read, nobody else writes.
- Every table has RLS on. The RLS tests in `tests/rls/` prove the policies with the four callers above against the local stack, and they're part of `npm run check` whenever the local stack is running.
- The new Supabase key format is used everywhere: `sb_publishable_...` in the browser, `sb_secret_...` on the server. The legacy anon and service_role JWTs are not referenced.

## Why not simpler

A server-only model with no client policies would work for Phase 0, but then the first time a client-facing query slipped through with the wrong scope, nothing would catch it. Writing the client policies now costs one function and three policies, and the tests make the boundary visible.

## Open

- Whether custom JWTs signed with the project's legacy HS256 secret are accepted by the cloud project once it's on asymmetric signing keys. Verify in Part E before relying on it. Fallback: issue client sessions through Supabase Auth anonymous sign-in with `client_id` in app metadata.
