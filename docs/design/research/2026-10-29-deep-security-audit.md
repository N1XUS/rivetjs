# Rivet deep security audit — 2026-10-29

> Historical fixture relocation (2026-10-30): `adversarial-lab/` was retired after migration to `examples/operations`. Original reports, test runners and evidence are preserved in the [verified archive](archive/2026-10-29-adversarial-lab/README.md). Paths and results below describe the original run.

This source-driven follow-up established and repaired **four framework cache-isolation defects** beyond the earlier security suites. Every finding has a failing synthetic regression before its fix; all targets are local. Existing application audit results were preserved. This is a bounded audit of the current workspace, not a certification of an npm release or of production deployment settings.

## Confirmed findings and fixes

| Finding | Required conditions and observed impact | Fix and regression |
| --- | --- | --- |
| Raw adapter context survives anonymous page fills | Full-page caching is enabled; a loader reads identity through `platform.node.req`, `platform.ctx` or another request-specific platform field. Removing Web Request credentials did not remove the original Node cookie. Alice's first response became an anonymous visitor's cached response. | Observe platform reads through the whole buffered stream and refuse storage when request-specific facts are read. Static deployment `platform.env` bindings remain cacheable. `route-cache-platform.test.ts` covers real HTTP Node requests, static-page caching, deployment bindings, streamed/concurrent reads and reflection. |
| A first-fill waiter ignores newly learned Vary | Concurrent first requests select different representations using an application header; the first response introduces that header in `Vary`. The waiting beta request received alpha's response. | Recompute the waiting request's key after the fill completes. A mismatching representation renders independently. `route-cache-vary-race.test.ts` includes a matching-variant cache-hit control. |
| Shell locals reflection escapes dependency tracking | A middleware supplies session data in `locals`; a normal shell loader reads its property descriptor. Shell tracking missed that access, retained session-derived loader data and sent Alice's shell to an anonymous visitor. | Reject nonpartition descriptor reads and all prototype inspection. `shell-cache-reflection.test.ts` covers descriptor/prototype paths; a descriptor-based locale control preserves keyed public shell caching. |
| Stream completion changes policy after admission | A custom mutable streamed `Response` sets final `Vary`, `private, no-store`, `Set-Cookie` or a non-HTML content type during body production. Admission used the earlier headers. Beta received alpha's body; late Set-Cookie also replayed alpha's synthetic session cookie under a public cache policy. | Check admission again after the body completes and use final Vary when learning keys. Return uncached buffered bytes with final headers; rerender the original credentialed request when required. `route-cache-stream-policy.test.ts` covers five late policies and credentialed fallback. |

These are distinct causes; repeated Node/browser assertions are not counted as additional defects. All four require opting into a route cache or shell cache. The raw-context, shell-reflection and late-cookie cases demonstrate cross-visitor disclosure. Header-variant failures demonstrate cross-tenant disclosure only when the application uses that header to select tenant data. No CVSS score or universal authentication-bypass claim is assigned.

The late-policy reproduction uses the returned Response's mutable `headers`. It does not rely on deferred `event.setHeader`: deferred setter restrictions are unchanged. Cache routes remain public by contract; keep session pages under `cache: false` and send `private, no-store`. General authorization policy remains the application's responsibility.

## Other boundaries inspected

- SSR text/attribute escaping, raw-text script termination, head/JSON serializers, Dynamic tag validation, deferred output and error markers. No additional exploit confirmed in the inspected paths.
- Resume decoder reference bounds, own `__proto__` handling and builtin/error-constructor allowlists. Distinguish trusted server-generated browser wire data from remotely accepted server input; malformed client state alone is not evidence of a server exploit.
- Node static path containment/symlinks, canonical cache paths, origin/redirect handling, CSRF/media type and body-limit ordering. No new supported remote exploit established in this review.
- Production endpoint splitting with sourcemaps off/on: actual emitted `.js.map` files and browser JS omit private-module and endpoint-handler markers while retaining a public shared constant. A direct compiler loader-map probe also omitted its server-only canary.

No exhaustive dependency review, production configuration review, SSRF/DOM-XSS fuzz campaign or sustained denial-of-service measurement was performed. Static platform environment bindings are assumed deployment-wide; arbitrary application closure state and incorrectly placed request identity inside `env` are outside that invariant.

## Evidence and verification

RED logs are `/private/tmp/rivet-cache-platform-red.log`, `/private/tmp/rivet-cache-vary-red.log`, `/private/tmp/rivet-shell-reflection-red.log` and `/private/tmp/rivet-stream-policy-red.log`. The last contains five failing cases for one admission-policy cause. Focused surrounding tests passed before the final controls were added (`/private/tmp/rivet-deep-security-focused.log`, 58/58).

Final full router/forms tests passed **511/511 in 96 files** on Node 26 (`.artifacts/deep-security/full-tests.log`). New cache regressions and shell controls also passed **24/24** on Node 24 (`/private/tmp/rivet-deep-security-node24.log`). Production builds passed for main/CDK/UI docs; main docs site tests passed 64/64 and UI docs tests 11/11. Type/build/metadata evidence is `.artifacts/deep-security/types-docs-gates.json`; the corrected router typecheck passed in `.artifacts/deep-security/bytes-before-baselines.json`. Its initial router typecheck found only an overly broad `object` annotation in a new reflection test; it was corrected to the supported `Record<string, unknown>` platform type and passed the separate recheck. The updated reflection test also passes on Node 24. The original report is preserved. An independent reviewer identified the late-policy defect and reviewed the subsequent implementation; no remaining code blocker was reported. The proposed prototype/locale controls were added.

Reproduce the new regressions using existing workspace dependencies:

```sh
npx vitest run --project router libs/router/tests/route-cache-platform.test.ts libs/router/tests/route-cache-vary-race.test.ts libs/router/tests/route-cache-stream-policy.test.ts libs/router/tests/shell-cache-reflection.test.ts libs/router/tests/shell-cache.test.ts libs/router/tests/endpoint-split.test.ts --maxWorkers=1
```

The prior [security verification](2026-10-29-security-verification.md) remains a record of its earlier, narrower pass; its passing counts did not cover the newly discovered defects.


## Measured server code cost

The same-path production minifier reports router/server entry −18 bytes, optional route-cache entry +701 bytes, and the private shell-cache graph +182 bytes relative to the preceding stabilization state. These are separate graph measurements, not additive page download sizes. Evidence: `.artifacts/deep-security/own-code-bytes.json` and `shell-own-code-bytes.json`. The standard size report measured 28 applications: every measured client JS metric is unchanged; server builds increased by 679 minified bytes, or 861 bytes for the kit fixture that includes shell caching. Only server fields were ratcheted. The existing playground `/slots` HTML brotli fluctuation (+13 bytes) remains within the gate’s 20-byte noise band and its baseline was preserved. Frame payloads pass their existing ceilings. Evidence: `.artifacts/deep-security/size-deltas.json` and `bytes-before-baselines.json`.


## Existing unrelated formatting result

The whole-workspace format command still reports 24 unformatted files, all under the pre-existing `adversarial-lab/results/` JSON output. Those evidence files were preserved. The nine source/test files changed by this deep audit pass their own Prettier check. This report does not describe the whole workspace as having every gate green.


## Final gate result

`.artifacts/deep-security/final-byte-metadata-gates.json`: content, snippets, llms, MCP data, zero-cost and full size report **6/6 pass**. Zero-cost reports runtime + lanes identical after accepting only measured server deltas, no dev leaks, conditional export parity and 176/176 compiler cases. The repeated size report has no growth against the reviewed baseline. Final Node 26 focused tests pass 24/24; AI sync validates 213 generated files. Peak tree RSS stayed below 3 GB (largest selected gate 2.90 GB).

`.artifacts/deep-security/final-verification.json` records the combined results and source hashes. The three changed production files stayed byte-identical from the full 511-case test run through the final gates; the sole later test edit narrowed an annotation, followed by a passing typecheck and both Node-version controls. No publication or production deployment was made.
