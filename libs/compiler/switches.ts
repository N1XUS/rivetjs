// The runtime's build-time switch modules and their opted-in content, one table for every place that swaps them: the
// compiler plugin (`vite.ts`, `rivet({ resume: { lazyRows, domData } })`), the runtime's resume test harness
// (`libs/runtime/tests/resume/harness.ts`) and the zero-cost hashes (`scripts/zero-cost/runtime-hashes.mjs`). Default
// content (the option off) is the switch file itself. No imports: plain Node loads it from the `.mjs` scripts.

/** `resume.lazyRows` (LAZY-T5B): `lazy-rows.ts` (browser + server flag) / `lazy-rows-resume.ts` (resume factory slot). */
export const LAZY_SWITCHES = ["lazy-rows", "lazy-rows-resume"] as const;
/** `resume.domData` (DOM-DATA): `dom-data.ts` / `dom-data-resume.ts` (browser), `dom-data-server.ts` (server). */
export const DOM_DATA_SWITCHES = ["dom-data", "dom-data-resume", "dom-data-server"] as const;

/**
 * Opted-in content of switch module `name` (a name of `LAZY_SWITCHES` / `DOM_DATA_SWITCHES`, else null); `from(module)`
 * spells the import of a sibling runtime module (`dom-resume-lazy` → `"./dom-resume-lazy.js"` in a published build).
 */
export function switchContent(name: string, from: (module: string) => string): string | null {
  switch (name) {
    case "lazy-rows":
      return "export const LAZY_ROWS = true;\n";
    case "lazy-rows-resume":
      return `export { _lazyRows } from "${from("dom-resume-lazy")}";\n`;
    case "dom-data":
      return "export const DOM_DATA = true;\n";
    case "dom-data-resume":
      return `export { _domData } from "${from("dom-resume-data")}";\n`;
    case "dom-data-server":
      return `import { _domRegistry } from "${from("server-dom-data")}";\nexport const domServer = { create: _domRegistry };\n`;
  }
  return null;
}
