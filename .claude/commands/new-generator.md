Scaffold a new generator. The key is: $ARGUMENTS (lowercase, hyphenated, for example `ai-chat-prompt`).

1. Read `docs/PRD.md` section 7 and one existing `generators/<key>/` folder if any exist, so the new one matches.
2. Create `generators/<key>/` with:
   - `README.md`: the SOP. Sections: What it makes, Inputs and sources, Prerequisites (what gates it), Steps, Outputs, Validation rules, Known gaps, Change log (dated lines).
   - `recipe.ts`: exports the generator's key, title, prerequisites, sources, steps (each with a model setting read from config) and outputs, typed against the shared generator types in `src/config/generators.ts`.
   - `prompts/`: empty folder with a `.gitkeep`, prompt templates go here as Markdown.
   - `validate.ts`: exports `validate(output)` that at least runs `findDashes` from `src/lib/text/dashes.ts` and returns a list of problems.
   - `tests/validate.test.ts`: one passing test per validation rule, with made-up fixtures only.
3. Register the generator in `src/config/generators.ts`.
4. Run `npm run check`.
5. Don't write prompt content or AI steps yet. That comes from `/port-skill` and the generator's own plan.
