# CLAUDE.md

This file is loaded at the start of every Claude Code session. Keep it current. It is the single source of truth for how Claude works in this project.

---

## What this project is

**Clicks to Closes Command Center** is a web app that runs inside HighLevel. Clients open it from a menu item in their sub-account to do onboarding, FAQs, and voice and avatar interviews. Tom and his team log in as admins, see every client, and run AI **generators** that turn client data into finished assets (AI chat prompts first, then VSL scripts, email copy, ads, dashboards).

The full spec is in `docs/PRD.md`. Read it before starting any feature.

**Stack:** Next.js (App Router, TypeScript) on Vercel · Supabase (Postgres, Auth, Storage, row-level security) · Inngest (background jobs) · Anthropic API · HighLevel API v2 via a Marketplace app (OAuth) · Fathom API · Firecrawl API.

**Where the repo actually is (as of 2026-10-22):** the Next.js app shell, admin login (`/admin`) and the database foundation exist, and `npm run check` passes. `.env.local` points at the LOCAL Supabase stack for development; cloud keys sit in it commented with a `CLOUD_` prefix until Vercel is set up. `supabase/` holds the first migration and seed, with RLS tests in `tests/rls/` that run against the local Docker stack. The cloud project is "Command Center" (ref `hblynaefpbskueyfghqj`). `generators/`, `knowledge/`, `context/` and `workflows/` don't exist yet. Plans live in `plans/`. Check that something exists before telling Tom to run it.

---

## Who you're working with

Tom has no coding experience. Claude writes the code, and Tom directs, tests and approves. That changes how Claude works:

1. **Explain in plain language.** Before a change, say in one or two sentences what you're about to do and why. After it, say what changed and how Tom can see it working (a URL, a button to click).
2. **Small steps.** One feature or fix at a time. Each step ends in something Tom can click and test.
3. **Never leave it broken.** Before saying a step is done, run `npm run check` (type check, lint, tests). If it fails, fix it before reporting.
4. **Ask before:**
   - adding a new npm package or outside service
   - any write to a live HighLevel account, Meta ad account or other client system
   - running anything that spends money (AI calls in bulk, Firecrawl crawls, Higgsfield generations)
   - deleting data or changing the database in a way that loses data
5. **Give Tom the exact command** when he has to run something himself, and say where to run it.
6. **When something fails**, read the full error, fix the cause, rerun the check, and add a dated line to the relevant `generators/<key>/README.md` or `knowledge/ghl-facts.md` so it doesn't happen again (the self-improvement loop below).

---

## The WAT framework, adapted for an app

Probabilistic AI handles reasoning, and deterministic code handles execution. Here it maps onto the app like this:

| WAT | In this project |
|---|---|
| **Workflows** (plain-language SOPs) | `generators/<key>/README.md`: what the generator does, its inputs, steps, outputs and edge cases. Also `workflows/` for dev and ops SOPs (deploying, installing the app on a sub-account, adding a niche) |
| **Agents** (Claude orchestrating) | At build time: Claude Code reading the SOP and writing code. At runtime: the generator's AI steps (Anthropic API calls) |
| **Tools** (deterministic code) | TypeScript in `src/lib/` and `generators/<key>/validate.ts`: API clients, anonymizer, corpus builder, renderers, validators. Testable, no AI inside |

**Rule:** if a step can be done with plain code (counting words, stripping dashes, checking merge fields, anonymizing names), it is code, not an AI call. AI is only for reading and writing language.

---

## Project structure

This is the target layout. Create folders as the work calls for them, not as empty folders up front.

```
.
├── CLAUDE.md                  # This file
├── docs/
│   ├── PRD.md                 # Product requirements (the spec)
│   ├── skill-inventory.md     # Every imported skill/project → which generator it feeds
│   └── decisions/             # Short dated notes on big choices (one file each)
├── context/                   # Tom, the business, current priorities. Read by /prime
├── plans/                     # Dated implementation plans from /create-plan
├── workflows/                 # Dev and ops SOPs
├── _import/                   # READ-ONLY source material copied from Tom's old projects and ~/.claude
│   └── user-level/            # skills, commands, agents from ~/.claude
├── knowledge/                 # Runtime reference the app's AI uses: prompt templates,
│                              #   frameworks, checklists, ghl-facts.md. Versioned in git
├── generators/
│   └── <key>/                 # One folder per generator
│       ├── README.md          #   the SOP (workflow)
│       ├── recipe.ts          #   steps, prerequisites, sources, outputs
│       ├── prompts/           #   prompt templates (Markdown)
│       ├── validate.ts        #   deterministic checks before saving
│       └── tests/             #   fixtures and expected results
├── src/
│   ├── app/
│   │   ├── (admin)/           # Standalone admin app (OTP login)
│   │   ├── (embed)/           # Pages shown inside the HighLevel Custom Page
│   │   └── api/               # Route handlers (SSO, OAuth callback, webhooks, Inngest)
│   ├── components/
│   ├── config/                # onboarding question sets, ghl-field-map, model prices, generator registry
│   ├── inngest/               # Background job functions
│   └── lib/
│       ├── ghl/               # HighLevel API client (token refresh, rate limits, logging)
│       ├── anthropic/         # AI client wrapper. Every call logs usage
│       ├── fathom/  firecrawl/
│       ├── auth/              # SSO decrypt, session tokens, staff permissions
│       ├── usage/             # Metering, 80% alert, 100% hard stop
│       └── supabase/
├── supabase/
│   ├── migrations/            # The ONLY way the database schema changes
│   └── seed.sql               # Test data (fake clients only)
├── tests/
├── .env.example               # Names of every env variable, no values
└── .env.local                 # Real secrets, local only, NEVER committed
```

### What goes where

- **`_import/` is read-only and gitignored.** It's the raw material from Tom's old Claude Code projects and it contains real `.env` files, so it never goes to GitHub. Don't edit it, and don't import code from it at runtime. To use something from it, port it into `knowledge/` or `generators/` and record that in `docs/skill-inventory.md`.
- **`knowledge/` vs `.claude/skills/`:** `knowledge/` is what the *app* feeds to the AI when it generates for a client. `.claude/skills/` is what helps *Claude Code* build the app. A copywriting framework goes in `knowledge/`. A "how we write migrations here" guide goes in `.claude/skills/`.
- **Client data never goes in git.** No real client names, transcripts, or exports in fixtures. Use made-up clients in tests and `seed.sql`.

---

## Brand (Clicks to Closes Brand Board v1.0)

| Token | Hex | Use |
|---|---|---|
| Spark Green | `#00FFA3` | The signal: the logo mark, primary actions, single-word emphasis, live status. Never fills large areas |
| Deep Green | `#00C77E` | Hover and pressed states. On light backgrounds use it for large text only |
| Ink Black | `#0A0C0B` | Default canvas, and text on Spark Green buttons |
| Surface | `#16211C` | Cards and panels on Ink |
| Slate | `#8A928E` | Secondary text and metadata |
| Paper | `#F4F6F5` | Main text on dark, and long-form reading backgrounds |

- **Type:** Montserrat 800 (display, headlines, wordmark), 600 (subheads, UI), 500 and 400 (body, 1.6 line height). Space Mono for labels, metadata, code and system status.
- **Logo:** the cursor mark plus "CLICKS TO **CLOSES**" with CLOSES in Spark Green (Deep Green on light). Don't recolor the mark outside the palette, stretch it, or set the wordmark in another typeface.
- **Motif:** the cursor is the brand signature. Use it as a bullet, a leading glyph or the favicon, always Spark Green or Ink Black and never outlined. The "SYSTEM OPERATIONAL" status chip in Space Mono is on brand.
- **Voice:** direct, confident, no fluff, results-first, a little bold. Write like a closer, not a marketer. Short sentences, verbs over adjectives.
- Put all of these in one theme file (`src/styles/tokens.css`) and never hard-code hex values in components. Text contrast must be at least 4.5:1.

## Coding style (from Tom's global settings)

- ES modules (`import`/`export`), never CommonJS
- `async`/`await`, not `.then()` chains
- 2-space indentation
- Descriptive names, with no single letters except loop counters
- Comment *why*, not *what*
- Read existing code before changing it. Small, focused changes, not big rewrites.
- If a request seems wrong, say so and ask before proceeding.
- If you ever see an exposed secret, stop and warn Tom immediately.

---

## Non-negotiables

### Security
- Secrets live only in `.env.local`, Vercel and Supabase settings. Never in code, never in git, never in `_import/` copies. `.gitignore` must cover `.env*`, `*.pem`, `id_*` and SSH keys.
- The HighLevel Shared Secret, OAuth client secret, Supabase service key and Anthropic key are **server-only**. Never import them into a client component.
- **Never trust a location ID from the URL or the browser.** Client identity comes only from the decrypted HighLevel SSO payload, checked against `ghl_installations` and the active-client check. See PRD section 4.
- Every table with client data has row-level security on, with policies tested in `tests/rls/`. A new table without RLS is a failed check.
- The embed app must not rely on cookies (Safari blocks them in iframes). Keep the session token in memory and re-run SSO on load.

### HighLevel
- Nothing is published, sent or changed in a live HighLevel account without Tom's explicit go-ahead for that client. Write-backs are behind a per-client switch that is off by default.
- All HighLevel calls go through `src/lib/ghl/`. Use location-scoped endpoints. Known API quirks are in `knowledge/ghl-facts.md`. Read it before touching HighLevel code, and add to it when you learn something.

### Generated content
- Paste-ready text is always rendered from the editable version and then validated. It is never hand-edited.
- **No dashes** (em or en) in anything a client or lead will read: prompts, emails, SMS, ad copy, scripts, page copy. Validators enforce it.
- AI chat prompts: conversational booking only (no booking links), never convert time zones (read the calendar tool's "Timezone" line), under 2,000 words (warn at 1,950), and follow the structure in `knowledge/prompts/example-shoulder-program-ig-dm.md`.
- Tone comes from the client (voice profile, staff messages, practitioner videos). Never from customers or an old bot.
- No customer personal details in any output. Anonymize before analysis, and delete raw exports when the run ends.
- Email and SMS copy passes the `knowledge/human_voice.md` anti-AI checklist before it's saved.

### Money
- Every Anthropic call goes through `src/lib/anthropic/`, which records tokens and cost to `usage_events` and enforces the client's budget (80% alert, 100% hard stop).
- In development, use the cheapest model that works and small fixtures. Ask Tom before running a full generator against a real client.

### Database
- Schema changes only through new files in `supabase/migrations/`. Never edit the production database by hand, and never edit a migration that has already run.
- Don't run destructive migrations (dropping columns or tables with data) without Tom saying yes.

---

## Commands

Each one is a file in `.claude/commands/`.

| Command | What it does |
|---|---|
| `/prime` | Read this file, `docs/PRD.md`, `context/` and open plans. Summarize where the project is and what's next |
| `/create-plan [request]` | Write a dated plan in `plans/` before any significant change: context, steps, how Tom will test it |
| `/implement [plan-path]` | Execute a plan step by step, run `npm run check` after each step, update the plan's status |
| `/port-skill [path in _import]` | Read an imported skill or project, then propose which generator it feeds and what goes into `knowledge/` vs code. Update `docs/skill-inventory.md`. Ask before porting |
| `/new-generator [key]` | Scaffold `generators/<key>/` from the template and register it in `src/config/generators.ts` |
| `/check` | Run `npm run check` and explain any failure in plain language |
| `/ship` | Commit with a clear message on the current branch, push, and give Tom the Vercel preview link. Never pushes to `main` directly |

## Everyday scripts

| Script | Use |
|---|---|
| `npm run up` | After a restart: starts Docker Desktop if needed, the local Supabase stack, then the dev server. Use this one |
| `npm run dev` | Start only the app at http://localhost:3000 (Docker and `db:start` must already be running) |
| `npm run check` | Type check, lint, unit tests, RLS tests. Must pass before any step is called done |
| `npm run typecheck` / `npm run lint` / `npm run test` | The three parts of `check`, runnable alone |
| `npx vitest run src/lib/text/dashes.test.ts` | Run a single test file (Vitest). Add `-t "name"` for one test |
| `npm run build` | Production build. Run it before shipping anything that touches config or routing |
| `npm run db:start` / `db:stop` / `db:status` | The local Supabase stack in Docker. Studio is at http://127.0.0.1:54323 |
| `npm run db:reset` | Rebuild the local database from migrations and seed, local only |
| `npm run db:migrate` | Apply new migrations to the local database without wiping it |
| `npm run test:rls` | RLS tests against the local stack. `check` runs them too, and skips with a message if the stack is down |
| `npm run inngest` | Start the Inngest dev server to watch background jobs (Part F, not yet) |

Cloud schema changes: write the migration file, prove it locally, then apply the identical SQL to the cloud project through the Supabase connector's `apply_migration`, and rename its version row to match the file name. Never edit the cloud database by hand.

---

## Git and deploys

- `main` is production and protected. All work happens on a branch named for the feature (`feat/onboarding-form`, `fix/sso-safari`).
- Every push gets a Vercel preview URL. Tom tests there, then merges.
- Commit after each working step, with a message that says what changed in plain words.

---

## The self-improvement loop

1. Identify what broke
2. Fix the code or the prompt
3. Prove the fix (a test or a rerun)
4. Write down what you learned (the generator's README, `knowledge/ghl-facts.md`, or `docs/decisions/`)
5. Move on with a stronger system

Don't rewrite a generator's README or a knowledge file wholesale without asking. Refine it.

---

## Current status

**Phase:** 0, Foundation (see the PRD roadmap).

**Done:** PRD, this file, skill inventory (`docs/skill-inventory.md`), `.gitignore`, GitHub repo `clickstocloses/command-center`, Phase 0 plan, Part A of it (app shell: Next.js 16 with cache components on, brand tokens and fonts, Vitest, `npm run check`, slash commands, first validator `findDashes`). A clickable mockup in Clicks to Closes branding exists outside this repo; ask Tom for it before building UI from scratch.

Part B is done too: Supabase project, six foundation tables, RLS tests (see `docs/decisions/2026-10-22-database-trust-model.md`). Part C is done: admin login with email and one-time code, staff allowlist, permissions checklist, audit log, proxy. Locally, codes arrive in Mailpit at http://127.0.0.1:54324.

**Next up** (Phase 0 plan parts, in order):
1. Part D: HighLevel Marketplace app registration (Tom) and the OAuth callback
3. Part E: Custom Page SSO handshake end to end on a test sub-account
4. Part F: Inngest, usage metering, Vercel project and preview deploys
5. In parallel, port the Phase 1 rows in `docs/skill-inventory.md` (`/port-skill` on each)

## Maintain this file

After any change that adds a command, generator, folder, rule or integration, update the matching section here. If `context/current-priorities.md` or the "Current status" section above is out of date, fix it before ending the session.
