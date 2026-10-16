# Dev / prod runtime builds

Goal: development-only diagnostics in `@rivetjs/runtime` at zero production cost.

## Mechanism
- Package `imports` entry `#dev` in `libs/runtime/package.json`:
  - `development` → `dev/on.ts` (`DEV` = diagnostics toolkit object);
  - `default` → `dev/off.ts` (`DEV = false`).
- `DEV` is the diagnostics toolkit object in development and `false` in production: call sites read `DEV ? DEV.at(…) : …`, so no helper is reachable once the constant folds (no unused-export warnings either).
- Who resolves `development`:
  - Vite (client and SSR): default conditions `development|production` → `development` on `vite serve` and on `NODE_ENV=development vite build`, else `production`;
  - Node: `node --conditions=development …`;
  - esbuild / Rollup without the condition → `default` (production).
- TypeScript resolves `default` (no `customConditions`); `off.ts` types `DEV` as `false | DevTools`.

## Zero-cost gate
- Minified Rolldown bundles (Vite 8's bundler, production conditions) byte-identical to before.
  - esbuild inlines the imported `false` but keeps the dead blocks (its DCE runs before cross-module inlining): esbuild-bundled servers carry a few hundred unreachable bytes; none of the ssr-bench lanes includes the resume encoder.
- ssr-bench lane HTML byte-identical (lanes build with `production`).

## Diagnostics (first set)
- Resume serialization errors name the value path inside the capture, e.g. `Cannot resume src/a.tsx#App: capture #0 .routes[0].load: function is not serializable`.
  - Prod keeps the short message (no try/catch per nested value).
- Hints (`DEV.hint(message, key)`: `message — cause and fix`) on the failures users hit:
  - `function` (not serializable), `computed` (outside a resume-compiled component), `manifest` (no chunk for a symbol);
  - `drift` (missing resumable element/region/text: HTML changed before resume), `skew` (symbol chunk from another build).
  - Not in `server.ts`/`dom.ts`: the ssr-bench lanes bundle `server.ts` with esbuild, which would keep the dead branches in the render loop.
- DOM façade (`dev/dom.ts`, `development` export of `@rivetjs/runtime/dom`; dom.ts untouched), with or without a devtools hook:
  - snapshot props: `component(Child, () => ({ n: n() }))` evaluates the props thunk with `_trackReads`; a signal read → one `console.warn` per (component, prop): `<Child n={…}> read a signal, but props are values … pass the accessor: n={count} rather than n={count()}, and call props.n() inside Child`;
    - prop named when its value equals a read signal's current value; else (derived, e.g. `"x" + double()`) the component and its value props are listed;
    - component bodies run `untrack`ed (as in production) so eager JSX in a props thunk cannot attribute its components' reads to the parent;
    - server render: not covered (server output calls `Child({ n: n() })` directly; no hook without a compiler change).
  - runtime errors keep the production prefix and add context: `Unsupported DOM child value (Map) in <Card> — …`, `Unsafe URL attribute href (javascript: URL) in <Link> — …`, `Invalid DOM range in <Inner>`;
    - child values checked before dom.ts sees them (component output, `mount` factory, `bindChild` reads; function children re-checked when read); URL rule mirrored in `bindAttribute` (parity test against dom.ts), value coerced once;
    - nearest component: owner → component map, walked up with `_debug(owner).parent()`; other errors thrown inside a component with these messages get ` in <Name>`.

## Tests
- Production behavior: the existing suites (default conditions).
- Development behavior: a test spawns `node --conditions=development` and checks the path in the message; a bundle check proves `dev/on.ts` code is absent from the production bundle.
- DOM façade diagnostics: [dev-diagnostics](../../../libs/runtime/tests/dev-diagnostics.test.ts) (Chromium; development vs default-condition bundles: warnings, messages, URL-rule parity, no diagnostics text in the production bundle).
