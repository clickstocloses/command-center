# Clicks to Closes Command Center: Product Requirements

**Owner:** Tom Pacheco, Clicks to Closes
**Status:** Draft v1, 2026-10-20
**Sources:** Team Standup call 2026-10-07 (Fathom, from 53:00), interview with Tom 2026-10-13 to 2026-10-15, the existing Claude Code projects (AI Assistant Prompt Creator, Snapshot Builder, RF Funnels), and the current onboarding funnel at clickstocloses.com.

---

## 1. Summary

Command Center is a web app that lives inside HighLevel. Every Clicks to Closes client opens it from a menu item in their own HighLevel sub-account. They fill out onboarding, tell the system who they are and how they talk, and see what has been built for them. Tom and his team log in as admins, see every client, and run AI "generators" that turn each client's data into finished assets. The first generator is the AI chat prompt. Later ones cover VSL scripts, email copy, Facebook ads, dashboards and social content.

Today this work lives in separate Claude Code folders on Tom's laptop. Each project re-collects the same client facts and keeps outputs in local files nobody else can see. Command Center puts the client data in one place (Supabase), runs the same proven pipelines as background jobs, and saves every output under the client's profile with version history.

## 2. Goals

1. **One home for client data.** Onboarding answers, FAQs, voice profile, ideal client avatar, Fathom calls, website facts and HighLevel conversation insights are stored once and reused by every generator.
2. **Turn Tom's Claude Code projects into buttons.** A generator runs the same steps Tom runs by hand today and produces the same quality of output.
3. **Every output is versioned.** Tom can say "this prompt does X, fix it" and get a new version, with the old ones kept and restorable.
4. **Runs inside HighLevel.** Clients never get a separate login. The app shows up only in sub-accounts where the Marketplace app is installed.
5. **AI spend is controlled.** Usage is metered per client with an 80% alert and a 100% hard stop.

### Non-goals for v1

- Clients running generators themselves (admins only in v1).
- Writing AI agents directly into HighLevel. v1 produces paste-ready text, Tom pastes.
- Video transcription from social links and the media library (v1.1).
- Voice conversations with an AI interviewer (text interviews in v1).
- Voice AI prompts (v2).

## 3. Users and permissions

| Role | Who | Gets in by | Can |
|---|---|---|---|
| Owner | Tom | Admin web login (email + one-time code), or HighLevel agency view | Everything: all clients, run generators, edit outputs, usage limits, staff, integrations, app settings, delete |
| Team | Mark, future VAs | Same as owner | Permissions set per person by the owner. Defaults: view all clients, run generators, edit outputs, share outputs with clients. Off by default: usage limits, staff management, integration keys, deleting anything |
| Client | Any HighLevel user in the client's sub-account | The Command Center menu item inside their sub-account (single sign-on, no password) | Their own sub-account only. Complete onboarding, edit FAQs, do the voice and avatar interviews, see outputs the team has shared with them |

Permissions are a checklist per team member stored in the database, so new permissions can be added without code changes to the role model. Every write by a team member goes to an audit log.

## 4. How people get in

### 4.1 Clients: inside HighLevel (single sign-on)

1. Tom builds a private **HighLevel Marketplace app** with OAuth. It's installed per sub-account and adds a **Custom Page** menu item called "Command Center".
2. The Custom Page loads the app in an iframe. The app sends `REQUEST_USER_DATA` to the HighLevel parent window with `postMessage`.
3. HighLevel replies with an encrypted payload. The app's server decrypts it with the app's **Shared Secret**. The secret lives only in server environment variables. Expected fields are user ID, company ID, active location ID, role, type (agency or location), user name and email. Confirm the exact shape against the `/decrypt-sso` route in HighLevel's marketplace app template.
4. The server checks three things:
   - The location has the app installed (a row in `ghl_installations`).
   - The client is active. The account runs in **SaaS mode**, so "active" means the location's SaaS subscription is active and the location isn't paused. Confirm which API field exposes this.
   - The user belongs to that location.
5. If all three pass, the server issues a short-lived session token scoped to that one location. If any check fails, the client sees "Your account isn't active. Contact Clicks to Closes."

**Why not read the location ID from the URL:** anyone who guessed or copied another client's ID would see that client's data. The signed payload can't be faked.

**Stripe email mismatch is solved by design:** clients are identified by their HighLevel location, never by email. If Stripe data is ever needed, the Stripe customer ID is linked to the client record once.

**Known risk, third-party cookies:** the app runs in an iframe on a HighLevel domain, so Safari blocks its cookies. The client session must not depend on cookies. Keep the token in memory, send it as an `Authorization` header, and silently repeat the SSO handshake on each page load. Test in Safari, Chrome and the HighLevel mobile app before launch.

### 4.2 Admins: standalone web app

- Login at the app's own address (for example `command.clickstocloses.com`) with email plus a one-time code (Supabase Auth OTP). Only emails in the `staff` table can log in.
- If an agency user opens the Custom Page from HighLevel and their SSO email matches an active staff row, they get their staff role there too.

### 4.3 HighLevel API access

OAuth tokens per installed location are stored encrypted in Supabase and refreshed automatically. All HighLevel calls go through one server module (`src/lib/ghl/`) that handles refresh, rate limits and logging. The existing projects learned that some HighLevel MCP tools fail with agency tokens. The API module must use location-scoped endpoints. The lessons are in `knowledge/ghl-facts.md`.

## 5. Client experience (inside HighLevel)

The client home screen is a checklist that always shows what's next:

1. Onboarding form
2. Account setup steps
3. FAQs
4. Voice profile interview
5. Ideal client avatar interview
6. Book your onboarding call

Then a **"Your assets"** area shows anything the team has shared (for example the AI chat prompt, later the VSL script).

### 5.1 Onboarding form

It replaces the HighLevel onboarding funnel. It saves as the client goes, so they can leave and come back. Fields are prefilled from the HighLevel location where possible (name, address, phone, website, time zone).

**Step 1: Business details** (from today's form)
Full name, email, phone, friendly business name, legal business name, business email, business phone, website, business type, business registration ID type, EIN or registration number, address, city, state, zip, country. These also feed A2P registration.

**Step 2: Niche (branch point)**
"What kind of business are you?"
- Physical therapy, chiropractic or rehab practice → Health branch
- Other service business (real estate, home services, painting, etc.) → Service branch

**Step 3a: Health branch**
- YouTube channel URL, Instagram handle, Facebook business page URL
- Practice model: brick-and-mortar only, hybrid (office plus online), or fully online
- Do you need a new website?
- Do you want AI agents to follow up with your leads? If yes: should they reply only to people who message a keyword (which keyword?), or to all DMs?
- Do you want Voice AI to answer your calls and book appointments?
- Are you using Jane App? If not, do you want to?
- What calendar system do you use to book appointments today?
- What EHR system do you use?
- Practitioners: names and titles (Dr., PT, DC), and who does discovery calls
- Program or offer name, and the main problem it solves (body part or condition)
- What a new lead books: free phone call, free Zoom call, free in-person visit, or paid visit (with price)
- Office hours and time zone
- Pricing stance: what can be shared in chat, what can't
- Insurance stance: cash-based, in-network, or receipts for reimbursement
- Topics the AI must never discuss
- Who gets notified when a lead needs a human, and how (SMS number, email)

**Step 3b: Service branch**
- Industry and services offered, service area
- Social links (Instagram, Facebook, YouTube, TikTok)
- Main offer or lead magnet
- What a new lead books (consultation type, phone, Zoom, on-site estimate)
- AI agent and Voice AI preferences (same questions as the health branch)
- Calendar system in use, previous CRM
- Do you need a new website?
- Hours, time zone, topics to avoid, handoff contact

The question sets for each branch live in config (`src/config/onboarding/*.ts`), not hard-coded in pages. That way Tom can add a question with a small change and a new niche branch later. Answers are saved as JSON against a question-set version, so older submissions stay readable.

**Writing back to HighLevel:** on submit, a fixed list of answers is written to the sub-account's custom values and fields (for example `dr_name`, `program_name`, `assistant_name`, business info for A2P). The mapping table is in `src/config/ghl-field-map.ts` and Tom approves it before it's turned on. This is the only HighLevel write in v1, and it's off until Tom flips it per client. **Open question:** see section 13.

### 5.2 Account setup steps

These replace the funnel pages /phone-number, /myprofile, /integrate-google, /integrate-fb and /complete. Each step shows Tom's training video and a "Yes, I've done this" checkbox, the same as today:

1. Log in to HighLevel and whitelist our email
2. Purchase a phone number
3. My Profile: email signature, connect calendar, set availability, update time zone, connect Zoom
4. Integrate Google Business Profile
5. Integrate Facebook and Instagram business pages
6. Link the Facebook ad account to the CTC Ads Manager

v1.1 adds auto-verification where the HighLevel API can confirm a step (phone number exists, calendar connected, time zone matches the address). The step then shows "Verified" instead of relying on the checkbox.

### 5.3 FAQs

A simple list where the client adds questions their leads ask and the answers they give. Each FAQ can be edited, reordered and deleted. These go straight into the knowledge base the AI chat prompt generator builds. Clients see a starter set for their niche to edit, and starter sets per niche are a later improvement.

### 5.4 Voice profile interview (text)

A chat-style interview. The AI asks strategic questions about how the client talks to patients or customers, what they believe, words they use, words they hate, and how they open and close a conversation. The client also pastes 3 to 5 emails or messages they personally wrote, and adds links to videos of themselves. Links are stored now and transcribed in v1.1.

Output: a **voice profile** document in the structure the existing `research-client` and `content-creator` voice method use (voice summary, tone attributes with quotes, vocabulary, sentence rhythm, audience relationship, do and don't, sample lines, confidence level). Tom or the team can edit it. The client can view it.

Existing voice profiles in `Tom T7/.../Clients/<client>/voice.md` can be imported by an admin so current clients don't start from zero.

### 5.5 Ideal client avatar interview (text)

The same chat format. The AI drills into who the client's best patient or customer is: demographics, situation, pain, what they've tried, what they want, objections, where they hang out, and the words they use. Output: an **ideal client avatar** document.

### 5.6 Gating

Generators that write in the client's voice (VSL scripts, email, ads, social) won't run until the voice profile and avatar are complete. The screen says what's missing, for example "Create your voice profile first. It's used to write your videos, emails and AI agent." The AI chat prompt generator can run without them, using conversations and the website for tone. It notes the gap in its README.

## 6. Admin experience

### 6.1 Admin dashboard

- Counts: active clients, onboarding not started, onboarding in progress, onboarding complete, voice profile done, avatar done, setup steps complete.
- Client table with a status chip per stage. Filter by niche, status and "needs attention".
- Recent generator runs (running, done, failed) and AI spend this month across all clients.
- Alerts: clients at 80% of their budget, failed runs, expiring HighLevel tokens.

### 6.2 Client profile (admin view)

Tabs:
- **Overview:** HighLevel location info, niche, practice model, status, key contacts, links into HighLevel.
- **Onboarding:** answers (editable by owner and team), setup steps, FAQs.
- **Voice and avatar:** the profile documents and the interview transcripts.
- **Sources:** what the system knows and when it was fetched: website crawl, Fathom calls matched by client email (with a checkbox to include or exclude each call), HighLevel conversation analysis, client FAQs. Each can be refreshed.
- **Generators:** cards for each generator with its status and a Run button. Locked generators show what they need.
- **Outputs:** every output with its current version, version history, side-by-side compare, restore, copy-to-clipboard, download, and "share with client".
- **Usage and settings:** monthly AI budget, spend this month, alert and hard-stop thresholds, model overrides. Owner only by default.

### 6.3 Revising an output

On any output, "Request a change" opens a box: "This prompt isn't asking for the email before booking. Fix that." The generator reruns only the final writing step with the current version, the change request and the original sources. It saves a new version with the change note. Validators run again (see 7.2). Old versions are never deleted.

## 7. Generators

### 7.1 How a generator is built

Each generator is a folder in `generators/<key>/` with:
- `README.md`: the SOP in plain language (this is the "workflow" from the WAT framework)
- `recipe.ts`: the steps, which sources it needs, prerequisites, and outputs
- `prompts/`: the prompt templates, ported from Tom's skills and reference files
- `validate.ts`: deterministic checks that must pass before an output is saved
- `tests/`: fixtures and expected results

Generators run as background jobs (Inngest), so a 10-minute pipeline doesn't hit Vercel's request time limit. Each step saves its output, so a failed step can be retried without redoing everything. Each step also logs its AI token usage against the client.

### 7.2 v1 generator: AI Chat Prompt (Conversation AI)

This is a port of the AI Assistant Prompt Creator pipeline, minus video.

| Step | What it does | Source in today's project |
|---|---|---|
| 1. Resolve client | Pull location profile, calendars, custom values, channel and conversation counts from HighLevel | `workflows/01-resolve-client.md` |
| 2. Intake | Build intake answers from the onboarding form. Admin confirms or fills gaps in a short form: booking target, calendar ID, entry channels and keyword, assistant name, handoff | `workflows/02-client-intake.md`, `reference/intake-questions.md` |
| 3. Website | Firecrawl map, then scrape pages, clean into a corpus, extract facts | `03-website-knowledge-base.md`, `build_site_corpus.py` |
| 4. Conversations | Export 6 months of staff conversations (SMS, FB, IG), anonymize, analyze question clusters and staff tone | `04-conversation-analysis.md`, `anonymize_conversations.py`, `analyze_conversations.py` |
| 5. Fathom | Find calls where the client's email is a participant. Admin ticks which to include. Pull transcripts and summaries | new (was a manual extra source) |
| 6. Client FAQs | Read the FAQs from the onboarding app | new |
| 7. Synthesize | Knowledge base, ranked FAQ, voice and tone profile (uses the client's voice profile if present) | `06-synthesize-knowledge-base.md` |
| 8. Write prompt | Pick the template (online, or local office for brick-and-mortar), fill it, render paste-ready text | `07-generate-prompts.md`, `reference/prompt-template-*.md` |
| 9. Validate | No dashes, no Markdown in paste-ready text, no unfilled placeholders, merge fields exist, required sections present, under 2,000 words (warn at 1,950) | `validate_prompt.py` |
| 10. Settings and README | Settings sheet (calendar, channels, mode, model, delays, handoff) and a README of sources and gaps | `08-recommend-settings.md` |

Also produced: the **follow-up (re-engagement) prompt** and its settings, as done for Brian Abasolo.

**Outputs saved to the client:** knowledge base, FAQ, voice and tone, Conversation AI prompt (editable plus paste-ready), follow-up prompt, settings sheets, README.

**Rules carried over from today's project (non-negotiable):**
- Conversational booking only. Never send booking links to leads.
- A prompt never converts time zones. It reads the "Timezone" line the calendar tools return.
- Chat prompts stay under 2,000 words. HighLevel's editor refuses more.
- Tone comes from the client's staff and practitioner videos. Never from customers or a previous bot.
- No customer personal details in any output. Anonymize before analysis. Raw exports are deleted after the run.
- Paste-ready text is generated from the editable version, never hand-edited.
- Prompts follow the structure of `reference/example-prompts/shoulder-program-ig-dm.md`.

The Python tools have no third-party dependencies. They get ported to TypeScript with their existing test fixtures, so the outputs can be compared one to one.

### 7.3 Later generators (in Tom's priority order)

| # | Generator | Notes |
|---|---|---|
| 1 | **VSL video scripts and thank-you video scripts** | Written in the client's voice from the voice profile, avatar and offer. Today clients get a template. Uses the PASTOR approach from the sales-copy skills plus the structure of Tom's proven VSLs (RF Funnels transcripts) |
| 2 | **Email copy** | Pick a sequence: conversion, lead magnet follow-up, engagement bait, SMS copy, plus the Core Snapshot v2.0 set (see `email-content-map.md`). Port of `write-content` and the `email-copy-engine` agent, with the `human_voice.md` anti-AI checklist as a hard gate before saving |
| 3 | **Facebook ad copy plus media** | Copy from voice, avatar and offer. Images and video via Higgsfield, with an option for the client's own Higgsfield API key |
| 4 | **Meta ads integration and ads dashboard** | Client connects their ad account through the Meta Marketing API. Tom already has a verified Meta Business and a Meta developer app, but the ad-management permissions still need Meta app review, so plan weeks. Launch campaigns based on Tom's strategies (Lean on Laurel, $5 ad program, sprint ad testing). Optional auto-manage: run 5 ads a week, kill losers, keep winners, generate 5 more. Performance dashboard. HighLevel's Ad Manager has no confirmed public API, so direct Meta is the reliable path |
| 5 | **Results dashboard** | New leads, DMs, reply rate, booking rate, discovery calls booked. In Settings the client picks which HighLevel calendars count as discovery, assessment or sales calls and which tags count. Pulls active calendars from their sub-account |
| 6 | **Social content and scheduling** | Posts with copy and media for Facebook, Instagram and TikTok, scheduled through HighLevel's Social Planner API |

Also later, not ranked: Voice AI prompts (v2), Content Bible (to be defined, draft outline in section 9), training videos and courses with feedback, writing AI agents straight into HighLevel, VSL funnels and workflows (port of RF Funnels), website design, voice-conversation interviews, video transcription, starter FAQs per niche.

## 8. AI usage and limits

- Every AI call records the client, run, model, input and output tokens, and cost in `usage_events`. Model prices live in one config file Tom updates.
- Each client has a monthly budget in dollars (default set by the owner).
  - **80%:** alert to Tom (email and/or Slack) and a banner in the admin profile.
  - **100%:** hard stop. New runs for that client are blocked until the owner raises the limit or the month resets. A run already in progress finishes its current step and then stops.
- The owner can override the stop for one run.
- v1 bills everything to Tom's Anthropic account. If clients run generators later, the same metering supports charging them.

## 9. Content Bible (to define)

Tom will define this from scratch. This is a starting outline to react to, not a decision:

- Brand story and origin
- Ideal client avatar summary (links to the avatar profile)
- Core problems, desires and false beliefs
- The mechanism or method (named process)
- Offers and lead magnets
- Proof bank: results, testimonials, numbers (verbatim, with source)
- Content pillars (3 to 5 themes)
- Hook bank and angles
- Vocabulary: say this, never say that (links to the voice profile)
- Calls to action per channel

## 10. Data model (Supabase)

Every table that holds client data has a `client_id`, and row-level security enforces access. Clients only see rows for their own location. Staff access follows the `staff` table.

| Table | Purpose |
|---|---|
| `clients` | One per HighLevel location: location ID (unique), name, niche, practice model, status, SaaS status, optional Stripe customer ID, settings (budget, thresholds) |
| `ghl_installations` | OAuth tokens per location (encrypted), scopes, expiry, installed and uninstalled dates |
| `staff` | Owner and team members, email, role, permissions checklist, active flag |
| `client_users` | HighLevel users who have opened the app: HighLevel user ID, location, name, email, last seen |
| `onboarding_submissions` | Answers as JSON, branch, question-set version, step progress, submitted date |
| `setup_steps` | Per client, per step: done date, and whether a person ticked it or the API verified it |
| `client_faqs` | Question, answer, order, source |
| `interviews` | Voice, avatar (later Content Bible): status and the full transcript |
| `outputs` | One per asset per client: kind, title, current version, shared with client |
| `output_versions` | Version number, editable content, paste-ready content, change request, validation results, who made it, which run |
| `generation_runs` | Generator, client, status, who started it, input snapshot, sources used, gaps, error, cost |
| `run_steps` | Per step: status, output reference, logs, tokens |
| `source_documents` | Website corpus, Fathom transcripts, conversation analysis: storage path and fetch date |
| `usage_events` | Every AI call and its cost |
| `audit_log` | Who changed what, when |

Large text (crawls, transcripts) goes in Supabase Storage. Tables hold the reference.

## 11. Architecture

- **Next.js** (App Router, TypeScript) on **Vercel**. Two route groups: `(admin)` for the standalone admin app and `(embed)` for the HighLevel Custom Page.
- **Supabase**: Postgres, Auth (admin OTP), Storage, row-level security. Schema changes only through migration files.
- **Inngest** for background jobs: generator pipelines, token refresh, nightly source refresh.
- **Anthropic API** for all generation. The model is set per generator step in config.
- **Firecrawl API** for websites, the **Fathom API** for calls and transcripts, the **HighLevel API v2** via OAuth. Later: Meta Marketing API, Higgsfield.
- **Secrets** only in Vercel and Supabase environment settings and a local `.env.local` that is never committed.
- **GitHub** repo with preview deployments per branch. `main` deploys to production.

```
HighLevel sub-account ──Custom Page iframe──▶ Next.js (embed)
        │  postMessage SSO                         │
        ▼                                          ▼
  encrypted user data ──▶ /api/sso (decrypt, check active) ──▶ session token
                                                   │
Admin browser ──OTP──▶ Next.js (admin) ────────────┤
                                                   ▼
                                    Supabase (data, RLS, storage)
                                                   │
                         Inngest jobs ◀────────────┘
                     (generators, refresh)
                           │
     Anthropic · HighLevel API · Fathom · Firecrawl
```

## 12. Roadmap

| Phase | Scope | Done when |
|---|---|---|
| 0. Foundation | Repo, Supabase project, Vercel, Inngest. Marketplace app with OAuth install and Custom Page SSO. Admin OTP login. Staff and permissions. Usage metering. Audit log | Tom installs the app on a test sub-account, opens Command Center inside HighLevel, and sees "onboarding not started". He logs in as admin and sees the client |
| 1. MVP | Branching onboarding form, setup steps, FAQs, voice profile interview, avatar interview, admin dashboard and client profile, AI Chat Prompt generator plus follow-up prompt with versions and change requests, usage limits | One real client completes onboarding inside HighLevel. Tom generates their chat prompt and it matches or beats the Claude Code output for the same client (compare against North Country or Brian Abasolo) |
| 1.1 | Setup step auto-verification, HighLevel write-back (custom values), video transcription, import existing voice profiles | |
| 2 | VSL and thank-you video scripts, Voice AI prompts, Content Bible | |
| 3 | Email copy | |
| 4 | Facebook ad copy plus media | |
| 5 | Meta ads integration and ads dashboard | Start the Meta app review during phase 2 so it isn't blocking |
| 6 | Results dashboard | |
| 7 | Social content and scheduling | |

## 13. Open questions

1. **HighLevel write-back in v1:** should the onboarding submit write custom values (and start A2P) right away, or wait for 1.1? It's drafted as "built in v1, off per client until Tom turns it on".
2. **Active-client check:** which HighLevel field reliably shows a SaaS-mode subscription is active or paused? Needs testing on a real paused account.
3. **Health data:** conversations from PT and chiro practices can contain health information. If any client is a HIPAA covered entity, raw conversation data needs a decision. The current approach is to anonymize first and never store raw exports. Alternatively, use the HIPAA options from Supabase, Vercel and Anthropic, which require business associate agreements and paid plans. Tom to decide with his attorney.
4. **Client view of outputs:** should clients see generated prompts at all, or only things like VSL scripts they act on? The default is that nothing is shared until a team member clicks "share".
5. **Default monthly budget per client** and where alerts go (email, Slack channel).
6. **Domain** for the admin app.
7. **Skills inventory:** the user-level skills copied to `_import/user-level/` still need mapping to generators. This happens in phase 0 (`docs/skill-inventory.md`).

## 14. Risks

| Risk | Mitigation |
|---|---|
| Safari blocks iframe cookies | Token in memory, re-run SSO on load, test every browser and the HighLevel mobile app |
| Marketplace app approval or scope limits | Keep the app private to Tom's agency; request only needed scopes |
| Long pipelines time out on Vercel | Inngest step functions with per-step retries |
| AI output quality drops versus hand-run Claude Code | Port templates and validators exactly; side-by-side comparison on two known clients before calling MVP done |
| Meta app review delays | Start the review early (during phase 2) |
| A beginner breaks production | Preview deploys per branch, `main` protected, tests and type checks before every merge, database changes only through migrations |
| Secrets leak (an `.env` and an SSH key sit in Snapshot Builder today) | Nothing from `_import` with secrets gets committed; `.gitignore` covers `.env*` and keys; secrets only in Vercel and Supabase settings |
