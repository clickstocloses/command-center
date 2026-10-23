# Phase 0 Part C: Admin Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** A staff member opens `/admin`, enters their email, gets a 6-digit code by email, enters it, and lands on a dashboard that lists the clients. Anyone not on the `staff` table can't get a code.

**Architecture:** Supabase Auth email OTP with cookie sessions through `@supabase/ssr`. All auth runs on the server: server actions request and verify codes, `src/proxy.ts` refreshes the session and bounces anonymous visitors, and the protected admin layout loads the staff row through RLS. The staff table is the allowlist: the server creates the Supabase Auth user for a staff row with the secret key, so email signups stay disabled.

**Tech Stack:** Next.js 16 (server actions, `proxy.ts`, cache components), `@supabase/ssr`, `@supabase/supabase-js`, local Mailpit for reading codes in development.

**Status:** Done 2026-10-22 (branch `feat/app-scaffold`). Verified end to end in a browser against the local stack: code requested, read from Mailpit, entered, dashboard shows the two fake clients, audit row written.

---

## Decisions

- **Local first.** `.env.local` points at the local stack. Codes arrive in Mailpit at http://127.0.0.1:54324. Cloud values move to Vercel in Part F. Reason: Supabase's built-in email sender only delivers to organization members and is rate limited, so cloud login needs custom SMTP later anyway.
- **Signups off, server creates users.** The global `[auth] enable_signup = false` locally ("Allow new users to sign up" off in the cloud dashboard). Not the `[auth.email]` flag: that one disables email login entirely, which cost a failed first attempt. `requestLoginCode` looks the email up in `staff` with the secret key, creates the auth user if needed, links `staff.auth_user_id`, then sends the OTP with `shouldCreateUser: false`.
- **Same answer either way.** Whether or not the email is on the staff list, the login page says "If that email is on the team list, a code is on its way." No leaking who's staff.
- **Code and link both work.** The email template includes `{{ .Token }}` and `{{ .ConfirmationURL }}`. The code goes through `verifyOtp` with `type: "email"`. The link goes to `/admin/auth/confirm` with a `token_hash`.
- **Proxy stays thin.** It refreshes tokens and redirects anonymous visitors away from `/admin/*` (except `/admin/login` and `/admin/auth/*`). Who is staff is decided in `requireStaff()`, which reads the `staff` row through RLS as the signed-in user. A signed-in non-staff user sees "not on the team list" with a sign-out button.
- **Permissions in code, roles in the database.** `hasPermission(staff, key)` returns true for owners and reads the JSON checklist for team members with the PRD defaults as fallback.
- **Every login writes an audit row** (`staff.login`) with the secret key.

## File structure

```
src/proxy.ts                                     session refresh and redirect for /admin/*
src/lib/supabase/env.ts                          validated env names
src/lib/supabase/server.ts                       createUserSupabase() (cookies, RLS) and createSecretSupabase()
src/lib/auth/permissions.ts  (+ .test.ts)        permission keys, team defaults, hasPermission()
src/lib/auth/staff.ts                            getCurrentStaff(), requireStaff()
src/lib/auth/login.ts  (+ .test.ts)              normalizeEmail(), requestLoginCode(), verifyLoginCode()
src/lib/audit/log.ts                             writeAuditLog()
src/app/(admin)/admin/login/page.tsx             login page (shows the form, or "not on the team list")
src/app/(admin)/admin/login/LoginForm.tsx        client form, two steps, useActionState
src/app/(admin)/admin/login/actions.ts           requestCodeAction, verifyCodeAction, signOutAction
src/app/(admin)/admin/auth/confirm/route.ts      token_hash link handler
src/app/(admin)/admin/(protected)/layout.tsx     requireStaff, admin shell with nav and sign out
src/app/(admin)/admin/(protected)/page.tsx       dashboard: status counts and client table
supabase/templates/magic_link.html               code plus link email
supabase/config.toml                             signups off, template wired, localhost URLs
```

The placeholder `src/app/(admin)/admin/page.tsx` from Part A moves into `(protected)/`.

## Tasks

### Task C1: Supabase server helpers and env

- [x] `env.ts` throws a clear error naming the missing variable and `.env.example`.
- [x] `server.ts` exports `createUserSupabase()` (cookie-based, ignores cookie writes from Server Components since the proxy handles refresh) and `createSecretSupabase()` (no session persistence).
- [x] Guard: both throw if imported in the browser (`typeof window !== "undefined"`).

### Task C2: Permissions (TDD)

- [x] Failing tests: owner has every permission; team member gets PRD defaults when the checklist is empty; an explicit `false` overrides a default `true`; an explicit `true` overrides a default `false`; a non-boolean value falls back to the default.
- [x] Implement. `npx vitest run src/lib/auth/permissions.test.ts` passes.

### Task C3: Login logic (TDD for the pure part)

- [x] Failing tests for `normalizeEmail`: trims and lowercases; rejects empty, missing `@`, spaces inside.
- [x] Implement `normalizeEmail`, `requestLoginCode`, `verifyLoginCode` as described in Decisions.
- [x] `writeAuditLog` in `src/lib/audit/log.ts`, never throws.

### Task C4: Proxy

- [x] `src/proxy.ts` with matcher `/admin/:path*`. Calls `getClaims()` first so refreshes land in cookies, sets `Cache-Control: private, no-store` on responses that touch auth.

### Task C5: Pages and actions

- [x] Login page, form, actions, confirm route, protected layout, dashboard page. Dynamic parts wrapped in `Suspense` because cache components is on.
- [x] Dashboard reads `clients` with `createUserSupabase()` so RLS is what filters, not the server.

### Task C6: Prove it

- [x] `npm run check` green. `npm run build` green.
- [x] Manual, with `npm run db:start` and `npm run dev` running: open http://localhost:3000/admin, get redirected to login, enter `tom@clickstocloses.com`, read the code at http://127.0.0.1:54324, enter it, see two fake clients. Try `nobody@example.com`: same message, no email in Mailpit. Sign out returns to login.
- [x] Commit. Update CLAUDE.md status.

### Part C done when

Tom logs in locally with his email and a code from Mailpit and sees the two fake clients on the dashboard. Signing out works. A non-staff email gets no code.

## For the cloud project (Tom, before Part F goes live)

1. Authentication, Providers, Email: turn off "Allow new users to sign up".
2. Authentication, Email Templates, Magic Link: replace the body with the contents of `supabase/templates/magic_link.html` so the 6-digit code appears.
3. Authentication, URL Configuration: site URL and redirect URLs for the Vercel domain (Part F).
4. Custom SMTP (Resend or similar) before anyone besides Tom logs in. Needs a decision and a new outside service.

**Notes 2026-10-22:** In dev, Next logs `Route "/admin": Next.js encountered the unstable value Date.now() while prerendering` once, on the first compile of the route, and not on later loads. `npm run build` passes with `/admin` as partial prerender. Origin is somewhere in the Supabase auth client; revisit if it shows in a build. Hydration warnings mentioning `clickup-chrome-ext_installed` come from a browser extension, not the app.
