# Harness memory verification — 2026-11-01

RAM maintenance commit: `ef050390644faabef8a0feda0dee645e057e2c0a`. A subsequent real Astra campaign stayed within the unchanged resource budget and completed every planned gate without manual termination. The framework repair did **not** commit: the existing zero-cost pins rejected its intended output changes. These are separate outcomes.

## Maintenance verification

Two resident-memory costs were removed, preserving the native commands and diagnostics:

- The exact verified UI preparation/typecheck invocation runs without resident Nx executors only for conservative static configuration and a dotenv-free context. Unsupported commands/configuration keep Nx. Native subprocess tests witness runtime inputs, dotenv, interpolation, local binaries and task environment.
- Package E2E runs the existing build CLI sequentially per package. TypeScript program residency ends with each child, before consumer builds. Declaration diagnostics, warning failures, caller V8 envelope and every template/deployment assertion remain.

Node 24.18.1, macOS arm64, fresh private export from `a2b91a896f17a060c7b8af20f0ea7955da10eb5b`: 142/142 scripts assertions pass with no skips/todos, 220143 ms, outer peak 2954133504 B. Gate/package strict types, harness typecheck and changed-file formatting pass. Actual nested supervisor→gates UI API/typecheck passes in 108092 ms, outer peak 2989703168 B. Cap 3221225472 B, V8 max 2048 MiB and Go envelope are unchanged.

An earlier full-suite run failed at 3252600832 B. A diagnostic tree pins ~2101886976 B in the packaging parent concurrent with a consumer build. This failure and both earlier rejected reviews are retained. Final actual read-only `gpt-6-astra` review accepted with findings=[]; review peak 1452048384 B. Shared user WIP was preserved through the named-path temporary-index/CAS commit. The user directly approved the private source/report payload after automatic approval review initially blocked inference.

Maintenance evidence: `.artifacts/ai-tester/maintenance/2026-11-01-ram/` (`provenance.json`, `candidate-v4.patch`, `scripts-v4.json`, `native-ui-v4.json`, process/resource records, `reviewer-v4.json`, `review-process-v4.json`, `commit.json`).

## Real campaign

```sh
PATH=/Users/denisseverin/.nvm/versions/node/v24.18.1/bin:$PATH node scripts/ai-tester/cli.ts doctor --model gpt-6-astra
PATH=/Users/denisseverin/.nvm/versions/node/v24.18.1/bin:$PATH node scripts/ai-tester/cli.ts run --area reactivity --model gpt-6-astra
```

Doctor `2026-11-01T09-31-09-201Z-89ab535d`: ready, CLI 0.153.4, actual inference, 1030520832 B peak. Model/authentication/provider settings remained unchanged.

Campaign `2026-11-01T09-31-50-649Z-a4d59802`, source `ef0503906`: 2026-11-01T09:31:50.994Z→09:52:06.314Z, 1215.320 seconds, sampled whole-tree peak 3108929536 B (2964.90625 MiB) under 3072 MiB. Whole-run deadline stayed 30 minutes. No retry, manual process termination, continuation or watchdog change. Campaign lock released normally.

The worker found a supported typed counterexample: assigning undefined to an existing `string | undefined` property through `produce` leaves its old value. An absent cached draft compares equal to undefined in the setter fast path. The candidate requires cache presence before accepting that equality. Its regression checks both sibling-cache states, notifications, own-property retention, previous snapshot immutability, sharing and repeated no-op writes. The supervisor independently replayed the same native AssertionError RED and passing GREEN; native reactivity/development suites pass 183+183 assertions. The candidate is three files: `libs/reactivity/store.ts`, `libs/reactivity/tests/store.test.ts`, `libs/reactivity/CLAUDE.md`.

All 55 planned gates executed: **53 pass, 1 noise, 1 fail**. UI typecheck passes 1m35s; production docs/CDK/UI builds pass; docs 64/64 and UI-docs 11/11 pass. Frames remain within ceilings. Size exit 1 is the unchanged classifier's existing ±20 B HTML Brotli noise (+8 B playground slots, +16 B resume-demo), not a new accepted ceiling. Zero-cost also confirms no dev leaks (265 entries), export condition parity (21 entries), 176/176 oracle matches and unchanged package/lane hashes.

The one blocking gate is zero-cost:

| Runtime entry | Before hash / minified bytes | Candidate hash / minified bytes |
| --- | --- | --- |
| `@rivetjs/reactivity/store` | `a3dfdbe62868` /10356 | `6cc49f481f96` /10375 |
| `@rivetjs/runtime/server-derived-store` | `5e9f3d0f3515` /42640 | `69e215acc70f` /42659 |

Terminal status **failed**, CLI exit 2, message `gates exited 1`. The framework candidate remains private; no repair review/intake/commit ran. Every baseline, threshold, classifier and resource limit remains unchanged. The original terminal record is not rewritten as a success. A fully automatic byte-changing repair commit remains unproven under the approved v1 policy requiring separate acceptance of intentional pins.

Authoritative campaign evidence: `.artifacts/ai-tester/2026-11-01T09-31-50-649Z-a4d59802/` (`run.json`, `events.jsonl`, `candidate.patch`, `candidate-hashes.json`, `red.json`, `green.json`, `gate-plan.json`, `gates.json`, `4-gates.log`, copied `evidence/`).
