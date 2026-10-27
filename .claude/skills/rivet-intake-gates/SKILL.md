---
name: rivet-intake-gates
description: Use before reporting a Rivet change done or when landing a lane's patches on main — picks the affected gates (typecheck, vitest projects, builds, docs/llms/MCP/AI checks, zero-cost, size, frames, format), runs them within host limits and records results.
---

# Rivet intake gates

Root CLAUDE.md "Gates" = source of truth for each command. This skill = order, scope, limits, reading results.

## Host limits (binding)

- `export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH; export NX_DAEMON=false NX_ISOLATE_PLUGINS=false`.
- Repo root, absolute paths. `nice` heavy commands; one heavy command per lane at a time; RAM ≤ 3 GB per process tree.
- vitest: `NODE_OPTIONS=--max-old-space-size=2048 npx vitest run --project <p> --maxWorkers=2`. Never cdk + ui resume fuzz at once.
- Typecheck per project (`"${p}:typecheck"` quoted — zsh `:t` modifier); never nx `--parallel` > 2; ui-docs alone.
- Bash call ≤ 600 s: long runs `nohup … > log 2>&1 &`, then wait on the log.

## Pick gates (affected only; CI runs the full matrix on push)

- Default: `node scripts/gates/run.ts` (vs `HEAD`; `--base <ref>` for committed lane work; `--list` first to see the plan; `--only <gate,…>` / `--skip` to narrow; `--update-baselines` for intended byte deltas; `--json <file>`). It encodes the ordering gotchas below, the limits above (sequential, `nice`, 3-slot heavy semaphore, tree RSS > 3 GB = red) and the known-red registry `scripts/gates/known-reds.json` (add an entry with reason + owner instead of re-explaining a base red). Details: `scripts/CLAUDE.md` "Gates runner"; `--help`.
- Long run: `nohup node scripts/gates/run.ts … > log 2>&1 &`, wait on the final `gates:` line; logs + `report.json` in `.artifacts/gates/<timestamp>/`.
- By hand (only when the runner cannot express it):
  1. Projects touched + direct dependents → `typecheck` each; `node scripts/check-tsx-projects.ts`.
  2. vitest projects of touched libs (names in `vitest.config.ts`).
  3. Compiler touched → `npx nx run compiler:parity`.
  4. Docs content / docs-kit / ui / cdk / runtime touched → docs builds of affected apps (`docs:build`, `cdk-docs:build`, `ui-docs:build`; measure RSS with `/usr/bin/time -l`), then `check-content <app> --strict`, `check-snippets`, `llms <app> --check`, `errors apps/docs --check`.
  5. `node libs/mcp/build-data.ts --check`, `node libs/mcp/ai/sync.ts --check` when docs / AI sources changed.
  6. Runtime / router / compiler / kit bytes → `sh scripts/zero-cost/check.sh` (expect `identical`, `dev leaks: none`, `condition parity: ok`, `N/N corpus cases match`), `npm run size-report -- --check`, `node scripts/size-report/frames.mjs --check`.
  7. `npm run format:check`.

## Ordering gotchas

- Tests that read built dist (`apps/docs/tests/site.test.ts` home perf) run AFTER the docs build; regenerate `_home-perf.json` with `node apps/docs/scripts/home-perf.ts` after it.
- ssr-bench adapter tests need the ssr-bench build first.
- `--update` (zero-cost / size / frames) only for intended deltas; keep unrelated lines (zero-cost Qwik lane lines are noise — restore them). Rerun size `--check` once before calling growth real (run-to-run noise exists).

## Reading reds

- Red → check base: same test on `HEAD` without the change, in a `git archive HEAD` snapshot (never stash in the shared checkout). Base-red = known, note it; new red = blocker.
- Known flaky: router `document-links`, runtime `click-defer-browser` timing, broad ui-components browser reds — confirm they are not in touched areas.
- Record a one-line-per-gate summary file (gate, exit / counts, RSS) and quote it in the commit body.
