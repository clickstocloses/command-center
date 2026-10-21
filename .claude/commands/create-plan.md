Write an implementation plan before any significant change. The request is: $ARGUMENTS

1. Read `CLAUDE.md`, the relevant sections of `docs/PRD.md`, and any existing plan in `plans/` that touches the same area.
2. Use the `superpowers:writing-plans` skill. Save the plan to `plans/YYYY-MM-DD-<feature-name>.md` (this project's location, not the skill's default).
3. The plan must have: goal, the files to create or change, bite-sized tasks with the actual code and commands, and a "Tom can test by" line for each task that ends in something clickable.
4. List up front anything that needs Tom first: a new npm package, an outside service or account, a HighLevel write, or anything that spends money.
5. Don't implement anything. End by telling Tom where the plan is and asking whether to run `/implement` on it.
