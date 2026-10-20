// DOM-backed loader data (DOM-DATA, spec docs/design/specs/2026-10-20-dom-backed-loader-data-design.md): the build-time
// switch of its browser code. `false` here; the compiler plugin serves `export const DOM_DATA = true;` in its place (and
// the reader in `dom-data-resume.ts`) for builds with `rivet({ resume: { domData: true } })`. Every use is
// `DOM_DATA && …` / `if (DOM_DATA)`: the bundler folds the constant, so other builds carry none of it (0 bytes).
// Imported by relative path (no package `imports` entry), like `lazy-rows.ts`.
export const DOM_DATA = false as boolean;
