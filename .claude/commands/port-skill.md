Port an imported skill or project into this app. The source path is: $ARGUMENTS

1. Read the source under `_import/` (it's read-only and gitignored). Never copy a `.env` file, key or anything that looks like a secret. If you see one, say so and leave it.
2. Find its row in `docs/skill-inventory.md`. If there's no row, propose one.
3. Propose in plain language: which generator it feeds, what becomes `knowledge/` (prompt templates, frameworks, checklists, facts the app's AI reads at runtime), what becomes code in `src/lib/` or `generators/<key>/` (anything deterministic: validators, parsers, renderers, with their test fixtures), and what's skipped.
4. Ask Tom before writing anything.
5. After porting, strip any real client names or data from fixtures, update the inventory row's status to `done`, and note the port date.
