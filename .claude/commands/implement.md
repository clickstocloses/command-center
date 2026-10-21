Execute a plan step by step. The plan is: $ARGUMENTS

1. Read the plan. If a task is already checked off, skip it.
2. Work on a feature branch, never on `main`.
3. For each task: do the steps in order, run `npm run check` when the task says to, and tick the checkboxes in the plan file as you finish them. Commit after each working task.
4. Before anything on the plan's "needs Tom first" list, stop and ask. Don't add packages, create outside resources, write to a live HighLevel account or spend money without a yes.
5. If something fails, read the full error, fix the cause, rerun, and add a dated note to the relevant README or knowledge file.
6. When the plan is done, update its status line, update the "Current status" section of `CLAUDE.md`, and tell Tom exactly what to open or click to see it working.
