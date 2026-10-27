// DOM-backed loader data (DOM-DATA, spec docs/design/specs/2026-10-20-dom-backed-loader-data-design.md): the build-time
// switch of its browser code. `false` here; the compiler plugin serves `export const DOM_DATA = true;` in its place for
// resume builds (default since DOMDATA-DEFAULT 2026-10-27; `rivet({ resume: { domData: false } })` opts out). Every use is
// `DOM_DATA && …` / `if (DOM_DATA)`: the bundler folds the constant, so other builds carry none of it (0 bytes).
// Imported by relative path (no package `imports` entry), like `lazy-rows.ts`.
export const DOM_DATA = false as boolean;
/** URL of the DOM data reader chunk (`dom-data-reader.ts`) the runtime imports for a tail with `d` entries (switch on only). */
export const DOM_READER = "" as string;
