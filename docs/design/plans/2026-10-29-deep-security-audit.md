# Rivet deep security audit

**Goal:** discover gaps beyond the existing security suites and immediately repair confirmed framework defects. The user's instruction authorizes local reproduction and fixes; work continues in the main checkout with all earlier changes preserved.

**Approach:** trace untrusted input through public APIs to a security-relevant result. A finding needs a supported API, a concrete trust boundary, a minimal failing test and a meaningful positive control. Configuration choices and explicitly unsafe HTML/code APIs are classified separately.

**Scope:** local framework source and synthetic loopback fixtures; no external targets, production changes, dependency installation or publication. The user subsequently authorized commits for completed work.

## Work and evidence

- [x] Cache isolation: `libs/router/server/{route-cache,shell-cache}.ts`, raw adapter context, response headers, concurrent fill/refresh and cache keys. First hypothesis: raw platform request survives anonymous full-page fills.
- [x] SSR and streaming: `libs/runtime/{server-derived,server-tail,resume-format}.ts`, router render/head and Kit serializers. Check script/raw-text termination, deferred cross-request ownership and error paths.
- [x] HTTP and routing: Node/fetch adapters, path and origin normalization, redirects, method/CSRF/body-limit ordering. Exercise new variants rather than re-counting existing assertions.
- [x] Decoder trust: malformed tables, keys/prototypes, built-in revival and script URLs; distinguish server-only wire data from directly attacker-controlled input.
- [x] For each confirmed defect: regression RED, minimal implementation GREEN, surrounding project tests, nearest CLAUDE/public docs and measured byte impact.
- [x] Final source/diff review and affected type/build/zero-cost/size/frame checks. Preserve original red evidence and record remaining uncertainties explicitly.

## Constraints

Node 26 host / Node 24 parity; `nice`, one heavy command per lane and ≤3 GB process-tree RSS. Browser suites serialized. Generated output is regenerated. Rust edits/builds stay with the root agent. Existing application fixture results remain unchanged.

## Review focus

Credentials reachable through alternate APIs; response-policy changes after cache admission; concurrent requests with different identities; late streamed reads after initial headers; HTML parser behavior differing from regex matches; canonicalization differences across adapter and handler.

## Ledger

- Initial workspace: earlier stabilization/security changes are uncommitted. Read-only baseline saved as `.artifacts/deep-security/before.diff`; this audit's tests and fixes must remain distinguishable from that baseline.
- Confirmed: full-page fills retained raw adapter context after stripping Web Request credentials. Real Node HTTP regression returned Alice's synthetic cookie to an anonymous subsequent visitor; three new assertions were red, with a positive ordinary-cache control green. A tracked platform read now prevents storage, including streaming reads; 39 surrounding tests pass. Static environment bindings remain usable/cacheable.
- Confirmed: a waiter joined a first fill before its response taught the cache a Vary header, then received the wrong tenant representation. A gated two-tenant regression was RED; completed-key revalidation makes it GREEN. Five platform cases, the Vary race and the surrounding cache/locals tests pass (41/41).
- Additional production canary: endpoint handlers/private modules stay absent from both browser JS and source maps with sourcemaps off/on (2/2). Direct compiler source-map probe also strips server loader bodies; no new source disclosure confirmed.
- Reviewed SSR text/attribute/raw-text serializers, Dynamic tag validation, resume decoder prototype/builtin handling, HTTP path/origin/CSRF/body handling and shell tracking. No additional exploitable defect confirmed within these inspected paths; this is a bounded source audit, not exhaustive fuzzing.

- Confirmed: shell locals descriptor reads escaped tracking and cached a session-derived shell. Regression returned Alice to an anonymous visitor (RED); descriptor/prototype traps prevent storage. New positive locale descriptor coverage retains partition caching.
- Confirmed by independent review and five RED cases: streamed Response headers could become Vary/private/Set-Cookie/non-HTML after the admission snapshot. Final-policy revalidation respects final headers and returns uncached bytes or original credentialed responses. No changes to deferred setter semantics.
- Independent final source review found no remaining issue in the four fixes. The suggested prototype/locale controls are included in the final full test run.

- Final full router/forms: 511/511 (96 files), Node 26. Node 24 cache/shell controls: 24/24. Three production docs builds and main64/UI11 site checks pass. Initial router typecheck caught a test-only broad object annotation, corrected before the separate final recheck; no production change. Remaining work: byte gates and final source verification.

- Complete: all selected typechecks/builds/site tests, Node 24/26 controls, original frame ceilings and final byte/metadata gates pass. Only measured server byte baselines advanced; 28 apps have unchanged client JS metrics. Global format still reports the existing 24 fixture result JSON files, preserved; nine owned code/test files are clean. Final hashes confirm production sources unchanged since the full test run. Detailed result: `docs/design/research/2026-10-29-deep-security-audit.md`.
