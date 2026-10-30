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

The initial implementation preserved the configured model/authentication without silently migrating models, changing global Codex configuration, consuming a usage reset or retrying indefinitely. At that stage live end-to-end AI discovery/repair remained unverified pending a compatible CLI profile/model. The user was asked about an explicit model override and subsequently authorized it; the follow-up evidence is below. This provider/configuration blocker was separate from the passing deterministic supervisor tests.

## Remaining acceptance at initial implementation

A real provider campaign must complete inference and then either return supported executed no-finding evidence plus a passing native baseline, or complete minimized repro, independent RED/GREEN, unchanged affected gates and read-only review. Only then can live discovery/repair be claimed. Existing tests verify that model/process/setup failures cannot become green or committed outcomes.

## Guidance-driven hardening and model authorization

The user subsequently authorized a compatible model override only for the harness. `--model` is explicit, validated and passed to worker/reviewer/doctor; omitted overrides still inherit the CLI model. No global configuration, authentication or provider fallback was changed. Current official [Codex model guidance](https://learn.chatgpt.com/docs/models) lists `gpt-6-astra`; actual completed inference established its availability for this account. Catalog metadata alone was not accepted.

The new bounded readiness command completed on Node24.18.1 with CLI0.153.4:

```sh
node scripts/ai-tester/cli.ts doctor --model gpt-6-astra
```

Record: `.artifacts/ai-tester/diagnostics/2026-10-30T20-26-13-011Z-b2b0709a/doctor.json`; status ready, exit0, sampled process-tree peak1033994240B, about10 seconds. This proves one provider turn, not framework correctness or AI bug discovery. A prior configured-model request returned HTTP400 model_not_found; the first1024MiB probe instead stopped for memory and is not classified as model rejection.

### Guidance mapped to executable checks

| Official guidance | Rivet implementation and evidence |
| --- | --- |
| [OpenAI harness engineering](https://openai.com/index/harness-engineering/): repository knowledge and mechanical feedback | Existing bounded area briefs, nearest CLAUDE navigation, source revision/coverage journal and supervisor-owned native RED/GREEN/gates remain authoritative. New actual-assertion and source-blob checks prevent false no-finding acceptance. |
| [Anthropic effective harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents): incremental progress and executed verification | One candidate per campaign, retained repro/logs and explicit terminal outcomes. Native skipped-only/todo-only fixtures were observed falsely accepted before the fix; now rejected. Legitimate mixed passing suites remain accepted. |
| [Anthropic long-running app harness design](https://www.anthropic.com/research/harness-design-long-running-apps): separate generation and evaluation; retain components that enforce useful checks | Independent supervisor validation and read-only reviewer retained. No extra planner/provider framework added. Evidence distinguishes scripted supervisor tests, actual provider readiness and live campaign results. |
| [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode): explicit sandbox and structured output | Ephemeral CLI invocation, role sandbox, strict JSON schema and result validation. Doctor requires exit0, exact readiness result and completed turn within60s/3072MiB. Authentication/network/model/resource failures cannot become ready. |
| [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp) and [per-invocation configuration](https://learn.chatgpt.com/docs/config-file/config-advanced) | Private CLI metadata inspection extracts only server names/version. Each discovered MCP integration is explicitly disabled and the effective list rechecked; apps/plugins/multi-agent are disabled. A bare empty MCP map did not clear inherited servers in the actual CLI, so it is not used as isolation. Raw metadata can contain credentials and is never logged. |

Additional confirmed gaps: nested Git/npm/environment/agent configuration could pass the old source allowlist, and no-finding baseline code could change its own Git HEAD or hide source changes behind assume-unchanged flags. Native regressions were observed RED before repairs. No-finding now requires original snapshot revision/inventory and matching raw Git blob bytes after actual passing assertions. These checks enforce the existing contract; they do not turn the snapshot into a malicious-code container. Shared dependency convention and cleanup limited to observed process groups remain explicit v1 boundaries.

Hardening verification: Node24.18.1, **123/123 tests in15 files**, full maintained `scripts` project, exit0, 210.45s. Supervisor sampled peak3023437824B (below3072MiB); TypeScript passes. The campaign-inspection deadline regression first failed after5.54s with a100ms wall budget; inspection now receives the campaign's shared deadline and the regression passes. Explicit model propagation is verified through both worker and reviewer. Fresh independent read-only review found no important defects, including the final deadline/model delta. No production framework source, dependency lock or byte baseline changed.

## First live Astra reactivity campaign

User explicitly requested live `reactivity` on `gpt-6-astra`, with repro/regression/fix/commit for a confirmed bug. Run `2026-10-30T20-45-39-900Z-e356fac1`, source `95ce4ece8`, completed real worker inference in about6.5 minutes; sampled supervisor/process-tree peak1756495872B. The candidate assigns `draft.left = draft.right` between rows with different IDs but equal nested values. Structural merge overwrites `right.nested` in the old snapshot, violating its immutability; frozen rows also fail. The worker retained a minimal typed repro, one regression in the existing store suite, a copy-on-write merge repair and nearest documentation. Its own logs report362 prod/dev tests, typecheck and5760 generated typed operations; supervisor acceptance is separate.

The supervisor independently executed the base regression under Node24 and obtained the recorded behavioral AssertionError. It then stopped with **failed**, exit2, `Regression must discover and execute exactly one test`: native Vitest reported22 collected records, one executed failure and21 unrelated filtered skips. No intake or commit occurred. This was a harness integration bug, not a provider refusal or invalid framework counterexample. The original run/status/hashes remain unchanged.

Two maintained regressions reproduced this selector defect before its repair. Proof validation now checks exactly one matching executed assertion and consistent native totals while allowing unrelated filtered skips/todos. Selected skips, multiple executed tests, mismatched identity and setup/import failures remain rejected. All44 core/run tests and the harness typecheck pass; fresh read-only review found no important defects. Continued verification of the retained AI candidate must preserve this provenance rather than call replay a second AI discovery.
