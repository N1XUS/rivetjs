# Local security verification — 2026-10-29

Scope: the owned Rivet workspace and synthetic local fixtures. This is evidence for particular defenses, not a security certification or a production penetration test. No production systems or external targets were assessed.

## Fresh results

| Check | Result | Evidence |
| --- | --- | --- |
| Production application security fixture | 71/71 pass | `.artifacts/stabilization/security-validation.json` |
| Framework security, hardening, cache and escaping tests | 55/55 pass, Node 24 | `/private/tmp/rivet-framework-security-tests.log` |
| Shared authentication boundary | New GET/POST tests pass within the 55 above | `libs/router/tests/auth-boundary.test.ts` |

The production fixture was copied to `/private/tmp/rivet-security-validation-U8wF6x/adversarial-lab`, rebuilt against current workspace dependencies and given a new SQLite database and an ephemeral `127.0.0.1` port. Original `adversarial-lab/results/` files were preserved. The local runner is `.artifacts/stabilization/validate-security.mjs`; build, server and test logs are alongside its JSON result.

The fixture's own layer labels divide its 71 checks into 21 framework checks, 29 application-policy checks and 21 mixed checks. Passing application authentication, tenant filtering, SQL bindings, upload rules, checkout validation or WebSocket authorization does not make those policies automatic Rivet features.

## Boundaries exercised

| Boundary | Evidence and ownership |
| --- | --- |
| Unsafe cross-origin requests | Router checks reject inappropriate Origin / Fetch Metadata before handlers. Endpoint opt-out is explicit. Source: `libs/router/server/security.ts`; tests: `security.test.ts`. |
| Body size | Declared and streamed oversized bodies return 413. A positive upload under the limit remains usable. Framework defense. |
| Redirects and dispatch | Same-origin redirects, explicit external redirects, unsafe raw locations, and inherited action names are covered by security/hardening tests. Framework defense. |
| HTTP adapter | Request targets, malformed Host, public-file behavior, ranges and validators are covered by `node-hardening.test.ts`. Deployment origin and proxy trust still require correct configuration. |
| Cached pages | `route-cache.test.ts` exercises authenticated-request bypass, private/no-store responses, vary behavior and anonymous fills. Passing these cases is not proof for every deployment cache configuration. |
| Text escaping | `libs/runtime/tests/escape.test.ts` checks escaping primitives. This run does not exhaustively test DOM-XSS contexts or user-supplied raw HTML. |
| Tenant/session/stream isolation | Fresh synthetic application checks cover denied anonymous/foreign access, role checks, session rotation/revocation, SSE and WebSocket isolation. These include application-owned policies. |

No new exploitable framework defect was established by this pass. This statement does not mean that no undiscovered defects exist.

## Important existing authorization contract

Page request handlers run before layout guards. A layout `guard` therefore does not protect a page's earlier `onGet` response. The request order is unchanged by this work.

The public routing guide now documents a shared authentication pattern: validate the session in an enclosing layout's `onRequest`, throw `deny(401)` on failure, and only then put the validated identity in `event.locals`. Permission checks for a particular resource still belong to that operation.

The new conformance test uses an explicitly mocked session validator, not an authentication implementation. It checks missing/forged identities before page handlers, endpoint handlers and loaders, for GET/POST and data-query variants. Valid controls prove the routes remain usable. Real route keys and a tracked layout loader prove that `_rivet_keep` skips the layout loader while authentication still runs and supplies validated locals.

## Reproduction

From the repository root with existing dependencies and Node 24:

```sh
npx vitest run --project router --project runtime libs/router/tests/auth-boundary.test.ts libs/router/tests/security.test.ts libs/router/tests/hardening.test.ts libs/router/tests/node-hardening.test.ts libs/router/tests/route-cache.test.ts libs/runtime/tests/escape.test.ts --maxWorkers=1
```

Use the isolated local runner above to repeat the 71 application checks without overwriting the original audit results. The fixture test source SHA-256 and actual build/test exits are stored in its result JSON.

Not assessed here: production configuration, complete dependency review, exhaustive SSRF/DOM-XSS analysis, or sustained denial-of-service capacity. No framework-wide safety claim follows from the passing counts.

## Subsequent deeper audit

The [source-driven deep audit](2026-10-29-deep-security-audit.md) subsequently reproduced and repaired four cache-isolation defects outside this earlier pass: raw platform context, first-fill Vary waiters, shell locals reflection and late streamed Response policy. The earlier no-new-defect statement applies only to the scope above.
