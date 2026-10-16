# Rivet AI eval

Measures whether an AI assistant writes correct Rivet: 21 small tasks in fresh starter apps (counter, todo list, tabs, routes, loaders, server actions, validated forms, a form in a drawer on a live page, `@rivetjs/ui` modal / select, lucide icons, client effects, live props, a React port). The runner never calls a model and needs no API key: it grades files.

Each task's output is checked in five steps; the first failure stops the task:

| Check       | Passes when                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| `files`     | every file the task names exists; no React / Solid import, hand-written SVG path, Unicode icon glyph or raw HTML            |
| `rv`        | the Rivet compiler and language service report no `RV` error (same as the MCP tool `check_code`)                            |
| `build`     | the starter plus the output builds like `npm run build` (SSR + prerender catch values that cannot resume)                   |
| `typecheck` | `tsc -p .` reports no error in the app's files                                                                              |
| `behaviour` | the built app is served and Chromium runs the task's steps (clicks, typing, keys, assertions) with no page or console error |

## Commands (repo root)

```sh
export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH   # Node ≥ 24
node scripts/ai-eval/run.ts --reference                        # grade the seeded solutions (all pass)
node scripts/ai-eval/run.ts prompts --out .artifacts/ai-eval/prompts   # one prompt file per task
node scripts/ai-eval/run.ts --outputs <dir> [task …] [--json report.json] [--keep]
```

Outputs layout: `<dir>/<task id>/<path from the app root>`, for example `<dir>/todo-list/src/routes/index.tsx`. Tasks and their checks are in `tasks.ts`; reference solutions in `reference/<task id>/`. `--keep` leaves the staged apps in `.artifacts/ai-eval/<task id>/`.

## Running it with Claude Code and the Rivet MCP server

1. Register the MCP server from this repository (the packages are not on npm yet): `claude mcp add rivet -- node <repo>/libs/mcp/cli.ts`.
2. For each task, make a workspace: `node scripts/ai-eval/run.ts workspace todo-list`. It is a copy of the task's starter in `.artifacts/ai-eval/work/todo-list/` with the starter's `AGENTS.md`, `CLAUDE.md`, skills and editor rules, plus the prompt in `TASK.md`.
3. Start Claude Code in that folder and give it the prompt: `cd .artifacts/ai-eval/work/todo-list && claude "$(cat TASK.md)"` (or `claude -p "$(cat TASK.md)"` for a non-interactive run). Let it use the MCP tools (`search_docs`, `get_component`, `check_code`, …) and the project commands.
4. Collect the files it wrote: `node scripts/ai-eval/run.ts collect todo-list --from .artifacts/ai-eval/work/todo-list --outputs .artifacts/ai-eval/out`.
5. Grade: `node scripts/ai-eval/run.ts --outputs .artifacts/ai-eval/out --json .artifacts/ai-eval/report.json`.

To compare setups, run the same tasks without the MCP server, or in a workspace with `AGENTS.md`, `CLAUDE.md`, `.claude/` and `.cursor/` deleted, and grade both output folders.

Caveat: a workspace inside the repository lets Claude Code also read the repository's own `CLAUDE.md` files (parent folders), which know more than an app author's project would. For a clean run, put the workspace outside the repository (`--out /tmp/eval/todo-list`) once the `@rivetjs/*` packages can be installed from a registry, or from tarballs (`node scripts/package/create-e2e.ts --keep` shows how).

Any other assistant works the same way: give it `TASK.md` in the workspace, collect, grade.
