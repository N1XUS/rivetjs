// The runtime's build-time switch modules and their opted-in content, one table for every place that swaps them: the
// compiler plugin (`vite.ts`: the adopt run in browser builds, `rivet({ resume: { domData } })`), the Vitest plugin
// (`@rivetjs/testing/vite` `rivetTest()`), the runtime's resume test harness (`libs/runtime/tests/resume/harness.ts`) and
// the zero-cost hashes (`scripts/zero-cost/runtime-hashes.mjs`). Default content (the switch off) is the switch file
// itself. No imports: plain Node loads it from the `.mjs` scripts.

/** The adopt run of resumed pages (browser builds): `derived.ts` (`DERIVED`, the `_for` hook) and `lazy-rows.ts`
 * (`LAZY_ROWS`, the `_adoption.node` / `slot` hooks). */
export const DERIVED_SWITCHES = ["derived", "lazy-rows"] as const;
/** `resume.domData` (DOM-DATA, DERIVED-C5): `dom-data.ts` (browser) and `dom-data-derived.ts` (server). */
export const DOM_DATA_SWITCHES = ["dom-data", "dom-data-derived"] as const;

/** Runtime switch module a resolved file path names (workspace source `libs/runtime/` or an installed `@rivetjs/runtime/`, any
 * package manager layout): `[, name, extension]`, else null. */
export const SWITCH_MODULE = /[\\/](?:libs[\\/]runtime|@rivetjs[\\/]runtime)[\\/](lazy-rows|dom-data(?:-derived)?|derived)\.([cm]?[jt]s)$/;

/**
 * Opted-in content of switch module `name` (a name of `DERIVED_SWITCHES` / `DOM_DATA_SWITCHES`, else null); `from(module)`
 * spells the import of a sibling runtime module (`server-derived-dom` → `"./server-derived-dom.js"` in a published build).
 */
export function switchContent(name: string, from: (module: string) => string): string | null {
  switch (name) {
    case "lazy-rows":
      return "export const LAZY_ROWS = true;\n";
    case "derived":
      return "export const DERIVED = true;\n";
    case "dom-data":
      // The reader chunk's URL (DOMDATA-DEFAULT v2): next to this module; the compiler plugin's client build serves its
      // emitted chunk's URL instead (`vite.ts` `domDataSwitch`).
      return `export const DOM_DATA = true;\nexport const DOM_READER = new URL(${JSON.stringify(from("dom-data-reader"))}, import.meta.url).href;\n`;
    case "dom-data-derived":
      return `import { _derivedDom } from "${from("server-derived-dom")}";\nexport const derivedDom = { api: _derivedDom };\nexport const DOM_DATA_SERVER = true;\n`;
  }
  return null;
}
