# @rivetjs/cdk/layout
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Angular CDK layout port: `Breakpoints`, `MediaMatcher`, `BreakpointObserver`, plus `breakpointState` signal for bindings. Prefer CSS media / container queries; use this only when a handler or client effect must branch on a breakpoint.

## Entry points
- `@rivetjs/cdk/layout` -> `index.ts` (explicit package.json entry):
  - `Breakpoints` (XSmall..XLarge, Handset / Tablet / Web + Portrait / Landscape queries, Angular values)
  - `createMediaMatcher({ nonce? })`, `MediaMatcher`, `MediaQueryListLike`
  - `createBreakpointObserver(matcher?)`, `breakpointObserver()` (shared root instance), `BreakpointObserver` (`isMatched`, `observe`, `destroy`), `BreakpointObservable`, `BreakpointState`
  - `breakpointState(value, { initial?, observer? })` -> `{ state: Signal<BreakpointState>, connect(): () => void }`

## Layout
- `index.ts` - whole module (single file)
- deps: `../coercion` (`coerceArray`), `../platform` (`getPlatform`), `../utils/dom.ts` (`getNonce`)
- tests: `tests/layout.test.ts` (Angular breakpoints-observer.spec port, fake matchMedia)
- docs examples: `apps/cdk-docs/examples/layout-{breakpoints,observe}/`

## Upstream
- angular/components `src/cdk/layout` (`breakpoints.ts`, `media-matcher.ts`, `breakpoints-observer.ts`) (MIT, © Google LLC)
- Deviations (header): services -> factories (`createMediaMatcher`, `createBreakpointObserver`; `breakpointObserver()` shared); RxJS `Observable<BreakpointState>` -> minimal observable with same emission semantics (current state on subscribe, debounced changes, completion on `destroy()`); `breakpointState` signal is a Rivet addition

## Rules / invariants
- `observe()` emits current state on subscribe, then one emission per batch of changes, debounced to a macrotask (Angular `debounceTime(0)`)
- Comma-separated queries are split; each gets its own `MediaQueryList`
- Server / non-browser: noop matcher (only `all` and `""` match), like Angular's non-browser platform
- `breakpointState` initial = `initial` option (boolean or per-query map; default false = mobile-first, nothing matches) on server and before `connect()`; `connect()` subscribes and returns the disconnect fn
- WebKit / Blink workaround: one empty `@media` rule per query injected in a shared `<style>` (nonce from `getNonce()` unless `nonce` passed)
- Nothing runs at import time

## Commands
- `npx vitest run --project cdk libs/cdk/tests/layout.test.ts`

## Gotchas
- `clientEffect(() => bp.connect())` - the pattern the doc comment recommends (index.ts:236, breakpointState :239-256) - fails on resume: "function is not serializable" (gaps.md); comment still recommends it
- Workaround `<style>` injection deviates from the package "no style injection" rule (Angular-faithful); needs a CSP nonce

## See also
- [../CLAUDE.md](../CLAUDE.md), [../coercion/CLAUDE.md](../coercion/CLAUDE.md), [../observers/CLAUDE.md](../observers/CLAUDE.md)
- `apps/cdk-docs/content/foundations/layout.md`
