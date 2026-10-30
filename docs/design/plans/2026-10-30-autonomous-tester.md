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
- [x] 3. CLI, briefs/docs and actual provider smoke. Node24 types, full scripts suite/format, independent review and fixes. Run real campaigns and report actual outcomes, not scripted outcomes as AI discoveries. Commit named paths; clean owned scratch build trees after evidence capture. The user's later instruction requested live discovery plus commit; the final repair used explicitly recorded human intake after automation stopped.

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

- First live CLI attempt `2026-10-30T17-23-15-300Z-e28f8328` stopped before inference: snapshot Git initialization rejected tracked `apps/resume-bench/results` files covered by ignore rules. Added `snapshot retains tracked files covered by current ignore rules`, observed RED; snapshot now force-adds only the exact committed ls-tree list. No provider request/AI discovery is claimed for that failed startup.
- Snapshot startup regression GREEN; Node24 full scripts 106/106 in 14 files (214.56 s), TypeScript and changed-file format checks pass. Failed pre-inference work tree removed after preserving its run/events/base inventory; provider retry follows this fix commit.

- Real retry `2026-10-30T17-30-47-967Z-c4dd6504` on `1f5632a2a`: snapshot startup and private workspace/Qwik resolution verified; actual Codex CLI inference failed with HTTP400 model_not_found for the inherited gpt-6.1-sol + ChatGPT login. Exit2, no source edits/commit, lock released, peak sampled 1,550,745,600 bytes. Evidence remains local; verification report committed separately. No model fallback/global configuration change performed.
- Implementation/types/full-suite/independent-review/commits are complete. Actual AI discovery acceptance remains pending a compatible CLI profile/model; a clarification was sent rather than silently selecting a different model. Task3 stays open for that dependent real-provider result.
- Follow-up: the user authorized a harness-only model override. Provider doctor and guidance-driven hardening continue in `2026-10-30-ai-harness-guidance-hardening.md`; current actual inference/campaign evidence is indexed in `../research/2026-10-30-autonomous-tester-verification.md`. The preceding model blocker describes the initial run, not the later provider-readiness result.
- Final outcome: live Astra discovered the sibling-draft snapshot mutation; framework repair committed1297536ef after independent RED/GREEN, complete56-check coverage and real read-only review. The retained automatic records remain failed (selector bug, then resource cap); human completion and the two intended byte-hash updates are explicit in the verification report. Full scripts125/125 and reactivity362/362 pass. Generated dist cleanup preserved source, probes and gate evidence. Fully unattended successful discovery-to-commit execution is not claimed.
