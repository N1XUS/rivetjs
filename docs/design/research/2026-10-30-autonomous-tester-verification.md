# Autonomous tester verification — 2026-10-30

Implementation: `57655650e`; snapshot-startup repair: `1f5632a2a`. These implement the approved autonomous-tester design. Tests establish the supervisor's real Git/Vitest/process/intake behavior with scripted subprocesses only at the external model boundary; they are not claimed AI discoveries.

## Maintained verification

Node 24.18.1, macOS arm64. Full `scripts` project: **106/106 tests, 14 files**, 214.56 seconds. The 37 harness cases cover actual seeded RED/GREEN/commit, unrelated staged/unstaged/untracked work, canceled staged changes, assume-unchanged bytes, no-commit/no-finding, zero tests, setup/import failures, false proof, incomplete gates, review rejection/mutation, moved HEAD, deadlines/interrupts, memory and detached-child cleanup, locks, traversal/symlinks, snapshot package/bin/nested dependency resolution, gate/build configuration protection and tracked files covered by ignore rules. TypeScript and changed-file formatting pass.

Independent final review found three issues: staged-vs-working-tree cancellation hid WIP, candidate Nx/Vite configuration could weaken gates, and nested benchmark dependencies were missing. Each was reproduced before its repair and covered by passing regression tests afterward. Snapshot Qwik packages are copied per the existing path-sensitive zero-cost rule. Candidate bytes/index blobs are checked against base, and proof files receive SHA-256 receipts. No library production source or byte baseline was changed by this work.

## Real CLI attempts

Command for both attempts:

```sh
node scripts/ai-tester/cli.ts run --area reactivity --no-commit --timeout 5
```

1. `2026-10-30T17-23-15-300Z-e28f8328`, source `57655650e`: failed before Codex inference. A new snapshot index refused committed `apps/resume-bench/results` files covered by ignore rules. The startup regression was observed RED, then fixed by force-adding only the exact committed ls-tree path list. Its run/events/source inventory are preserved; the unused pre-inference work tree was removed.
2. `2026-10-30T17-30-47-967Z-c4dd6504`, source `1f5632a2a`: snapshot startup completed and the actual Codex CLI launched. CLI version 0.153.4, existing ChatGPT authentication, inherited configured model `gpt-6.1-sol`. The inference backend rejected this model with HTTP 400 `model_not_found` (“not supported when using Codex with a ChatGPT account”). Supervisor exited 2 with terminal `failed` / `worker exited 1`; no source changes, no regression/fix, and no commit occurred. Peak sampled RSS including supervisor: 1,550,745,600 bytes; campaign lock released. Snapshot `@rivetjs/reactivity` realpath points into its own `work/libs/reactivity`; the Qwik package is physically in the snapshot.

Raw records, worker log and proof hashes remain under `.artifacts/ai-tester/<id>/`. The account's local model cache lists the configured slug, but the actual inference failure takes precedence over cached availability. Official [Codex app-server guidance](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server) likewise distinguishes a cached catalog from successful inference access.

The implementation preserves the configured model/authentication and does not silently migrate models, change global Codex configuration, consume a usage reset or retry an unsupported model indefinitely. Live end-to-end AI discovery/repair remains unverified until a compatible CLI profile/model is supplied. The user was asked whether to keep a repaired CLI profile or add an explicit model override. This provider/configuration blocker is separate from the passing deterministic supervisor tests.

## Remaining acceptance

A real provider campaign must complete inference and then either return supported executed no-finding evidence plus a passing native baseline, or complete minimized repro, independent RED/GREEN, unchanged affected gates and read-only review. Only then can live discovery/repair be claimed. Existing tests verify that model/process/setup failures cannot become green or committed outcomes.
