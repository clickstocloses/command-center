# Clicks to Closes Command Center

The client portal and AI command center for Clicks to Closes, running inside HighLevel.

- **Spec:** [docs/PRD.md](docs/PRD.md)
- **How Claude Code works in this repo:** [CLAUDE.md](CLAUDE.md)
- **What's being ported from the old Claude Code projects:** [docs/skill-inventory.md](docs/skill-inventory.md)

Stack: Next.js, Supabase, Vercel, Inngest, Anthropic API, HighLevel Marketplace app.

Status: Phase 0 (foundation). App shell is up; see `plans/2026-10-20-phase-0-foundation.md`.

## Run it

```bash
npm install
npm run up       # Docker + local Supabase + dev server at http://localhost:3000
npm run check    # type check, lint, tests. Must pass before any step is done
```
