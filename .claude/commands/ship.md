Commit the current work, push the branch, and hand Tom the preview link.

1. Refuse if the current branch is `main`. Tell Tom to start a feature branch first (`git checkout -b feat/<name>`).
2. Run `npm run check`. Stop and fix if it fails.
3. Run `git status` and `git diff --stat`. Make sure no `.env*` file, key or anything from `_import/` is staged. If one is, stop and warn.
4. Commit everything with a message that says what changed in plain words (one line, under 72 characters, then a short body if useful). End the message with the Co-Authored-By line from the session's attribution rules.
5. `git push -u origin <branch>`.
6. If the Vercel project is connected, give Tom the preview URL for this branch. If not, say the push succeeded and that the preview appears once Vercel is linked (Phase 0 plan, Part F).
7. Tell Tom in one line what to click to test it.
