# Phase 0 Part B: Database Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** The six Phase 0 tables exist locally and in the cloud project, every one has row-level security with tested policies, and `npm run db:reset` rebuilds a local database with fake data.

**Architecture:** Schema lives only in `supabase/migrations/*.sql`. The local stack (Docker, Supabase CLI) applies them with `db reset`; the cloud project gets the identical SQL through the Supabase connector's `apply_migration`, which records it in the same migrations table. RLS is proven by tests that talk to the local REST API as three different callers: the secret key, a staff user, and a client session.

**Tech Stack:** Supabase CLI 2.121 (dev dependency, run via `npx`), Postgres 17, `@supabase/supabase-js`, Vitest.

**Status:** Done 2026-10-22 (branch `feat/app-scaffold`). Cloud project: "Command Center", ref `hblynaefpbskueyfghqj`, us-east-1, created by Tom.

---

## Decisions locked in here

- **Who the database trusts.** Three callers:
  1. The server with the secret key. Bypasses RLS. Used by the SSO route, the OAuth callback, Inngest jobs and metering.
  2. A staff member signed in with Supabase Auth (email OTP, Part C). `auth.uid()` maps to `staff.auth_user_id`.
  3. A client session. Part E will mint a short-lived JWT with a `client_id` claim after SSO succeeds. Policies read it through `current_client_id()`. Until Part E exists, client reads go through the server with the secret key, scoped in code. The policies are written and tested now so Part E has nothing to invent.
- **Tokens are never readable through RLS.** `ghl_installations` has no policies for `authenticated`. Only the secret key touches it. The admin "expiring tokens" alert will read a view that omits the token columns (Part D).
- **Permissions are a JSON checklist** on `staff.permissions`. Owners have everything. Team defaults match PRD section 3. The database enforces staff versus owner. Finer checks (can this team member change a budget) happen in server code against the checklist, so adding a permission is a config change.
- **New Supabase key format.** `sb_publishable_...` in the browser, `sb_secret_...` on the server. Legacy anon and service_role JWTs are not used.
- **`updated_at`** is set by one trigger function on every table that has the column.
- **Money columns** are `numeric`, never float.
- **Staff rows are allowlist entries.** `auth_user_id` is null until the person's first OTP login links it (Part C). So seeding staff needs no auth user.

## Tables

| Table | Key columns | RLS summary |
|---|---|---|
| `staff` | `email` unique, `role` owner or team, `permissions` jsonb, `auth_user_id` nullable unique, `active` | staff read all; owner writes |
| `clients` | `ghl_location_id` unique, `name`, `niche`, `practice_model`, `status`, `saas_status`, `monthly_budget_usd`, `alert_threshold`, `hard_stop_threshold`, `write_back_enabled`, `settings` jsonb | staff read and update; owner insert and delete; client reads own row |
| `ghl_installations` | `client_id`, `ghl_location_id` unique, encrypted token columns, `token_expires_at`, `scopes`, `installed_at`, `uninstalled_at` | secret key only |
| `client_users` | `client_id`, `ghl_user_id`, unique together, `email`, `role`, `last_seen_at` | staff read; client reads own |
| `usage_events` | `client_id` nullable, `run_id`, `step_key`, `model`, token counts, `cost_usd`, `purpose` | staff read; nobody else. Server inserts |
| `audit_log` | `actor_type`, `actor_id`, `client_id`, `action`, `target_table`, `target_id`, `before`, `after` | staff read; server inserts |

Helper functions, all `security definer`, `stable`, search_path pinned: `is_staff()`, `is_owner()`, `current_client_id()`, `set_updated_at()`.

## File structure

```
supabase/config.toml                              from supabase init (done)
supabase/migrations/20261023020000_foundation.sql  the six tables, helpers, RLS
supabase/seed.sql                                 Tom as owner, a fake team member, two fake clients
src/lib/supabase/                                 deferred to Part C, the first code that needs a server client
tests/rls/helpers.ts                              local URL and keys from `supabase status`, JWT minting, callers
tests/rls/clients.test.ts                         staff, owner, client and anonymous access to clients
tests/rls/tokens.test.ts                          nobody but the secret key reads ghl_installations
tests/rls/staff-usage-audit.test.ts               staff and usage_events and audit_log visibility
scripts/run-rls-tests.mjs                         runs the RLS tests if the local stack is up, else prints "skipped"
vitest.rls.config.ts                              separate config so unit tests stay fast
package.json                                      db:start, db:stop, db:reset, db:migrate, db:status, test:rls; check includes test:rls
```

---

### Task B1: Local stack

- [x] **Step 1:** `npx supabase init` (done, `supabase/config.toml` committed).
- [x] **Step 2:** `npx supabase start`. First run downloads about 2 GB of images. Expected tail: a table of URLs and keys, including `API URL: http://127.0.0.1:54321`, `Studio URL: http://127.0.0.1:54323`.
- [x] **Step 3:** Add scripts to `package.json`:

```json
"db:start": "supabase start",
"db:stop": "supabase stop",
"db:status": "supabase status",
"db:reset": "supabase db reset",
"db:migrate": "supabase migration up",
"test:rls": "node scripts/run-rls-tests.mjs",
"check": "npm run typecheck && npm run lint && npm run test && npm run test:rls"
```

### Task B2: Foundation migration

**Files:** Create `supabase/migrations/20261023020000_foundation.sql`

- [x] **Step 1:** Write the migration (full SQL is the file itself; it is the source of truth, not this plan). Order inside the file: extensions, helper functions, tables, indexes, triggers, `enable row level security` on every table, policies, comments.
- [x] **Step 2:** `npx supabase db reset`. Expected: `Applying migration 20261023020000_foundation.sql...`, `Seeding data from supabase/seed.sql...`, `Finished supabase db reset`.
- [x] **Step 3:** Confirm RLS is on everywhere:

```bash
npx supabase db query "select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and relkind = 'r' order by 1"
```

Expected: six rows, all `t`.

### Task B3: Seed

**Files:** Create `supabase/seed.sql`

- [x] **Step 1:** Insert `tom@clickstocloses.com` as owner, `team@example.com` as team with default permissions, and two fake clients: "Northside Physio" (health, hybrid, onboarding not started, location `loc_fake_northside`) and "Brightline Painting" (service, onboarding in progress, location `loc_fake_brightline`). No real client names anywhere.
- [x] **Step 2:** `npx supabase db reset` then `npx supabase db query "select name, status from clients order by 1"`. Expected: two rows.

### Task B4: RLS tests

**Files:** Create `tests/rls/helpers.ts`, the three test files, `vitest.rls.config.ts`, `scripts/run-rls-tests.mjs`. Add `@supabase/supabase-js`.

- [x] **Step 1:** `npm install @supabase/supabase-js`
- [x] **Step 2: helpers.** Read `npx supabase status -o env` once (API URL, publishable key, secret key, JWT secret). `mintJwt(claims)` signs HS256 with Node `crypto`. `asSecret()`, `asStaff(authUserId)`, `asClient(clientId)`, `asAnonymous()` return supabase-js clients. `asStaff` creates the auth user through the admin API if it doesn't exist and links it to the seeded staff row by email.
- [x] **Step 3: write failing tests** (one `it` per rule in the RLS summary table above, including the negative cases: team member can't insert a client, client A can't read client B, anonymous reads nothing, nobody but secret reads `ghl_installations`).
- [x] **Step 4:** `npm run test:rls`. Expected: fails on the rules not yet in the migration, passes on the rest. Fix the migration (never a committed one that already ran in the cloud; before the cloud push, editing the local file and `db reset` is fine).
- [x] **Step 5:** All green. `npm run check` green.
- [x] **Step 6: Commit.**

### Task B5: Push the schema to the cloud project

- [x] **Step 1:** Apply the exact file contents through the Supabase connector's `apply_migration` with name `foundation` on project `hblynaefpbskueyfghqj`.
- [x] **Step 2:** `list_tables` on the cloud project. Expected: six tables, `rls_enabled: true` on each.
- [x] **Step 3:** Do not seed the cloud. Insert only the real owner row: `tom@clickstocloses.com`, role owner.
- [x] **Step 4:** Update `CLAUDE.md` status, this plan's status, and add a dated decision note `docs/decisions/2026-10-22-database-trust-model.md` summarizing "Decisions locked in here".

### Part B done when

`npm run db:reset` works, `npm run check` is green including RLS tests, and the cloud project shows the same six tables with RLS on. Tom can open http://127.0.0.1:54323 (local Studio) and see the two fake clients.

**Result 2026-10-22:** done. 27 RLS tests pass against the local stack. Notes: SQL-language functions that reference a table must be created after that table (Postgres validates the body on create). The connector's `apply_migration` records its own version timestamp, so the cloud row was renamed to match the local file name `20261023020000` to keep `supabase db push` consistent later. Cloud has only the owner staff row, no seed.
