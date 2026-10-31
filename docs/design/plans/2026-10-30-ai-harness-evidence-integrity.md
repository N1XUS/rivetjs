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

## Task 2 — live framework variation

- [ ] Run bounded live `router` on explicitly authorized `gpt-6-astra`; focus on request lifecycle, serialization and navigation contracts beyond prior coverage.
- [ ] If supported defect: minimize repro, native regression, smallest repair, independent proof/gates/review and commit. If none: preserve actual probes plus independently passing native baseline. Do not manufacture a finding.
- [ ] Record true automatic/manual outcomes and any remaining limits, clean only owned inactive generated builds, commit evidence index.

## Ledger — 2026-10-31

- Initial fixture run had an escaping syntax error and was excluded from bug evidence. Corrected native fixtures then demonstrated three improper commits despite hidden non-candidate source mutation and two missing-patch failures. The binary retention case also failed before implementation; custom Git display preferences subsequently reproduced an inapplicable patch (`git apply`: no valid patches).
- Ruling: write the proposal from raw blobs in a fresh supervisor-owned validation repository/private index before native tests and the shared-checkout intake check. Preserve exact patch bytes and force canonical colors/prefixes/markers; disable external diff/textconv. Do not write production candidate data into the RED filesystem to serialize evidence. Existing core cases remain unchanged; all new end-to-end cases live in `ai-tester-run.test.ts`.
- Whole-source checks permit only explicit overlays: regression/fixtures during RED, complete named candidate during GREEN/gates/review. This checks source bytes, revision and inventory; it does not claim malicious-code/container isolation or new coverage of hidden mode-only changes.
- The worker brief now explains snapshot HEAD vs upstream source and provides the supervisor's Node path. Parent resource enforcement remains authoritative when sandbox process inspection is unavailable; no new permissions or retries.
- Verification: Node24.18.1,63/63 maintained harness cases; full scripts132/132 in15 files,242.46s, exit0, sampled peak3044687872B under3072MiB. Harness typecheck and changed-file format4/4 pass. Fresh read-only review found no important defects. Only the scripts/format gates are affected; no production library source, lock or accepted byte baseline changed. Durable evidence: `.artifacts/ai-tester/maintenance/2026-10-31-evidence-integrity/`.
