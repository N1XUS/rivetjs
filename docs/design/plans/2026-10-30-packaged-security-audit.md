# Packaged Rivet server → browser security audit

> Historical fixture relocation (2026-10-30): `adversarial-lab/` was retired after migration to `examples/operations`. Original reports, test runners and evidence are preserved in the [verified archive](../research/archive/2026-10-29-adversarial-lab/README.md). Paths and results below describe the original run.

**Goal:** test freshly built npm tarballs as a real consumer on Linux/Node 24, reproduce and repair supported security defects, and commit verified changes. This executes the user's approved scope in the main checkout; unrelated user work stays untouched.

**Architecture:** build selected packages with the repository packager; record tarball hashes; install into an isolated Linux consumer with Linux-native third-party tooling. No workspace Rivet symlinks, source aliases or repository node_modules may satisfy consumer imports. Production server/static builds and browser observations inspect the emitted artifact. Synthetic secrets and loopback targets only; no publishing.

**Constraints:** one heavy command at a time, nice host commands, Docker memory ≤3 GB and ≤2 CPUs. Node 24 exact runtime/image identity is recorded. Package/dependency install is local to the disposable audit consumer. Compiler Rust changes/builds remain root-only through Docker. Every confirmed fix needs RED→GREEN and affected gates before its own temporary-index commit.

## Tasks

- [x] Establish Linux/Node 24 consumer: build/pack reactivity, runtime, compiler, router and kit (plus any actually required internal peer); install tarballs, verify realpaths/manifests, record source HEAD/runtime/platform and SHA-256. Distinguish infrastructure failures from findings.
- [x] Add a repeatable package security fixture/runner under `scripts/package/`: production routes cover inline/server sibling exports, private imports, returned data versus unused server locals, public captured values, source maps off/on, resume state and error redaction. Assert positive controls and actual emitted maps/chunks, not merely absence of markers.
- [x] Exercise browser parser boundaries: hostile text/attribute/URL/JSON payloads, head/JSON-LD, streamed/deferred data, nonce CSP, early and late render failures; inspect HTML/data/chunks/maps and actual browser execution. A documented unsafe raw HTML API is not an escaping failure.
- [x] For each proven defect: minimal framework regression RED, root-cause repair GREEN, repack changed packages, rerun isolated Linux consumer, nearest CLAUDE/docs and affected checks, then commit separately.
- [x] Independent final review; record passing cases, exact conditions, rejected hypotheses, remaining limits and byte impact. Commit the reproducible audit and results summary even if no defect is established.

## Review focus

Canary literals occurring only in stripped server declarations; transitive private imports in emitted JSX packages; accessor/closure capture versus explicitly returned public data; HTML raw-text termination and namespaces; failed streams exposing exception messages or sharing recorder state; package resolution escaping into the workspace.

## Ledger

- Base HEAD: `5372cbd31`. Existing user WIP: root CLAUDE, launch config, adversarial-lab and lane-harness spec.
- Cached native Linux image provides Node 24.14.1 arm64; cached node:24 image provides Node 24.22.0 x64 under emulation. Prefer native Node 24.14.1 and record architecture; neither image has the required consumer build tools installed.

- Infrastructure: the cached native runtime inherits a non-root user; first browser setup failed attempting `su`. The audit Dockerfile now explicitly uses root only inside the disposable image, splits tool/browser layers for caching and bounds npm fetch retries/timeouts. This is not a framework finding.

- Linux results: 61/61 pass, Node 24.14.1 arm64 / Debian 13.4 / Chromium 153.0.8010.12; installed packages alpha.2, Vite 8.3.2 and Rolldown 1.2.16. Actual package realpaths, tarball SHA-256, npm installed SHA-512 integrity and fixture/image manifest are checked before testing.
- Initial probe reds were harness issues, not confirmed defects: Kit requires kit(); CSP attack must be parser-inserted instead of using DevTools evaluate; a late failure needs a fallback shell plus a gate proving bytes were committed. Corrected tests pass; early held failures and genuinely late streamed failures are tested separately. Initial probe evidence preserved as `.artifacts/packaged-security/harness-probe-results.json`.
- Ruling: reuse the cached native Node24 image as runtime base to avoid an unnecessary download; the consumer has a fresh /consumer node_modules install, no source mounts, and verified tarball integrity. Exact image/runtime/distro recorded. This establishes native Linux arm64 coverage; it does not establish Linux x64 parity.
- No framework production change or new confirmed vulnerability so far. Remaining work: independent review, affected script tests/types/format and final commit.

- Final: fixed the reviewer's Important audit-tool cleanup gap. Missing-browser integration was RED (process held open past 30 s), protected browser/server cleanup makes it GREEN (natural exit 2). Stale-image rejection also passes; final full Linux matrix 61/61, scripts suite 69/69, both typechecks and owned format pass.
- Final: minor (deferred): guard canary is dead and may be optimized away; no independent live guard-stripping claim is made. Live loader/endpoint and actual map controls remain active; limitation is explicit in the research report.
- No new framework defect confirmed, so no production framework patch was fabricated. The reusable artifact audit and runner lifecycle repair are the deliverable to commit.
