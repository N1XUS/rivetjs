# @rivetjs/bench-stable

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Dependency-only workspace: isolates the **stable** Solid 1 / Qwik 1 toolchains from the Solid 2 / Qwik 2 preview deps used elsewhere. No source, no nx project, no tests.

## Entry points

- `package.json` — pinned exact versions (checked against npm 2026-10-04): `solid-js` 1.9.15, `@builder.io/qwik` 1.20.1, `babel-preset-solid` 1.9.15, `@babel/core` 7.29.7, `vite-plugin-solid` 2.11.14, `vite` 7.3.6 (Qwik 1 peer `>=5 <8`).
- `README.md` — version table + purpose.

## Who resolves from here

- `apps/ssr-bench/stable-build.ts` — `stableRoot = ../bench-stable`, `stableRequire` → `solid-stable`, `solid-stable-string`, `qwik-stable` SSR lanes.
- `apps/resume-bench/stable-dependencies.ts` — `stableRequire`, `stablePackage`, `stableSolidAliases`, `assertStableSolidModules` → resume `solid-stable` / `qwik-stable` lanes.
- `apps/dom-bench/build.ts` — imports `../resume-bench/stable-dependencies.ts` → dom `solid-stable` lane.

## Rules / invariants

- Stable lanes must resolve runtime **and transitive imports** through this workspace only; never mix Solid 1 and Solid 2 instances (builds assert provenance; build manifests record exact versions).
- Lane names: `solid-stable`, `qwik-stable` (stable); `solid`, `qwik` stay the preview lanes (Solid 2.0.0-rc.13, Qwik 2.0.0-rc.0).
- Don't change other workspaces' locked versions to add a dep here. Bumping a version here changes ssr-bench lane bytes → zero-cost `lanes.txt` diff (intended deltas only: `sh scripts/zero-cost/check.sh --update`).

## Commands

- Install: repo root `npm ci` (installs all workspaces). Nothing to build/test here.

## Gotchas

- Moving this folder breaks the hard-coded `../bench-stable` paths in ssr-bench and resume-bench.

## See also

- [README.md](README.md), [../ssr-bench/CLAUDE.md](../ssr-bench/CLAUDE.md), [../resume-bench/CLAUDE.md](../resume-bench/CLAUDE.md), [../dom-bench/CLAUDE.md](../dom-bench/CLAUDE.md)
