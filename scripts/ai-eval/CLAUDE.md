# scripts/ai-eval — AI eval suite

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Grades model-written Rivet code (no model calls, no keys): 21 tasks, five checks each. Human workflow (Claude Code + MCP): `README.md`.

## Layout

- `tasks.ts`: `TASKS: EvalTask[]` (`id`, `title`, `template` static / server / ui, `prompt`, `files` the model writes, `open`, `status` (HTTP status per path), `steps: EvalStep[]` = docs-kit example `Step` (`libs/docs-kit/define.ts`) + `{ reload }`, `{ viewport: [w, h] }`, `{ count: [sel, n] }`, `forbid` patterns). Prompts name ids / attributes only, never how to write Rivet.
- `run.ts`: CLI + API. `grade({ outputs, ids?, keep? })` → `TaskResult[]`; per task `checkFiles` (required files + `COMMON_FORBID`: React / Solid imports, `<path d=`, Unicode icon glyphs, raw HTML) → `stage` (starter copy without AI files / `dist` / `.rivet` into `.artifacts/ai-eval/<id>/` + outputs) → `checkRv` (`libs/mcp/check.ts` `checkCode`, `types: false`, resume mode) → `build` (starter `build` script steps, `NODE_ENV=production`) → `typecheck` (`tsc -p .`; errors inside `../../../libs/**` sources ignored: not the model's) → `behaviour` (`node serve.js` PORT=0, Chromium, docs-kit `run()` per step, `pageerror` / console errors fail except "Failed to load resource"). Subcommands `prompts`, `workspace <id>` (starter incl. AGENTS.md + `TASK.md`), `collect <id> --from --outputs`.
- `reference/<id>/<app path>`: seeded solutions; all pass (test). Write them like an app author would (they double as worked examples).

## Tests / commands

- `scripts/tests/ai-eval.test.ts` (vitest `scripts`; CI `gates` installs Chromium for it): task shape, every reference passes all five checks (~75 s, ~0.65 GB RSS main + one Vite build at a time), wrong answers fail the right check (React import → files, `onclick` → RV1012, `window` in render → RV2001, plain variable → behaviour).
- `node scripts/ai-eval/run.ts --reference [id …]`, `--outputs <dir> [--json f] [--keep]`.

## Gotchas

- Staging lives inside the repo so `@rivetjs/*` resolve from the root `node_modules` (not on npm yet); a Claude Code workspace there also sees the repo's CLAUDE.md files (README caveat).
- Depends on docs-kit `tools/example-checks.ts` `run()` and `define.ts` `Step` (renames break the runner) and on `libs/mcp/check.ts`.
- A form submit on a non-live page re-renders it (signals reset): tasks keeping client state across a submit need `export const live = true` (validated-form, drawer-form).
