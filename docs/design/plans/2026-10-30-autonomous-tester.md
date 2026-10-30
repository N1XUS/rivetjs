# Autonomous Rivet Tester Implementation Plan

> Execute inline with superpowers:executing-plans; final fresh-context review, no implementer fan-out.

**Goal:** deliver the approved bounded local tester through discovery, minimized repro, regression RED/GREEN, gates, independent review and safe commit.
**Architecture:** Node 24 supervisor owns subprocesses/evidence/intake; Codex workers operate in private Git snapshots with snapshot-local workspace links. Native Vitest reports and unchanged gate implementation establish verification.
**Tech stack:** Node built-ins, installed Codex CLI, existing Vitest/gates; no added dependencies.
**Spec:** `docs/design/specs/2026-10-30-autonomous-tester-design.md` (approved by user “Ок”).

## Global constraints

30 min campaign wall limit; <=3 GiB tree RSS; one campaign and one heavy child at a time; nice10; workers never commit; no push/publish/deploy; protect all original dirty/staged paths; no changes to locks/gates/harness/baselines/compiler Rust through worker patches. Preserve launch configuration and the unrelated lane-harness draft. Commits use named paths and a temporary index.

## Review focus

- Snapshot workspace resolution executes patched snapshot libraries, not checkout code.
- RED requires discovered native assertion failure; setup errors/zero tests/forged reports cannot satisfy proof.
- Gates and reviewers cannot silently omit checks or change candidate bytes after verification.
- HEAD movement and staged/unstaged/untracked WIP cannot be lost at intake.
- Interrupts, timeouts, process failures and lock contention leave durable terminal evidence and no commit.

## Tasks

- [x] 1. Core contracts, areas, filesystem/snapshot isolation, subprocess budget and evidence validators. Tests first: path escapes, real snapshot import, actual assertion vs setup/zero tests, process timeout/lock ownership.
- [x] 2. Supervisor and Codex driver. Real temporary Git/Vitest fixtures with scripted agent boundary: seeded fix commits once, no-finding doesn't commit; all acceptance negatives block intake. Separate read-only reviewer; expected gate plan/report validation; source/evidence hashes and coverage history.
- [ ] 3. CLI, briefs/docs and actual provider smoke. Node24 types, full scripts suite/format, independent review and fixes. One live --no-commit campaign; report actual outcome, not scripted outcomes as AI discoveries. Commit named paths; clean owned scratch build trees after evidence capture.

## Ledger

- Base `4a86890df`. Design approval received; implementation authorized including default verified auto-commit. Existing unrelated WIP: `.claude/launch.json`, `docs/design/specs/2026-10-28-lane-harness-design.md`.
- Implementation occurs in shared checkout per repository no-worktree rule; harness-created snapshots are independent repositories, not git worktrees.

- Core/module tests first failed on missing supervisor APIs; first complete pipeline passed 27/27. CLI/budget/isolation additions passed 31/31 before the detached-server regression.
- Snapshot executable test exposed root `.bin` resolution despite snapshot package imports; now private workspace bins resolve to snapshot sources. Dangling-symlink intake test exposed existsSync following the missing target; lstat rejects it. Both verified RED before their fixes.
- Detached child server survived a deadline in the original executor (recorded RED); executor now tracks observed descendant process groups alongside tree RSS and terminates them on deadline/exit. Full suite verification follows.
- Intake uses explicit-parent commit-tree and compare-and-swap update-ref under the real index lock, with temporary candidate/next indexes. This implements the named-path/temporary-index contract while making concurrent HEAD changes atomic; unrelated index entries remain intact.

- First complete Node24 scripts project: 101/101 (14 files), 211.76 s; type/format pass.
- Final review found three actionable issues, all reproduced before fixes: staged-B/worktree-A cancellation hid WIP; candidate Nx/Vite configuration was editable; nested benchmark dependencies were absent. Added real supervisor/snapshot/policy cases, plus assume-unchanged byte protection and proof-file SHA-256 coverage.
- Fixes: union staged/unstaged/untracked paths; compare actual candidate bytes and index blobs to base; block project/nx/*.config.* inputs; mirror nested workspace dependencies with snapshot-local workspace packages/bins and copy Qwik packages per the existing zero-cost path rule; hash proof files in the terminal record.

- Final: fixed staged/working-tree cancellation and hidden-byte WIP protection — real supervisor tests `staged/working-tree cancellation cannot hide user-owned candidate changes` and `assume-unchanged cannot hide actual candidate bytes from intake protection` RED→GREEN.
- Final: fixed editable gate/build configuration — `gate and build configuration cannot be changed through an otherwise allowed area` RED→GREEN.
- Final: fixed nested dependency omission — `nested workspace dependencies preserve pinned tools and redirect Rivet peers to the snapshot` RED→GREEN; Qwik packages copied per existing scripts/CLAUDE path handling.
- Final proof receipt hash assertion also verified RED→GREEN. Focused harness 36/36; complete Node24 scripts project 105/105 in 14 files, 208.92 s. Node24 TypeScript and format gate pass; no library production source or byte baseline changes.
- Reviewer declined actual provider execution, future repair correctness and adversarial containment certification. Future repairs still require their own proof/gates/review; deliberately malicious test containment is explicitly outside this snapshot design. A real provider campaign follows the implementation commit and is recorded separately, without conflating scripted seed tests with AI discoveries.
