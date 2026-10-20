// Lazy collection rows (LAZY-ROWS, spec docs/design/specs/2026-10-19-lazy-collection-rows-design.md): the build-time
// switch of their browser code. `false` here; the compiler plugin serves `export const LAZY_ROWS = true;` in its place
// (and the factory in `lazy-rows-resume.ts`) for builds with `rivet({ resume: { lazyRows: true } })`
// (`rivetRouter({ resume: { lazyRows: true } })`). Every use is
// `LAZY_ROWS && …` / `if (LAZY_ROWS)`: the bundler folds the constant, so other builds carry none of the lazy row
// materialisation (`dom-resume-lazy.ts`, `dom-adopt.ts` `_adoptRow`) nor the adopt-run hooks of the DOM runtime
// (`dom-v2.ts`, `dom.ts`, `dom-v2-spread.ts`) — 0 bytes (LAZY-T5B). Imported by relative path (no package `imports`
// entry): browser test harnesses serving the sources serve this file too (a lazy test serves the `true` module).
export const LAZY_ROWS = false as boolean;
