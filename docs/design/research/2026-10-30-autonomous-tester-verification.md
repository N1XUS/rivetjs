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

## Verified repair and human intake

Framework commit: **`1297536ef`**, `fix(reactivity): preserve snapshots when merging draft assignments`. Harness hardening: `95ce4ece8`; selected-test proof repair: `6c464ded4`. The actual AI-produced store source and regression test were retained byte-for-byte. Human edits only corrected the nearest test count and recorded/accepted the measured byte hashes.

Minimal supported counterexample (fails before the repair, passes afterward):

```ts
import assert from "node:assert/strict";
import { createStore, produce, write } from "@rivetjs/reactivity/store";
const left = { id: 1, nested: { n: 0 } };
const right = { id: 2, nested: { n: 0 } };
const previousNested = right.nested;
const state = createStore({ left, right });
write(state, produce(draft => { draft.left = draft.right; }));
assert.equal(right.nested, previousNested);
```

Structural merge now copies a container only when substituting a shared child instead of writing into a finalized subtree that may belong to the old snapshot. The permanent `libs/reactivity/tests/store.test.ts` regression covers ordinary/frozen rows, old sibling identity, target subtree sharing and absence of notifications to the untouched sibling.

Continuation `2026-10-30T20-58-38-595Z-f303d1a0`, source `6c464ded4`, replayed only the hashed result of the original live worker; it did not claim a second discovery. Fresh supervisor-controlled Node24 native proof independently failed the base and passed the same regression after repair (one executed test,21 unrelated filters). The automatic continuation then stopped during UI-docs typecheck at sampled3223633920B, just above the unchanged3072MiB cap. Its terminal record remains failed. Human completion ran the identical preparation/typecheck directly with `GOMEMLIMIT=2048MiB`, removing Nx/nested-supervisor overhead; exit0, sampled2875015168B, under the same cap. No diagnostic, assertion or memory threshold was relaxed.

All56 checks in the final baseline-inclusive plan were accounted for by their actual execution records: **55pass,1 accepted size noise** (`/slots` HTML Brotli6922→6923, within existing20B tolerance; not ratcheted). This includes32 project typechecks, all three documentation builds, **362/362 reactivity prod/dev tests**, **64/64 docs tests**, **11/11 UI-docs tests**, frames within ceilings, and **125/125 scripts tests in15 files** (198.62s; sampled3027238912B). Supervisor/final verification used Node24.18.1 on macOS arm64; the worker's standalone login-shell probes recorded Node26.5.1.

Only two measured zero-cost rows changed: `@rivetjs/reactivity/store`10339→10380 minified bytes (+41), hash `dc7b50e18fc7`→`f2d6ef020f15`; its `@rivetjs/runtime/server-derived-store` consumer42622→42664 (+42), hash `b50f2ba15ec7`→`c78712ce4a6d`. All other runtime entries, package hashes and SSR lanes remained unchanged. Full zero-cost was then rerun successfully: runtime/lanes identical, no dev leaks, conditional parity21/21 and compiler oracle176/176. No app-size/frame ceiling or dependency-lock update occurred.

A separate actual read-only `gpt-6-astra` invocation inspected the patch, original repro, native RED/GREEN, provenance and complete gate records. It completed inference with `accept`, findings=[], exit0, sampled1574502400B. Reviewed bytes/inventory were checked again before atomic named-path intake; both unrelated user WIP files were hashed before/after and stayed unchanged. Source/probes/gate logs were retained; four unused generated dist trees were removed afterward.

Evidence: `.artifacts/ai-tester/continuations/e356fac1-acceptance/` contains `provenance.md`, native reports, `gate-plan.json`, validated combined `gates.json` with individual report/log provenance, source hashes/patch, actual reviewer trace/result, resource records, `manual-intake.json` and `cleanup.json`. Earlier automatic failures were not relabeled passing. This establishes a real AI discovery and independently verified repair with explicit human intake; an unattended successful automatic discovery-to-commit campaign is still unverified. No broader security or cross-platform certification is claimed.

## Router error-layout repair and source integrity (2026-10-31)

Framework/gates commit: **d74a648ec**. Evidence hardening: d4448e475 (whole-source raw blob attestation and early exact binary/mode/whitespace patch retention), f47d393d5 (native heap headroom and required forms-consumer gate), 4d9dc80f2 (actual supervisor RSS reserve and per-command resource records). No existing assertion or resource threshold was relaxed. New native cases failed before each repair; final maintained scripts verification is recorded below.

One actual live gpt-6-astra router discovery, campaign 2026-10-31T09-34-43-735Z-d48c1980 on source d4448e475, found that error-document fallback layout loaders can set a cookie and public cache headers after the previous cookie-privacy finalization. A denied page returned 403 with Set-Cookie and public,s-maxage=600,max-age=60. The fix awaits the authorized fallback layouts before finalizing cookie privacy, yielding private,max-age=60. JSON errors still skip fallback loaders. The supported public-API [native regression](../../../libs/router/tests/error-layout-cache.test.ts) independently failed the base and passed the same assertion after repair. The four original AI-produced framework source/test/docs files were preserved byte-for-byte.

The worker built copied operations fixtures and reproduced the headers through the production Node adapter, with 24 concurrent synthetic identities, document/data isolation and serialization/kept-layout controls. It did not simulate a cross-user CDN leak. Its Chromium launch was sandbox-blocked; those probe logs explicitly make HTTP-only claims. The separate full router suite below includes actual production/browser checks. Fixture tenant/role policy is not a framework guarantee.

Original d48c1980 and retained-candidate continuation60a0f11e remain failed after their unchanged 3072 MiB RSS cap stops. The first manual acceptance on 4d9dc80f2 completed all 38 checks (37 pass, 1 size-noise) and actual read-only Astra review, but intake correctly refused the moved HEAD before writing any shared candidate byte or index entry: another chat had committed StreamingText as 2ddcf5114. Fresh integration exported that committed source, verified nine candidate paths had identical base blobs, appended only our docs lines and replaced only the router/server baseline row, preserving the concurrent UI package/CSS rows. Scripted retention is not another AI discovery.

Combined-source verification on 2ddcf5114: **38 checks**, statuses **{"pass":36,"known-red":1,"noise":1}**; router 441/441, forms 73/73, docs 64/64, UI-docs 11/11, all three production docs builds and complete zero-cost checks. Frames retain a native-confirmed pre-existing UI byte red: clean 2ddcf5114 without the candidate gives identical prompt-input-basic/chat-attachment-basic raw +1058 B and Brotli +401/+394 B ceilings. Those failed records and ceilings stay unchanged. Maintained scripts **135/135 in 15 files**, 230.34 s outer elapsed (229.28 s native); sampled peak 3030695936 B. Maximum accepted command RSS 3030695936 B, below 3072 MiB. Environment: Node 24.18.1 on macOS arm64; this is not Linux certification. UI-docs ran the exact committed preparation/native checker directly with all diagnostics, avoiding Nx wrapper residency. Forms/router use one Vitest worker after actual two-worker memory stops; both policies have native RED/GREEN coverage.

Size result: **noise**, 2 value(s) within ±20 B. Details and completed comparison output are retained with the report; accepted existing 20 B HTML noise is not ratcheted. Two full measurements reproduced all 28 serverJS pairs exactly: +8 minified bytes each, compressed changes −100…+104 B. Only these server fields and their generated Markdown changed in the size baseline; client/HTML/CSS/state/frame/other-lane ceilings stayed unchanged. Zero-cost changes only router/server 31456→31464 B (17201cb842f4→16fd8aacee51) and its SSR entry hash 0ee64754666c→5e3a3e6e2f0d; concurrent UI baseline rows were preserved.

A fresh actual read-only gpt-6-astra review accepted the integrated exact patch with no findings (exit 0, sampled 1486471168 B). Complete raw-source/inventory and reviewed-candidate hashes were checked again before atomic named-path intake; unrelated user WIP stayed unchanged. Local evidence: .artifacts/ai-tester/continuations/d48c1980-final/ and its integration-2dd/ subdirectory (provenance, native reports, complete gate plan/results, retained patches, actual reviewer traces, resource records, refused and successful intake records). Cleanup removes only listed owned inactive generated dist trees; source/probes/logs and original terminal records remain.

This proves a real AI discovery and independently verified repair with explicit controlled completion. A fully unattended discovery-to-commit campaign is still unverified; soft Go heap goals are not RSS guarantees or automatic-retry permission. No global provider settings, dependency locks, deployment, release or broader security certification changed.

## UI frame payload closure (2026-10-31)

Commit **2c36897ae** closes the pre-existing frame red recorded above. Adding character pacing to the shared CDK chat module had grown its common browser chunk from 6333 to 7391 raw bytes. Markdown and StreamingText now import the isolated `chat/text-reveal` module directly; the original chat API still re-exports the same functions/types. The pacing implementation body is byte-identical after relocation.

| Frame | Before raw → fixed | Before Brotli → fixed |
| --- | --- | --- |
| prompt-input-basic | 221271 → 220213 (−1058) | 73494 → 73093 (−401) |
| chat-attachment-basic | 178380 → 177322 (−1058) | 58909 → 58515 (−394) |

The complete strict frame gate passes with **no frame/size ceiling changes**. The permanent UI `chat-payload.test.ts` builds a composer entry alongside real StreamingText with strict entry signatures and gates its static JS closure at 2 KiB. Correct RED measured 10174 bytes; GREEN passes. The first fixture accidentally used application-entry export pruning and is excluded from evidence; `red-strict.log` is the genuine payload failure.

Verification on Node 24.18.1/macOS arm64: full native CDK **3258 pass, 2 skip**, cdk-dev **43/43**, UI **1444/1444**, docs **64/64**, UI-docs **11/11**; **eight impacted production/browser cases**, all eight affected typechecks, three production docs builds, content/snippet/LLM/MCP checks and formatting. Full unrelated CDK/browser/component and UI/component matrices were outside this scoped check; the production cases cover StreamingText/Markdown, AI chat and prompt queue reorder. Existing baseline utilities also pass 9/9. Independent read-only source/data review found no important defects.

Only six measured UI own-code DOM/server hash rows changed: root barrel/Markdown +43 bytes and StreamingText +12 bytes due to the external import specifiers. All CSS hashes/bytes, other package entries and runtime/lane baselines remain unchanged. The complete zero-cost recheck passes: no dev leaks (265 entries), condition parity 21/21 and compiler corpus 176/176. Full size comparison reports only two existing HTML values within the unchanged 20 B noise allowance. Regenerated API JSON changes only eight source line/URL pairs. Historical failed campaign/control records are preserved rather than relabeled passing.

Local evidence: `.artifacts/streaming-text-payload/` retains RED/GREEN, strict frame measurements, behavior/gate logs and resource records, implementation equivalence hash, bounded six-row producer/delta and commit metadata. This is a user-requested fix of the separately reproduced UI regression, not another claimed AI discovery or unattended harness success.

## Live resume campaign: abort releases pending Async owners (2026-10-31)

Framework/regression/baselines commit: **77e52d01d**. A fresh actual `gpt-6-astra` campaign, `2026-10-31T15-44-42-087Z-f78726f6`, investigated resume on source `4bfc04ed1`. Its real provider doctor `2026-10-31T15-43-36-642Z-17d6e316` completed inference. The model override was invocation-local; no global model/auth settings changed.

The worker found that aborting public `renderResumable` after an `Async` fallback had been emitted left its render promise pending and retained its detached owner until the loader settled. A never-settling loader therefore prevented cleanup indefinitely. This is a supported cancellation defect, distinct from the documented browser adoption limitation. The fix subscribes the segment wait to the request's abort event, wakes the existing abort check, and removes the listener in the existing release path. It adds 94 minified server bytes; no browser implementation changes.

The [permanent minimal regression](../../../libs/runtime/tests/derived-stream-abort.test.ts) keeps the loader explicitly gated, aborts after the fallback, and asserts render settlement plus exactly one cleanup before resolving that loader. It then verifies late resolution produces no children or extra chunks and does not dispose twice. Native independent RED executed one failing assertion on the base (`settled: false, cleanup: 0`); identical GREEN executed one passing test after repair (`settled: true, cleanup: 1`). No sleep, type escape, compiler ABI or weakened assertion is involved. The four AI-produced source/test/owner-doc files were retained byte-for-byte.

Additional worker evidence includes minified production SSR before/after behavior and production Chromium controls with either runtime or component chunks delayed: cold input, focus and keyed DOM identity survive reorder; removing the edited row runs cleanup once. An initial sandbox Chromium launch failed; the separate authorized local launch completed both controls. Sixty focused runtime tests also passed. These are local probes, not a broad memory-leak or security certification.

The automatic campaign completed all 54 original gates in 19m43s; the supervisor UI-docs typecheck now completed under the unchanged 3072 MiB cap. Overall sampled peak was 3131047936 B. Its terminal status remains **failed**, `gates exited 1`, because the server-only hash/size pins intentionally changed. Its original proofs and terminal record are preserved; no automatic reviewer or commit is claimed for that failed run.

Root completion verified the full raw source inventory, independently rechecked original RED/GREEN, repeated the entire size measurement before accepting growth, and ran the complete maintained scripts suite plus final zero-cost/size/format gates. The final baseline-inclusive plan accounts for **55 checks: 52 pass, 2 known-red, 1 accepted size noise**. This includes all 31 project typechecks, three docs builds, docs **64/64**, UI-docs **11/11**, scripts **135/135 in 15 files**, strict unchanged frame ceilings, content/snippet/LLM/MCP checks and formatting. Runtime and runtime-dev each have **740 pass and one existing registered click-defer first-click timing failure**. That timing threshold, test, registry and client code were not changed or hidden. Final size noise is HTML Brotli +1/+3 B within the existing 20 B allowance, without ratcheting those values. The final scripts process peaked at 3028647936 B. Environment: Node 24.18.1, macOS arm64; no Linux certification is implied.

Only four runtime zero-cost rows changed: server-resume 59515→59609 B, its domData variant 65410→65504 B, server-derived 81042→81136 B, and its domData variant 86942→87036 B. The one consuming router SSR entry hash changed from `5e3a3e6e2f0d` to `83435ab7e945`. Two complete size runs reproduced every serverJS minified/Brotli pair for 28 apps exactly: +94 minified bytes each, compressed deltas −66…+131 B. Only these serverJS fields and the Markdown generated by the committed renderer were updated. All client/HTML/CSS/state/frame/other-lane limits and package hashes remain unchanged. Full zero-cost recheck completed with no dev leaks (265 entries), condition parity 21/21 and oracle 176/176.

A separate actual read-only `gpt-6-astra` review accepted the exact nine-path candidate with no findings (exit 0, sampled 1493647360 B). Whole-source attestation and reviewed hashes were rechecked before atomic named-path intake. Both unrelated user WIP hashes stayed unchanged. This is a live AI discovery followed by independently verified manual completion; fully unattended discovery-to-commit success remains unverified.

Local evidence: `.artifacts/ai-tester/continuations/f78726f6-acceptance/` retains provenance, original proof copies, the exact candidate patch/hashes, native reports, original 54 and complete 55-check plans/results, the repeated size/zero-cost deltas, real reviewer trace/result, resource records and atomic intake metadata. The original campaign directory remains intact. No dependency lock, global provider setting, push, release or deployment changed.

## Live reactivity campaign: embedded drafts in a read new container (2026-10-31)

Framework/regression/pins commit: **bd24e7899**. Actual live `gpt-6-astra` campaign `2026-10-31T16-54-17-382Z-8b6b7feb` investigated source `a9a18b905`. Fresh doctor `2026-10-31T16-54-00-732Z-9c75bc74` completed inference with that invocation-local model. No global provider changes or scripted discovery replay occurred.

The worker found a supported typed `produce` defect:

```ts
write(store, produce(draft => {
  draft.target = { nested: draft.source };
  void draft.target;
}));
```

Reading the new container creates a cached child draft. Its unmodified result still contains the embedded `draft.source`, but finalization previously skipped that written value after processing the cached child. The saved state therefore held a revoked Proxy instead of readable data. Finalization now processes every written value before structural merge; the implementation changes one logic line and adds an explanatory comment.

The [maintained regression](../../../libs/reactivity/tests/store.test.ts) pins the precise trigger, finalized nested identity and reads, unchanged source identity and previous-snapshot immutability. Independent native RED executed one failing behavioral assertion, with 22 unrelated filtered records; identical GREEN executed one passing assertion. The final test uses a boolean identity comparison so the reporter does not inspect a revoked Proxy. Earlier worker reporter-obscured RED and an ambient-type setup failure remain in its journal and are excluded from accepted evidence. The three original AI source/test/owner-doc files were retained byte-for-byte.

The worker's baseline passed 362 tests. Full independent affected suites passed **182/182 production and 182/182 development**, including the new regression in both modes. Supplemental executed probes cover 800 typed reference-model operations (store updates, views, reconcile, batch/computed diamonds, deletion/recreation, snapshot checks and owner disposal), and eight object/array wrapper combinations with new/existing targets, varied reads, edited source and frozen snapshot inputs. Strict library and probe typechecks passed. No browser result is inferred from these Node tests.

The original automatic campaign remains **failed**, `memory-limit`: sampled 3221864448 B while running UI-docs typecheck, slightly above the unchanged 3072 MiB cap. It retained the proposal and independent RED/GREEN before that stop. Trusted-root completion checked the exact raw source inventory, then ran the identical committed UI-docs preparation and native checker without Nx wrapper residency: exit 0, sampled **2898935808 B**, 93.58 s for the checker. All diagnostics and the committed single-checker argument were preserved. Every other 54 affected gates was rerun, with actual outer peak **3064610816 B**, no resource stop. This demonstrates a completed direct check, not a general guarantee that every Nx-wrapped run fits the cap.

Final baseline-inclusive evidence accounts for **56 checks: 55 pass, 1 accepted size noise**. It includes all **32 project typechecks**, three production documentation builds, docs **64/64**, UI-docs **11/11**, maintained scripts **135/135 in 15 files**, strict frame ceilings, complete content/snippet/LLM/MCP checks, zero-cost and format. The direct UI-docs command and each final report override have explicit provenance; there is no missing or invented gate. Existing HTML Brotli noise (+2/+4 B) stays within the unchanged 20 B tolerance and was not ratcheted. No known-red exception is needed in this completed plan.

Only two measured runtime pins changed, each **−24 minified bytes**: `@rivetjs/reactivity/store` 10380→10356 B (`f2d6ef020f15`→`a3dfdbe62868`), and `@rivetjs/runtime/server-derived-store` 42664→42640 B (`c78712ce4a6d`→`5e9f3d0f3515`). Package/lane hashes and every app/frame size baseline remain unchanged. Strict zero-cost recheck completed: runtime/lanes identical, no development leaks across 265 entries, condition parity 21/21 and compiler oracle 176/176. Tests, skips, diagnostics, timeouts, resource caps and comparison tolerances were not weakened.

A fresh actual read-only `gpt-6-astra` review accepted the exact five-path candidate with no findings (exit 0, sampled 1437007872 B). Full raw-source and reviewed-candidate hashes, main HEAD and unrelated WIP bytes were rechecked before atomic named-path intake. The final scripts process peaked at 2984820736 B. Environment: Node 24.18.1 on macOS arm64; this does not establish Linux or browser parity.

Evidence remains local in `.artifacts/ai-tester/continuations/8b6b7feb-acceptance/`: provenance, original proof copies, actual 54-gate report plus direct UI-docs results, complete 56-check plan/result, native scripts JSON, exact patches/hashes, measured two-row baseline delta, strict final recheck, actual reviewer trace and atomic intake metadata. Original campaign records remain untouched. This is a live discovery and independently verified repair with explicit manual completion; unattended automatic discovery-to-commit success remains unverified. No dependency lock, global provider setting, push, release or deployment changed.
