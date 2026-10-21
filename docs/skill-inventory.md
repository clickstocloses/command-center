# Skill Inventory

What was imported from Tom's existing Claude Code setup, and where each piece goes in Command Center.

**Status key:** `port` = bring into `knowledge/` or a generator when that phase starts · `dev` = useful to Claude Code while building (goes in `.claude/skills/`) · `later` = feeds a later phase · `skip` = not needed here (stays where it is) · `done` = ported

**Sources:**
- `_import/user-level/` = `~/.claude` (skills, agents, global CLAUDE.md), copied 2026-10-20
- **Prompt Creator** = `~/Documents/Claude/Projects/AI Assistant Prompt Creator`
- **Snapshot Builder** = `/Volumes/Tom T7/Agentic Workflows - Claude Code/_Parent - AAS/Snapshot Builder`
- **RF Funnels** = `~/Documents/Claude/Projects/RF Funnels`

> `_import/` is gitignored. It holds third-party skills and two real `.env` files (`skills/gohighlevel-cli/.env` and `.env.atm-investors`). Nothing from it is committed directly. Content is ported into `knowledge/` or `generators/` by hand, and each port is recorded below.

---

## Phase 1: AI Chat Prompt generator (v1)

| Source | What it gives us | Goes to | Status |
|---|---|---|---|
| Prompt Creator: `workflows/01` to `08`, `create-ai-assistant.md` | The full pipeline and its lessons learned | `generators/ai-chat-prompt/README.md` | port |
| Prompt Creator: `reference/prompt-template-conversation-ai*.md`, `example-prompts/shoulder-program-ig-dm.md` | Prompt templates (online and local office), the structural source of truth | `knowledge/prompts/` | port |
| Prompt Creator: `reference/ghl-prompting-101-checklist.md`, `paste-ready-format.md`, `conversation-ai-settings.md`, `intake-questions.md` | Checklists, format rules, settings reference | `knowledge/prompts/`, `src/config/` | port |
| Prompt Creator: `tools/*.py` + `tools/tests/` | Anonymizer, corpus builder, conversation analyzer, renderer, validator, with test fixtures | TypeScript in `src/lib/` and `generators/ai-chat-prompt/validate.ts`, same fixtures | port |
| Prompt Creator: CLAUDE.md "HighLevel facts" table | Live-tested HighLevel behavior (time zones, word cap, tools) | `knowledge/ghl-facts.md` | port |
| Prompt Creator: `outputs/north-country-chiropractic/`, `outputs/brian-abasolo/` | Known-good outputs to compare against | `tests/golden/` (anonymized) | port |
| Snapshot Builder: `dm-automations` + `booking-bot-framework.md` | Booking bot and comment responder message flows | follow-up prompt step | port |
| `email-dynamic-fields` | Standard HighLevel merge fields | validator merge-field list | port |
| synced `client-ai-agent-setup` | Older version of the same job (KB plus booking and follow-up prompts) | superseded by Prompt Creator | skip |

## Phase 1: Voice profile and ideal client avatar interviews

| Source | What it gives us | Goes to | Status |
|---|---|---|---|
| `content-creator/references/voice_capture_guide.md`, `client_voice_template.md`, `writing_in_voice.md` | How to capture a voice and the profile format | `knowledge/voice/`, interview script | port |
| `content-creator/references/human_voice.md` | Anti-AI checklist (hard gate on all copy) | `knowledge/human_voice.md` | port |
| Snapshot Builder: `research-client` | Tone-of-voice structure and the "confidence" rule | voice profile format | port |
| `T7/.../Clients/<client>/voice.md` | Existing client voice profiles | one-time import (phase 1.1) | later |

## Phase 2: VSL and thank-you video scripts

| Source | Goes to | Status |
|---|---|---|
| `sales-copy-pastor` (+ references), agent `sales-copy-writer-agent`, synced `ray-edwards-email-copy` | `generators/vsl-scripts/` | later |
| RF Funnels: `context/transcripts/` (real client VSLs and thank-you videos) | examples in `knowledge/vsl/` (anonymize where needed) | later |
| RF Funnels: `vsl-thumbnail` skill, `workflows/ghl-vsl-funnel-build.md` | later VSL funnel generator | later |

## Phase 3: Email copy

| Source | Goes to | Status |
|---|---|---|
| `email-sequence-copywriter` + `references/01` to `10` | `knowledge/email/` sequence frameworks | later |
| agent `email-copy-engine`, Snapshot Builder `write-content`, `build-snapshot/email-content-map.md` | `generators/email-copy/` | later |
| synced `email-welcome-sequence`, `copy-editing` | email frameworks, revision step | later |
| `ghost-ink` | optional deliverability pass for emails | later |

## Phases 4 and 5: Facebook ads, Meta integration, ads dashboard

| Source | Goes to | Status |
|---|---|---|
| `ad-creative`, `ads` | ad copy generator | later |
| `nano-banana-2`, Higgsfield (MCP) | ad images and video | later |
| `meta-ads-creative` | Reference only. It's built around another brand's design style ("Lead Gen Jay"), so it needs a Clicks to Closes version | later |
| `meta-ads`, `meta-launcher`, `meta-optimize`, `meta-report`, `meta-research`, `meta-ads-tracking` | Meta Marketing API integration, kill-losers loop, reporting | later |
| `sprint-ad-testing` | Testing ladder for auto-managed ads | later |

## Phase 1.1: Setup step auto-verification and HighLevel write-back

| Source | Goes to | Status |
|---|---|---|
| `ghl-fb-ig-messaging-qa` | auto-verify "Facebook and Instagram connected" | later |
| `ghl-calendar-setup`, `ghl-custom-values`, `ghl-a2p-registration` | write-back field map, A2P from onboarding answers | later |
| `ghl-client-onboarding`, `ghl-brand-domain`, `ghl-email-domain`, `ghl-funnel-domain`, `ghl-user-management` | admin checklist items (not automated in v1) | later |

## HighLevel API knowledge (all phases)

| Source | Goes to | Status |
|---|---|---|
| agent `ghl-agent`, `gohighlevel-cli` (docs only, never its `.env`), `ghl-email-templates`, `ghl-workflow-template-sync` | `knowledge/ghl-facts.md` and `src/lib/ghl/` design notes | port |
| RF Funnels CLAUDE.md lessons (OAuth app not installed, token rotation, form routing) | `knowledge/ghl-facts.md` | port |

## For Claude Code while building (dev)

| Source | Goes to | Status |
|---|---|---|
| `supabase-postgres-best-practices`, `vercel-react-best-practices`, `frontend-design`, `web-design-guidelines` | `.claude/skills/` | dev |
| `deploy` | becomes the `/ship` command | dev |
| agents `code-reviewer`, `documentation-expert` | `.claude/agents/` | dev |
| user-level CLAUDE.md (coding style, security rules) | merged into project CLAUDE.md | done |
| `ab-testing-suite` | later, if client pages get A/B tests | later |

## Not needed in Command Center

`cold-email`, `seo-audit`, `cro`, `heatmap-analyzer`, `heatmap-cro-pack`, `notebooklm`, `miro-mcp`, `find-skills`, `vercel-react-native-skills`, `mobile-app-design`, `video-use`, `antigravity-protocol`, agents `frontend-developer` and `mcp-server-architect`. From the synced folder: `docx`, `pdf`, `pptx`, `xlsx`, `docs`, `google-workspace`, `morning`, `monthly-accounting`, `client-status-report`, `clickup-client-project-setup`, `transcript-formatter`, `deep-research`, `import-memory`, `skill-creator`, the browser and computer-use skills. They keep working where they are.

Snapshot Builder's proposal pipeline (build plan, 1-Slide Offer, SOW, provisioning, deploy) is not part of the current roadmap. It could become a "Snapshot build plan" generator later.
