// Adopt-run hooks of the DOM runtime (`_adoption.node` / `slot`; LAZY-ROWS origin, spec
// docs/design/specs/2026-10-19-lazy-collection-rows-design.md): the build-time switch of their browser code. `false`
// here; the compiler plugin serves `export const LAZY_ROWS = true;` in its place in every resumed browser build (with
// `derived.ts`, `libs/compiler/switches.ts` `DERIVED_SWITCHES`). Every use is `LAZY_ROWS && …` / `if (LAZY_ROWS)`: the
// bundler folds the constant, so client-rendered builds carry none of the adopt hooks of the DOM runtime (`dom-v2.ts`,
// `dom.ts`, `dom-v2-spread.ts`, `dom-svg.ts`) — 0 bytes. Imported by relative path (no package `imports` entry): browser
// test harnesses serving the sources serve this file too (`rivetTest()` serves the `true` module).
export const LAZY_ROWS = false as boolean;
