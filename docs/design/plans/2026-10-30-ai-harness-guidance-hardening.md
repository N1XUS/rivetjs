# Autonomous tester: guidance-driven hardening

Continue the approved autonomous-tester design, at HEAD4e59c8052. User requested continuation using OpenAI/Anthropic guidance and previously authorized local commits. Preserve unrelated launch config and lane-harness draft; no global agent configuration or silent model/provider changes.

## Decisions

Keep the existing deterministic supervisor and installed Codex CLI. Guidance is input to concrete fixes, not an excuse for a second orchestrator, extra provider dependency or an unlimited agent loop. Existing snapshot/independent RED-GREEN/gate/review/atomic intake stays authoritative.

- Official OpenAI harness engineering: repository-local knowledge, concise navigation and mechanical enforcement; use traces/real execution rather than completion prose.
- Official Anthropic long-running harnesses: bounded incremental work, durable progress and actual executed tests; preserve requirements instead of silently marking skipped coverage passing.
- OpenAI non-interactive CLI/MCP guidance: explicit sandbox/schema, inherited auth, least required tools and per-invocation settings.

## Tasks

- [x] Close confirmed false no-finding acceptance (skipped/todo-only Vitest success). Preserve legitimate mixed pass/skip suites; validate actual executed assertions and summary consistency. Add native negative fixtures and deterministic tests before repair.
- [x] Enforce configuration protection for nested Git/npm configuration and recheck no-finding snapshot revision/source after its baseline. Reproduce each gap; retain no-commit/WIP guarantees.
- [x] Add bounded provider doctor with actual read-only structured inference and actionable failure classification. Preserve configured model/auth; no cached-list readiness claim, no global edits. Verify unwanted integrations are disabled by per-process flags where the installed CLI supports that.
- [x] Record guidance-to-enforcement matrix, live vs scripted evidence and limitations; run Node24/type/scripts gates, independent review and safe named-path commit. Attempt a real bounded campaign if provider readiness succeeds.

## Verification focus

All-skipped/all-todo cannot mean no-finding; fabricated summary counts cannot stand in for actual assertions; baseline cannot alter its own source revision; nested config cannot alter gate behavior; unsupported-model/auth/network/process faults cannot become ready/no-finding. Do not claim malicious-code isolation: third-party dependencies and unobserved fast detached children remain the explicit v1 process/snapshot boundaries.

## Evidence

- Initial probe used an unnecessarily low1024MiB cap and hit it during inherited MCP startup (1082MiB). It did NOT establish current inference availability. Retry within repository3GiB limit, with irrelevant tools excluded; do not label this an unsupported-model result.
- Independent read-only audit reproduced skipped/todo-only false no-finding. Existing seeded intake tests already implement real RED/GREEN and independent review; retain them.
- User explicitly authorized selecting a compatible model for the harness only. Actual configured-model inference returned model_not_found; `gpt-6-astra` completed inference. The shipped `doctor --model gpt-6-astra` then returned ready on Node24, CLI0.153.4, exit0, sampled peak1033994240B. Six discovered MCP integrations disabled per invocation; global configuration unchanged.
- Final hardening verification:123/123 scripts tests,15 files,210.45s, exit0; sampled peak3023437824B under3072MiB. TypeScript passes. The slow-inspection regression failed behaviorally before passing the shared campaign deadline into CLI inspection. Fresh independent review found no important defects; final delta reviewed separately. Actual campaign follows the hardening commit so its source revision is reproducible.
- Live campaign e356fac1 on95ce4ece8 completed actual Astra inference and found a supported `produce` snapshot-immutability defect. Independent native RED executed; supervisor then failed on incorrectly counting Vitest's21 filtered skips against the single executed regression. Original failure retained, no intake. Two maintained RED regressions drove the selector repair;44/44 core/run tests and typecheck pass, independent review clean. Continue verification using the retained hashed AI candidate, then review/gates/intake; replay is not a new discovery.
- Completed: harness hardening95ce4ece8, native-selector repair6c464ded4, framework fix1297536ef. Retained candidate received fresh independent RED/GREEN. Automated continuation f303d1a0 hit the3GiB cap during UI-docs typecheck and remains failed; equivalent direct preparation/typecheck passed with a lower Go heap under the same cap. All56 checks completed across recorded segments:55pass plus +1B `/slots` HTML size noise, not ratcheted. Final scripts125/125, reactivity362/362, docs64/64, UI-docs11/11; full zero-cost/oracle pass after exactly two measured store-related hash updates. Actual read-only Astra review accepted; atomic named-path human intake committed the verified files and preserved both unrelated WIP paths. Four owned generated dist trees removed, source/probes/gate logs retained. This is a verified live AI discovery with human intake, not a claim of an unattended successful automatic campaign.
