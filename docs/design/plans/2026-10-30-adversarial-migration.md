# Retire the temporary adversarial lab

**Goal:** retain useful integration coverage in normal maintained suites, preserve immutable reports/source evidence, remove `adversarial-lab/`, and commit the migration. The user explicitly authorizes removal after migration/archive verification.

**Architecture:** keep framework regressions already in reactivity/router/runtime suites; move the synthetic operations app and supported end-to-end/business cases into `examples/operations`, discovered by the existing examples Vitest/CI glob. Each production suite owns a copied build, fresh SQLite database and ephemeral loopback server; no CWD/global port sharing. Archive historical sources/tests/results without changing red assertions.

## Tasks

- [x] Inventory old suites and map each class to maintained coverage, already-covered regression or immutable historical probe. Do not turn documented limits, type escapes or competitor controls into new green Rivet claims.
- [x] Create maintained operations fixture and native Vitest HTTP/browser/stress cases; remove unsupported store probes and redundant historical routes. Shared helper owns child server, sockets, logs and teardown.
- [x] Migrate application business/security cases and browser journeys with original assertions, independent fresh databases, and native test failures.
- [x] Create a durable compressed archive plus per-file hashes and suite inventory; verify exact extracted bytes before deleting the old folder.
- [x] Run maintained suites/types/format and relevant checks; investigate any red instead of skipping it. Verify original journey autosave red explicitly.
- [x] Update current instructions/links and historical relocation notes, remove the lab, review final diff and commit through a temporary index. Preserve unrelated launch config and lane-harness work.

## Review focus

No swallowed assertions; setup failures cannot count as passes; application policy versus framework guarantees; session/socket/stream cleanup; stale versions preserve text; two-tab isolation; archive completeness; source-relative references after relocation; no undeclared dependency on the deleted directory.

## Ledger

- Starting HEAD `f64eb1c39`. User WIP: `.claude/launch.json`, root CLAUDE lab note, untracked lab and lane-harness spec. Root lab note is now authorized for replacement; unrelated launch/spec work stays untouched.
- Existing maintained tests cover produce truncation, live page accessors/native-link draft retention, authentication request order, CSR/SSR escaping and package boundary checks. Historical unsupported array paths, sparse-array competitor controls and Async/guard design-limit expectations remain archive evidence.
- Current lab results: business20/security71/stress4 green; journeys31 includes an autosave red. Preserve that supported expectation in the maintained suite and investigate before removal.

## Verification ledger

- Operations suites on Node 26: 145/145; complete examples project: 170/170 (10 files).
- After deleting the old directory, fresh Node 24.18.1 builds and all operations suites: 145/145 (6 files). No maintained case depends on the deleted tree.
- Selected router/reactivity replacement regressions: 65/65 (5 files), including two explicit layout-guard loader/endpoint cases. The latter close a gap that onRequest-only coverage did not prove.
- Example check (route sync, Rivet diagnostics, TypeScript), router TypeScript, scoped Prettier and changed-file format gate pass; 3920 tracked/staged TSX files belong to JSX projects. All 36 local Markdown links in the owned documents resolve (code samples excluded).
- Archive SHA/member bytes and complete non-generated source inventory verified before removal; reviewer independently verified all 202 files and 379 historical assertion records. No original assertion/result bytes were rewritten.
- Final fresh-context review: clean. Table formatting corrected during the docs sweep. Reviewer did not rerun heavy suites or certify production security/historical conclusions; root verification above supplies the runtime/type evidence. Fixture-policy and historical-report limits remain documented.
- Authorized lab removal completed after migration/archive verification. Only named migration paths are committed through the temporary index; launch config and lane-harness spec remain untouched. No runtime byte/baseline changes intended.
