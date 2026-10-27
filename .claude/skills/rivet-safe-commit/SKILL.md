---
name: rivet-safe-commit
description: Use when committing in the Rivet monorepo main checkout — commits only named paths through a temporary git index so other lanes' staged/unstaged work and user WIP are never swept in.
---

# Rivet safe commit

Main checkout is shared by several agents and the user. A bare `git commit` / `git add -A` once swept another lane's work (OPT-B). Always commit through a temporary index.

## Never

- `git add -A`, `git add .`, `git commit -a`, `--amend`, `stash`, `reset --hard`, worktrees, rebase, push (push only when the user says so in this session).
- User WIP: `apps/playground/src/routes/_layout.tsx`, `apps/playground/tsconfig.json`, `apps/docs/examples/todo-list/src/routes/index.tsx`, `apps/ui-docs/examples/card-with-images/**`, `*-tmp.ts`.
- `package-lock.json` (unless the user approved that change), `apps/ui-docs/src/generated/api.json`.

## Steps

1. List exact paths in a file, one per line (`paths.txt`). Include CLAUDE.md / docs / regenerated outputs the change requires (docs follow code — see `rivet-docs-sweep`).
2. Check each path: `git diff --stat -- $(cat paths.txt)`; new files `git status --short -- <path>`. Nothing from the never-list.
3. Format owned TS/TSX/JSON that were prettier-clean at HEAD: `npx prettier --write <files>`.
4. Commit with a temp index:
   ```bash
   export GIT_INDEX_FILE=$(mktemp -d)/index
   git read-tree HEAD
   git add --pathspec-from-file=paths.txt
   git diff --cached --stat          # verify: only your paths
   git commit -F msg.txt
   unset GIT_INDEX_FILE
   git reset -q -- $(cat paths.txt)  # sync the real index for those paths (no-op if unstaged)
   ```
   Deleted files: `git rm --cached --pathspec-from-file=…` under the temp index.
5. Message: Conventional Commits, scope = packages (`perf(router,runtime): …`), lane tag in parens when from a lane (`(BIG-UI-3)`), body = what / why / numbers (+ command), gate results, intended baseline updates (`zero-cost --update`, size, frames) stated explicitly. Last line exactly:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
6. `git show --stat HEAD` — confirm file list.
