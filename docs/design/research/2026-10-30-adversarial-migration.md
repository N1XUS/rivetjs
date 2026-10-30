# Adversarial lab retirement

The useful integration tests now live in `examples/operations`, discovered by the existing `examples/*/tests/*.test.ts` Vitest project and its Chromium CI job. The maintained fixture has 145 native tests across six suites. Historical reports, sources, original assertions, logs and screenshots are preserved in the [verified archive](archive/2026-10-29-adversarial-lab/README.md). The root `adversarial-lab/` directory and bespoke audit runner are retired.

## Coverage disposition

Counts below refer to rows in the latest original suite files, including competitor controls; they are not counts of independent framework defects. Repeats and phase-1/investigation snapshots stay historical. The archive inventory includes 379 assertion records across 25 JSON files and must not be summed as new product tests.

| Original suite | Rows | Maintained coverage / disposition |
| --- | ---: | --- |
| Business | 20 | All 20 in `examples/operations/tests/business.test.ts`, fresh SQLite database; unknown-user positive coverage added alongside the original injection rejection. |
| Application security | 71 | All 71 in `examples/operations/tests/security.test.ts`, including positive ownership controls, role/tenant/session rules, request limits, upload/download, checkout races, SSE and WebSocket isolation/revocation. |
| Browser journeys | 31 | All 31 in `examples/operations/tests/journeys.test.ts`: JS-off flows, history, concurrent tabs, stale edits, autosave/retry, attachments, stored/reflected XSS, logout and mobile layout. |
| Stress | 4 | All 4 in `examples/operations/tests/stress.test.ts`: 2000 rows/50 reorders, transport mount/unmount, delayed chunks/input retention, 20 resource supersession rounds. |
| Production browser | 15 | 11 in `examples/operations/tests/browser.test.ts`, including the fully typed produce truncation DOM regression. Native-link live-page draft retention already lives in `libs/router/tests/live-native-ssr.test.ts`. Two unsupported array-path probes and the documented Async subscription limit stay archived. |
| HTTP | 13 | 8 in `examples/operations/tests/http.test.ts`: SSR/request isolation/escaping, origin rejection, CAS conflict, SSE order/abort cleanup and JS-off native action. The original anonymous-loader/endpoint layout-guard checks are retained explicitly in `libs/router/tests/auth-boundary.test.ts`, with forged-cookie negatives, allowed-cookie positives and payload call counters; live SSR by `live-native-ssr.test.ts`; streaming shell timing by the stronger explicitly gated payload in `scripts/package/security-fixture/audit.mjs`. The documented page-handler-before-layout-guard expectation stays archived. |
| State + Solid controls | 11 | Supported Rivet produce truncation and nested-path notification are covered by `libs/reactivity/tests/store.test.ts`; batched diamond coherence by `reactivity.test.ts` and `fuzz.test.ts`. All five Solid comparison rows, two unsupported array-length path probes and the sparse-array reconcile probe (also red in Solid) stay archived. |
| Codegen A/B | 2 | Both navigation settings are exercised by `libs/router/tests/live-native-ssr.test.ts`, checking actual production GET/browser behavior rather than generated string presence alone. |
| React/Next/Solid controls | 4 | Comparison-only controls stay archived with source and exact historical results; no maintained integration test requires their private toolchains. |

The application's authentication, tenant filters, roles, upload policy, price calculation and checkout behavior belong to the synthetic fixture. Passing their tests does not mean Rivet supplies those policies or certify its security. The original report's typed API/design-limit/type-escape/competitor distinctions are preserved.

## Migration details

Tests now use native throwing Vitest assertions instead of catch-and-write-JSON result wrappers. Setup errors fail the suite. Each production suite copies its sources, builds its own client/server outputs, creates a fresh SQLite database and starts an ephemeral loopback child server. No tests mutate cwd or share ports/databases. Browser contexts close in `finally`; failed cases retain screenshots; failed browser startup closes the child. Teardown terminates WebSockets and drains HTTP, with a bounded child kill fallback. Logs and local evidence live under `.artifacts/operations-tests/`.

Only the synthetic operations app was retained. Unsupported store panels, standalone live/Async/private-guard historical routes, competitor installations and generated caches were removed from the maintained fixture. Server services moved into `src/server/*.server.ts`; imports, database environment variable and backend shared symbol were updated consistently. The original fixture files inside the archive remain unchanged.

The original latest `editor-autosaves-and-reloads-from-database` result was red. The unchanged supported assertion passed in both maintained runs against fresh production builds/databases. No framework fix or weakened assertion was needed for migration; the old observation remains in the archive and is not relabeled passing.

## Verification

- Operations-only Vitest: **145/145**, six files on Node 26; **145/145** again on Node 24.18.1 after deleting the old lab. Every production suite builds both client and server.
- Full examples Vitest project: **170/170**, ten files (including all 145 operations tests).
- Selected existing/retained router and reactivity regressions: **65/65**, five files, including the explicit layout-guard loader/endpoint cases.
- Operations `check` (route sync, Rivet diagnostics and TypeScript), router TypeScript, scoped Prettier and changed-file format gate: exit 0. All 3920 tracked/staged TSX files belong to JSX projects; 36 local Markdown links resolve. Archive source inventory and all 202 member byte/hash comparisons: verified.
- Independent final review: clean; archive member bytes and all 379 historical assertion pointers/statuses verified independently. No production security certification or historical prose correction is claimed.
- Archive: 202 regular files, 6,235,063 original file bytes. SHA-256 `a6596bd33772d26b45da6e556a133185bf256681413f2af54bb0ff57f5451c82`; every decompressed member checked against its manifest and original working-tree bytes before removal. Original reports/results/test/control sources are all included. Generated build/dependency/cache trees and OS metadata are excluded explicitly.

Run maintained coverage from the repository root:

```sh
npx vitest run --project examples --maxWorkers=1
node scripts/tsc.ts -p examples/operations
```

Use the archive README to verify/extract historical evidence. Old `npm --prefix adversarial-lab run audit` instructions inside archived sources describe the historical fixture and are no longer active workspace commands.
