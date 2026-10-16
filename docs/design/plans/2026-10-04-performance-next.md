# Further runtime performance optimisation

> **For agentic workers:** use the verification and test-driven-development skills. Execute measured experiments in this worktree; coordinate benchmark time centrally.

**Goal:** outperform all framework lanes in the repository's SSR and client benchmarks without changing their workload or weakening correctness.

**Architecture:** retain the public APIs and generated-output semantics. Remove general-purpose hot-path work only after identifying it in current code and measuring it against the unchanged baseline. Evaluate server writing/traversal, DOM construction/reactivity, and resume scheduling separately.

**Tech stack:** Node 24, TypeScript, Rust/Wasm compiler, production browser bundles, Playwright Chromium, Docker SSR harness.

**Spec:** the user's request in this chat: latest code/results, a worktree under `.claude/worktrees`, broad experimentation, and no breakage.

## Constraints

- Base: 5217d1d. Worktree: `.claude/worktrees/codex-perf-next`, branch `codex/perf-next`.
- Leave main checkout changes untouched; no shared-branch merge or publication.
- Preserve escaping, ownership, context, reactive ordering, cancellation, and backpressure.
- Keep every framework's benchmark workload and correctness validation intact.
- No concurrent builds/tests during measured performance intervals.
- Keep raw evidence and report losses as well as wins; an unresolved comparison is not a win.

## Review focus

- Scalar/object DOM transitions and cleanup after a failed read.
- Dynamic dependencies, equal computed values, reentrant writes and disposal.
- UTF-8 boundary handling and delayed stream acknowledgements.
- Lazy load rejection, retries, overlapping events, and disposed resume scopes.
- Bundle growth, import ownership and stale build manifests.

## Work

- [x] Establish latest SSR results and fresh current-code client baselines; run baseline tests.
- [x] Inspect independent server, DOM/reactivity, and loading hot paths; select measured candidates.
- [x] Pin affected behavior with regression checks; assess each candidate independently.
- [x] Run all affected production/development tests, typechecks, compiler parity and browser behavior checks.
- [x] Repeat comparison harnesses, preserve raw measurements, and document exact remaining gaps.
- [x] Obtain independent code/data reviews and fix significant findings.
- [x] Close the final empty-boundary cloning experiment and recheck the final retained source.

## Evidence / decisions

The app checkout (742d2ec) predates extensive changes; the worktree uses main's latest committed 5217d1d. Today's retained SSR run is 20261004T110550.980833Z-eae180bd. Main's uncommitted docs example and playground edits were excluded. The user explicitly authorizes experimentation and implementation, so no further design approval is needed.


## Measured progress

- Baseline complete workspace tests: all 17 projects passed (22 tasks with dependencies).
- Unchanged 5,000-row DOM harness, median of three fresh contexts: baseline mount 688.8 ms, full update 66.1 ms, retained heap 137.40 MiB; round 3 mount 439.0 ms, update 44.5 ms, heap 113.74 MiB. Solid remained faster (84.9 / 22.2 ms), so the all-framework goal remains unmet.
- Selected hybrid integer encoding after 96 balanced full-render trials: 5,000-row CPU 1.83935 → 1.55413 ms/page versus the old encoder with identical admission fixes. This is an accepting-sink diagnostic, not HTTP performance. Native-only encoding was rejected after complete-page regression despite its wide-integer microbenchmark win.
- Independent review caught and fixed shadowable generated `undefined` and custom-element clone reactions that invalidated cached paths. Both reproduced with failing tests before fixes.
- Compiler parity: 227/227 corpus cases. Intentional generated ABI deltas were checked by reverting only new event arguments and bindText names before accepting snapshots.
- Extra lazy scoped-read and adopted-token candidates are under measurement; retain only supported gains. Raw evidence is under `.artifacts/perf-next/`.


## Added user scope

- Add current published Solid and Qwik releases. Registry verification found existing previews are current (Solid 2.0.0-rc.13, Qwik 2.0.0-rc.0); add separate stable Solid 1.9.15 and Qwik 1.20.1 lanes without replacing those previews. An isolated `apps/bench-stable` workspace supplies compatible pinned toolchains.
- Investigate HTTP/2 as a separate transport experiment. Backend gRPC already uses HTTP/2. Compare identical TLS edges for HTTP/1.1 and HTTP/2 on the actual resume page, with unchanged bytes/cache/compression/network profiles. Do not attribute transport differences to framework rendering or already-loaded DOM timers.
- Reject lazy scoped-context reuse: round 4 tied prior timings and increased retained heap by about 1 MiB at 5,000 rows. Keep its nested rollback regression.
- Internal binding-effect retention candidate: public effects remain unchanged; only inert internal DOM binding owners may be released. Explicit owner and computed-getter escapes preserve ancestor lifetime, and debug/development retains full binding ownership. Round 5 medians at 5,000 rows: 417.7 ms mount, 45.1 ms full update, 82.22 MiB retained heap (baseline 688.8 / 66.1 / 137.40). Bundle gzip grows from 6,119 to 6,828 bytes. Solid 2 remains faster (82.9 / 21.6 ms).


## Final validation and follow-on experiment

- Full workspace test revalidation passed all 22 tasks; all 18 typecheck projects and 7 build projects passed. Compiler parity remains 227/227; intentional output hashes reproduce.
- One earlier full-suite run failed the unchanged router head-export HMR state-retention assertion. The isolated case and three traced current / three traced baseline runs passed, followed by the full-suite pass. The failure is retained as an unexplained intermittent observation; no speculative runtime fix or weakened assertion was applied.
- Four-lane DOM comparison includes Solid 1.9.15: at 5,000 rows, Rivet 439.2 ms mount / 41.8 ms update / 82.22 MiB heap; Solid stable 78.1 / 25.3 / 31.15, Solid preview 82.0 / 20.8 / 37.44, React 175.5 / 99.0 / 84.18. Rivet gzip is 6,828 bytes versus stable Solid 5,402. The all-framework objective is still unmet.
- Follow-on complete-template cloning retains every boundary marker, custom-element fallback and owner. Focused production/development tests and independent review pass. A 1,000-row screen improved Rivet mount median 80.1 to 76.1 ms for 51 more gzip bytes; 5,000-row validation passed: 407.2 ms median mount, 43.2 ms full update, 82.23 MiB heap; bundle 6,879 gzip bytes.
- Permanent transport experiment: apps/resume-bench/http2.mjs and HTTP2.md. Both H1/H2 load/click correctness checks pass. Twenty load timings (five alternating pairs per condition) passed with identical 28,520 body bytes; fast FCP 32/32 ms and Slow4G 208/204 ms provide no clear transport speedup.
- Jinja and Symfony/Twig lanes were considered and dropped: template-only engines, and Razor already covers server templating.


## Completed comparison evidence

- Stable Solid 1.9.15 and Qwik 1.20.1 are compared alongside existing previews. Six-lane HTTP SSR validated 98,647 responses with no failures; Rivet leads measured throughput at all three sizes. An additional same-Page Solid 1 buffered control validated 73,112 responses and materially narrows the 100-row difference (Rivet 1,945 vs Solid 1,810 responses/s).
- Final HTTP results do not establish a Rivet before/after win: baseline/current 5k throughput is 70.58/70.61 responses/s, CPU 6.38/6.80 ms/response, with different warmup and visible variation. Isolated matched binding-source audit found no detectable SSR CPU penalty.
- Resumability completed 36 baseline and 180 current five-lane cases without browser errors. Slow4G Rivet click/filter/navigation medians are 6.2/22.0/21.5 ms; Solid 1 is 3.8/11.2/184.2. Rivet prefetches its route; Solid 1 ships less initial JS. Rivet combined document + external JS transfer changed 30,226 to 30,298 encoded bytes. No broad before/after loading latency win is claimed.
- Accurate environment distinction: DOM and HTTP2 use Chromium 153.0.8010.12; resumability uses Chrome 154.0.8037.97. DOM baseline updates have three samples per trial; current runs have five. All have three repeated contexts and three warmups per update size.
- Rejected shared cursor slot traversal: all correctness checks passed, but 1k mount was 83.3 ms versus 79.9 ms for a fresh restored control, with +228 gzip bytes. Original resolver restored exactly; characterization tests retained.
- Reviewable results and provenance: docs/benchmarks/performance-next-comparison.md and docs/benchmarks/performance-next-comparison-summary.json. Goal of beating every client framework remains unmet; Solid's DOM mount, full update and heap remain ahead.

- Rejected cached empty-boundary clone after no demonstrated gain in its screen (89.9 ms at1k, controls also slower; +30 gzip bytes). Restored exact whole-template-clone runtime and retained new movement/identity/failure tests. Final restored-source validation passed: 23 focused tests, runtime typecheck, rebuilt identical 6,879-byte gzip DOM bundle, runtime/lane fingerprints and 227/227 compiler cases. Every retained DOM build input and all five resumability manifests match the final source/assets.
