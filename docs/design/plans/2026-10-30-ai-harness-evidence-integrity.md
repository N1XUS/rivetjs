# AI tester evidence integrity and router campaign

> **For agentic workers:** Use superpowers:executing-plans task by task. Continue the approved autonomous tester design; this is maintenance of its proof and retained-patch contract.

**Goal:** Reject source drift throughout verification, retain a reviewable proposed patch before failures, then investigate another framework area with the live model.

**Architecture:** Keep the existing Node 24 supervisor, fixed snapshots, Codex worker/reviewer and atomic intake. Extend its existing raw-source check to named overlays; serialize patches from supervisor-owned Git objects before native execution. No new orchestrator, automatic baseline changes, provider fallback or retries.

**Spec:** `docs/design/specs/2026-10-30-autonomous-tester-design.md`.

## Constraints and review focus

- Preserve unrelated `.claude/launch.json` and lane-harness draft, use named-path temporary-index commits, never push.
- One heavy command at a time, nice10, Node24, Vitest maxWorkers=1, sampled tree limit3072MiB.
- RED must execute only the proposed tests over original production source; GREEN/gates/review must retain the exact candidate and every other original source blob.
- Git index flags cannot hide changed source. Existing/new named files and binary/executable patch round trips must work.
- A retained patch is a proposal, not a verified result. Failed proof/process/gates must never commit.
- Keep prior failed records unchanged and intentional baseline edits under human intake.

## Task 1 — source invariance and early evidence

Files: `scripts/ai-tester/workspace.ts`, `run.ts`, `scripts/tests/ai-tester-core.test.ts`, `ai-tester-run.test.ts`, nearest CLAUDE/README.

- [x] Reproduce hidden non-candidate source writes during RED, GREEN and review in disposable native Git/Vitest fixtures; assert no commit.
- [x] Reproduce missing `candidate.patch`/`paths.json` after early native proof and gate failure.
- [x] Generalize `assertSnapshotSource(root, base, overlays)` to compare all original raw blob bytes plus exact named overlay bytes/inventory. Apply after RED and throughout candidate verification.
- [x] Persist a binary Git patch from supervisor-owned blob/index data before tests, with original executable modes and exact source receipts. No candidate writes into the RED tree while preparing evidence.
- [x] Prove retained patch round trip (binary/new/executable/space-containing paths), then run maintained scripts/types/format, independent review, update docs and commit.

## Task 1b — native compiler memory headroom

Ruling: both the prior reactivity campaign and the new router campaign hit the same3072MiB cap during UI-docs typecheck. The native checker default2304MiB heap leaves insufficient room for compiler non-heap, Nx/Node wrappers and the supervisor. Keep the RSS limit and diagnostic checks unchanged; set a smaller inherited Go heap goal, not automatic retries or a larger cap.

- [x] Demonstrate the missing inherited native-heap budget at the real subprocess environment boundary, including a smaller caller budget and inherited `GOMEMLIMIT=off`.
- [x] Give Go at most60% of the tree budget (rounded down to64MiB, positive minimum); retain the existing process-tree monitor as authority because Go's heap limit is soft.
- [x] Re-run the identical failed UI-docs gate with the full wrapper chain under3072MiB, then verify maintained tests/types/format, independent review and commit. Do not relabel earlier failed campaigns.

## Task 1c — required consumer coverage

Ruling: `libs/router/CLAUDE.md` explicitly requires forms tests after handler changes, but the real36-gate router plan omitted them. Mechanically add that required consumer suite for `libs/router/server/handler.ts`; keep unrelated client-only changes scoped and avoid duplicate gates.

- [x] Native planner regression: handler selects forms, client-only does not, combined handler/forms edits select it once.
- [x] Implement only this stronger selection, verify maintained planner/full scripts checks, document and review with the resource policy before commit.

## Task 2 — live framework variation

- [x] Run bounded live `router` on explicitly authorized `gpt-6-astra`; focus on request lifecycle, serialization and navigation contracts beyond prior coverage.
- [x] If supported defect: minimize repro, native regression, smallest repair, independent proof/gates/review and commit. If none: preserve actual probes plus independently passing native baseline. Do not manufacture a finding.
- [x] Record true automatic/manual outcomes and any remaining limits, clean only owned inactive generated builds, commit evidence index.

## Ledger — 2026-10-31

- Initial fixture run had an escaping syntax error and was excluded from bug evidence. Corrected native fixtures then demonstrated three improper commits despite hidden non-candidate source mutation and two missing-patch failures. The binary retention case also failed before implementation; custom Git display preferences subsequently reproduced an inapplicable patch (`git apply`: no valid patches).
- Ruling: write the proposal from raw blobs in a fresh supervisor-owned validation repository/private index before native tests and the shared-checkout intake check. Preserve exact patch bytes and force canonical colors/prefixes/markers; disable external diff/textconv. Do not write production candidate data into the RED filesystem to serialize evidence. Existing core cases remain unchanged; all new end-to-end cases live in `ai-tester-run.test.ts`.
- Whole-source checks permit only explicit overlays: regression/fixtures during RED, complete named candidate during GREEN/gates/review. This checks source bytes, revision and inventory; it does not claim malicious-code/container isolation or new coverage of hidden mode-only changes.
- The worker brief now explains snapshot HEAD vs upstream source and provides the supervisor's Node path. Parent resource enforcement remains authoritative when sandbox process inspection is unavailable; no new permissions or retries.
- Verification: Node24.18.1,63/63 maintained harness cases; full scripts132/132 in15 files,242.46s, exit0, sampled peak3044687872B under3072MiB. Harness typecheck and changed-file format4/4 pass. Fresh read-only review found no important defects. Only the scripts/format gates are affected; no production library source, lock or accepted byte baseline changed. Durable evidence: `.artifacts/ai-tester/maintenance/2026-10-31-evidence-integrity/`.
- Live router d48c1980 independently confirmed cookie/cache policy RED/GREEN and retained its patch before the same UI-docs memory stop. The full-wrapper UI-docs gate then passed with1792MiB native heap goal, unchanged3072MiB RSS cap and all diagnostics (outer sampled3198468096B; typecheck1m43s). This is a recorded revalidation after a policy fix, not automatic retry or a guarantee that every future workload fits.
- Task1b/1c verification: native heap boundary case failed before implementation; forms-consumer planner case failed before selection repair. Focused core/planner30/30 and full scripts134/134 in15 files,257.83s, exit0, sampled3041689600B pass under the same cap. Independent resource/planner review found no important defects. No existing gates or thresholds were removed. Fresh whole-supervisor verification of the retained router candidate follows the commit.
- Follow-up evidence: whole-supervisor continuation60a0f11e onf47d393d5 again hit the unchanged cap during UI-docs (sampled3244163072B). Its independent RED/GREEN and early patch remain intact. Ruling: the isolated full-wrapper pass did not prove adequate headroom with the full supervisor resident. Two further RED checks demonstrated omitted supervisor residency in allocation and missing command-envelope traces. Reserve the measured parent RSS before the60% Go goal, record it separately from child output, and refuse already exhausted launches; do not increase the RSS limit or relabel failed records.
- Parent-reservation verification:65/65 harness cases, full scripts135/135 in15 files,239.68s, exit0, sampled3173793792B under3072MiB; harness types and read-only review pass. Evidence: `.artifacts/ai-tester/maintenance/2026-10-31-parent-reserve/`. Continue the retained router finding through explicit human-supervised validation; do not describe a scripted candidate replay as another AI discovery or a failed automatic campaign as successful.

- Final router intake: d74a648ec. Original live discovery independently reproduced cookie/cache RED/GREEN; all 38 checks were accounted for and read-only review accepted on 4d9dc80f2, then HEAD-move protection correctly refused intake. The fresh 2ddcf5114 integration preserved concurrent StreamingText docs/package baseline rows and completed 38 checks ({"pass":36,"known-red":1,"noise":1}), router 441 / forms 73 / docs 64 / UI-docs 11 / scripts 135, raw-source/hash checks and actual read-only Astra review before atomic intake. Original automatic/resource failures stay failed. Only measured server bundle baselines changed; final evidence and cleanup records live in the integration-2dd directory. Fully unattended intake remains unverified.
