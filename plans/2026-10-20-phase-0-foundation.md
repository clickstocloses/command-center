# Phase 0: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Get from an empty repo to the Phase 0 "done when" in `docs/PRD.md` section 12: Tom installs the Marketplace app on a test sub-account, opens Command Center inside HighLevel and sees "onboarding not started", then logs in as admin and sees that client.

**Architecture:** Next.js App Router with two route groups, `(admin)` for the standalone staff app and `(embed)` for the HighLevel Custom Page. Supabase holds all data behind row-level security. Inngest runs background jobs. Every outside service sits behind one module in `src/lib/`.

**Tech Stack:** Next.js 16 (TypeScript, App Router, Turbopack), React 19, Vitest, ESLint, Supabase (Postgres, Auth, Storage), Inngest, Anthropic SDK. Plain CSS with custom properties for the brand (no CSS framework).

**Status:** Part A done 2026-10-20 (branch `feat/app-scaffold`). Parts B to F get their own dated plan file when they start.

---

## How this plan is split

Phase 0 is six subsystems. Each ends in something Tom can click.

| Part | Subsystem | Tom can test by | Needs from Tom first |
|---|---|---|---|
| A | App scaffold, brand theme, `npm run check`, slash commands | `npm run dev`, open http://localhost:3000 and see the branded landing page | Nothing |
| B | Supabase project, first migrations (`clients`, `ghl_installations`, `staff`, `client_users`, `usage_events`, `audit_log`), RLS tests | `npm run db:reset` builds a local database; RLS tests pass | Create the Supabase project (or approve Claude creating it), install Docker and the Supabase CLI |
| C | Admin OTP login, staff table gate, permissions checklist, audit log writes | Open `/admin`, get a code by email, land on an empty dashboard | Add his and Mark's emails to `staff` via seed |
| D | HighLevel Marketplace app: OAuth install callback, token storage and refresh in `src/lib/ghl/` | Install the app on a test sub-account; a `ghl_installations` row appears | Register the Marketplace app in HighLevel, give Claude the client ID, secret and Shared Secret via `.env.local` |
| E | Custom Page SSO: `postMessage` handshake, `/api/sso` decrypt, active-client check, in-memory session token, "onboarding not started" screen | Open Command Center inside the test sub-account | Approve the Custom Page URL |
| F | Inngest app, usage metering (`usage_events`, 80% alert, 100% stop), Vercel project, preview deploys | A test job runs in the Inngest dev UI; a preview URL loads | Create the Vercel and Inngest projects (or approve Claude doing it) |

Order: A, B, C, D, E, F. D and E can't be tested without B and C.

---

## Part A: App scaffold (detailed)

### File structure

```
package.json                 scripts: dev, build, start, lint, typecheck, test, check
tsconfig.json                from create-next-app, strict
next.config.ts               from create-next-app
eslint.config.mjs            from create-next-app
vitest.config.ts             node environment, tests in src/**/*.test.ts and tests/**
.env.example                 names only
src/app/layout.tsx           root layout: fonts (Montserrat, Space Mono), tokens.css
src/app/page.tsx             landing page in brand
src/app/(admin)/admin/page.tsx     placeholder until Part C
src/app/(embed)/embed/page.tsx     placeholder until Part E
src/styles/tokens.css        the only place hex values live
src/styles/globals.css       reset and base type
src/lib/text/dashes.ts       findDashes(): deterministic no-dash check used by every validator later
src/lib/text/dashes.test.ts
.claude/commands/*.md        prime, check, ship, create-plan, implement, port-skill, new-generator
```

### Task A1: Scaffold Next.js on a feature branch

**Files:** everything create-next-app produces, copied into the repo root.

- [x] **Step 1: Branch**

```bash
git checkout -b feat/app-scaffold
```

- [x] **Step 2: Generate in a scratch folder, then copy in**

create-next-app refuses a non-empty folder, so generate elsewhere and copy. No Tailwind: the brand uses plain CSS tokens.

```bash
npx --yes create-next-app@latest ctc-scaffold --ts --app --src-dir --eslint --no-tailwind --import-alias "@/*" --use-npm --skip-install --yes
```

Copy `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `next-env.d.ts`, `src/app/` into the repo. Keep the repo's own `README.md` and `.gitignore`.

- [x] **Step 3: Install**

```bash
npm install
```

Expected: `node_modules/` appears, no vulnerabilities reported at high.

- [x] **Step 4: Confirm it runs**

```bash
npm run build
```

Expected: `✓ Compiled successfully`, routes `/` listed.

### Task A2: Brand tokens and fonts

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/globals.css`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`
- Delete: `src/app/page.module.css`, `src/app/globals.css` (create-next-app defaults)

- [x] **Step 1: tokens.css** holds every hex from the Brand Board as a custom property (`--color-spark`, `--color-deep`, `--color-ink`, `--color-surface`, `--color-slate`, `--color-paper`) plus font variables and spacing.
- [x] **Step 2: layout.tsx** loads Montserrat (weights 400, 500, 600, 800) and Space Mono (400, 700) with `next/font/google`, exposes them as `--font-display` and `--font-mono`, imports both stylesheets, sets `lang="en"` and metadata title "Command Center".
- [x] **Step 3: page.tsx** shows the wordmark (CLICKS TO **CLOSES**), a "SYSTEM OPERATIONAL" chip in Space Mono, one line about Phase 0, and links to `/admin` and `/embed`.
- [x] **Step 4:** `npm run dev`, open http://localhost:3000, check contrast and that no hex appears outside `tokens.css` (`grep -rn "#[0-9A-Fa-f]\{6\}" src --include=*.tsx --include=*.css | grep -v tokens.css` returns nothing).

### Task A3: Test runner and `npm run check`

**Files:**
- Create: `vitest.config.ts`, `src/lib/text/dashes.ts`, `src/lib/text/dashes.test.ts`
- Modify: `package.json` scripts

- [x] **Step 1: Failing test** for `findDashes(text)` which returns each em dash or en dash with its line number. Cases: clean text returns `[]`, an em dash is found, an en dash is found, a plain hyphen is not reported, line numbers are correct across multiple lines.
- [x] **Step 2:** `npx vitest run` fails with "Cannot find module".
- [x] **Step 3: Implement** `findDashes` with a single regex over `[–—]`, tracking line numbers.
- [x] **Step 4:** `npx vitest run` passes.
- [x] **Step 5: Scripts**

```json
"typecheck": "tsc --noEmit",
"test": "vitest run",
"check": "npm run typecheck && npm run lint && npm run test"
```

- [x] **Step 6:** `npm run check` passes.

### Task A4: Slash commands, env example, docs

**Files:**
- Create: `.claude/commands/{prime,check,ship,create-plan,implement,port-skill,new-generator}.md`, `.env.example`
- Modify: `CLAUDE.md` (status, scripts note), `README.md` (how to run)

- [x] **Step 1:** Each command file is the SOP for that command as described in the `CLAUDE.md` Commands table.
- [x] **Step 2:** `.env.example` lists the variable names Phase 0 will need, grouped by part, each with one comment on where the value comes from. No values.
- [x] **Step 3:** Update `CLAUDE.md` "Current status" and remove the "package.json doesn't exist yet" note. Record Vitest as the test runner and the single-test command: `npx vitest run src/lib/text/dashes.test.ts`.
- [x] **Step 4:** `npm run check`, then commit:

```bash
git add -A
git commit -m "Scaffold Next.js app with brand theme, Vitest and npm run check"
```

### Part A done when

Tom runs `npm run dev`, opens http://localhost:3000 and sees the branded landing page. `npm run check` passes.

**Result 2026-10-20:** done. Notes: `tsconfig.json` and `eslint.config.mjs` must exclude `_import/` or the type check reads the old projects. `npm audit` reports a dev-only `braces` advisory via `eslint-config-next`; the suggested fix downgrades Next to 14, so it's left alone. `cacheComponents` is on (the Next 16 default), so pages that read cookies or headers must wrap that part in Suspense.

---

## Parts B to F: notes for their plans

These are the decisions already made, so the later plans don't re-open them.

- **B:** Supabase CLI local stack needs Docker Desktop. Migrations are plain SQL in `supabase/migrations/`, named `YYYYMMDDHHMMSS_<what>.sql`. RLS tests run SQL against the local database with the anon key and a signed JWT per role; they live in `tests/rls/` and are part of `npm run check` only when the local stack is up (skip with a clear message otherwise).
- **C:** Supabase Auth email OTP. The `staff` table is the allowlist; a trigger or server check refuses OTP for emails not in it. Permissions are a JSON checklist column. Every staff write goes through `src/lib/audit/`.
- **D:** HighLevel OAuth: authorize URL, callback at `/api/ghl/oauth/callback`, tokens encrypted at rest with a server-only key. Refresh via an Inngest cron (Part F) and on 401. Location-scoped endpoints only. Facts go in `knowledge/ghl-facts.md`.
- **E:** Embed page sends `REQUEST_USER_DATA` via `postMessage`, posts the encrypted payload to `/api/sso`, server decrypts with the Shared Secret (AES, confirm the exact scheme against HighLevel's marketplace template), checks `ghl_installations` and the active-client field (PRD open question 2), returns a short-lived JWT held in memory. No cookies.
- **F:** Inngest serve route at `/api/inngest`. `src/lib/anthropic/` wraps every call, writes `usage_events`, and reads the client's budget before each call. Vercel project linked to the GitHub repo, `main` protected, preview per branch.
