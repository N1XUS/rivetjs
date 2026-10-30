# Packaged Rivet security audit — 2026-10-30

The isolated Linux consumer passed **61/61 server → browser checks** against six freshly built local npm tarballs. No new framework vulnerability was confirmed by these scenarios. The initial red assertions were investigated and corrected as harness assumptions; they are not reported as framework fixes.

## Artifact and environment

Framework source base: `5372cbd31` (after the four cache-isolation repairs). Packages: `@rivetjs/{reactivity,runtime,compiler,router,kit,devtools}`, all `0.1.0-alpha.2`, built through `scripts/package/build.ts` and packed with `npm pack`. No library production source was changed during this audit.

Actual consumer: **Linux arm64, Debian 13.4, Node 24.14.1**, Vite 8.3.2, Rolldown 1.2.16, Playwright 1.63.0 / Chromium 153.0.8010.12. The cached native runtime base was used for this run; the Dockerfile's default is the repository's pinned Node 24.14.1 public base. This is native Linux arm64 evidence, not Linux x64 coverage.

Only tarballs and the fixture enter the image. No repository/source/node_modules mount is available. Before tests, the runner verifies:

- Expected host manifest SHA-256 equals the image's embedded manifest; stale `--no-image` runs fail as infrastructure errors.
- Every fixture source file matches its manifest hash.
- Actual tarball SHA-256 and npm-installed package-lock SHA-512 integrity agree.
- Rivet entry realpaths are regular installed paths under `/consumer/node_modules`, not workspace symlinks.

Docker runtime has networking disabled, 3 GiB memory and 2 CPUs. Browser requests reach only synthetic loopback fixtures or intercepted static artifact bytes. Image setup downloads Linux tooling; it never publishes packages. The exact image ID, tarball hashes, dependency lockfile, runtime/tool versions and client file hashes are preserved under `.artifacts/packaged-security/`.

## Cases

| Boundary | Evidence |
| --- | --- |
| Server/browser code separation | Inline loader and guard canaries, sibling `.server.ts` loader, transitive private module, endpoint handler/public constant, server-only document route. Actual JS chunks and actual requested source maps are scanned with sourcemaps off/on. |
| Nonvacuous controls | Server endpoint executes private-module/handler canaries through an explicit synthetic proof request; ordinary endpoint/data requests return public values; native document HTML works; the first browser click executes the public shared constant. |
| HTML and JSON | Script termination, title/SVG breakout, quoted attribute injection and MathML-shaped payloads in text, attributes, head/JSON-LD and deferred results. CSP is disabled for these parser probes; values remain data before and after resume. |
| URL values | `javascript:`, control-separated JavaScript and HTML data URLs become the inert URL in HTML and SVG attributes. |
| Streaming | A release gate proves shell bytes arrive before payload delivery. A separate gate releases a server-only exception only after the shell is committed; the response emits a generic failure marker without the exception canary. |
| Errors | Loader failures, synchronous render failures and late streamed failures hide exception canaries in production HTML and data answers. |
| Nonce CSP | The real production CSP/header/nonce is preserved while the browser parser receives a non-nonced attack script and a correctly nonced control. The attack is blocked, the control and resumable first click work. The probe follows the [CSP inline script check](https://www.w3.org/TR/CSP3/#script-src-inline). |
| Static artifact | A separate static consumer build is actually prerendered; emitted HTML/data/maps exclude the server-only canary. Browser interception serves those exact files, with no SSR handler, and hostile text/JSON-LD remains inert while the installed runtime resumes. |

There are 29 checks for each sourcemap setting and three static checks. Package/manifest verification is a prerequisite, not extra passing security assertions.

## Investigated probe failures

The first completed run had 30 passing / six red assertions. Its result is preserved as `.artifacts/packaged-security/harness-probe-results.json`.

- Kit head components require the documented `kit()` plugin (or the explicit component-head setting). The initial fixture omitted it and got HTTP 500. Using the documented configuration makes the head/JSON-LD cases pass.
- A script appended by DevTools evaluation was not a reliable HTML parser injection test. It was replaced with a parser-inserted script in the real response body, retaining production headers and including an authorized nonce control. No weaker CSP was introduced.
- With component-head collection, an Async without a fallback can still fail before the document is released. A fallback plus an explicit release gate establishes the intended late-failure precondition; both early and genuinely committed-stream errors are now checked.
- Initial package identity checks incorrectly requested nonexistent root exports for runtime/devtools; the fixture now resolves their supported `/server` entry points. These startup failures were infrastructure exits, not passing checks.

## Review and limits

Independent review accepted the package isolation, source-map controls, static artifact serving, CSP allow/deny controls and gated late-failure evidence. It identified one important audit-runner lifecycle issue: the HTTP server was opened before Chromium launch, outside the protected cleanup block. The missing-browser negative integration probe reproduced the hang: infrastructure error was written, but the process stayed alive and the bounded test failed after 30 seconds. Browser acquisition now runs inside server-owned cleanup blocks; conditional browser cleanup cannot skip server closure. The same negative check exits naturally with infrastructure status 2 after the fix, and the full 61-case matrix remains green. This is an audit-runner reliability fix, not a newly discovered framework vulnerability.

Deferred minor: the inline guard canary is dead (`void secret`) and can disappear through optimization. Its absence alone is not a live guard-stripping proof. The live loader/endpoint controls and actual source-map inspection support the narrower conclusions above.

This is a fixed scenario matrix, not exhaustive fuzzing, dependency/CVE review, production configuration review, sustained DoS testing or a security certification. It does not prove all head/CSP combinations, browser engines, package subpaths or CPU architectures. Publicly returned loader data is intentionally public; its presence in resume state is not classified as a secret leak.

## Reproduce

```sh
node scripts/package/security.ts
# Reuse a cached native Node24 base if needed:
node scripts/package/security.ts --image rivet-verify-app:latest
# Reuse already packed tarballs (the fixture/image manifest is still checked):
node scripts/package/security.ts --no-pack --image rivet-verify-app:latest
# Against the completed image, verify deliberate infrastructure failures exit:
node scripts/package/security-failures.ts
```

The container matrix exits 0 only when checks pass, 1 for assertion failures, 2 for infrastructure failures. Host setup commands retain their external tool status. Negative integration checks expect infrastructure exit 2 and fail if the process hangs. No push, npm publication or production deployment is part of these commands.


## Final verification

- Linux production matrix: **61/61**, no infrastructure failures (`results/results.json`).
- Negative integration checks: **2/2** — stale image and missing Chromium both exit 2, with owned-container cleanup (`negative-results.json`). RED log: `launch-cleanup-red.log`; GREEN log: `/private/tmp/rivet-package-launch-green.log`.
- Existing affected scripts suite: **69/69 in 11 files** (`/private/tmp/rivet-packaged-scripts-tests.log`).
- Typechecks pass for the host audit tools and fixture; owned TS/TSX/JS/JSON formatting is clean.
- Library sources and production byte baselines are unchanged. Only test tools, fixture and internal audit documentation are committed.
- Combined evidence and tested source hashes: `.artifacts/packaged-security/verification.json`.
