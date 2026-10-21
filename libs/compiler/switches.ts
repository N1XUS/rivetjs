// The runtime's build-time switch modules and their opted-in content, one table for every place that swaps them: the
// compiler plugin (`vite.ts`, `rivet({ resume: { lazyRows, domData, model } })`), the runtime's resume test harness
// (`libs/runtime/tests/resume/harness.ts`) and the zero-cost hashes (`scripts/zero-cost/runtime-hashes.mjs`). Default
// content (the option off) is the switch file itself. No imports: plain Node loads it from the `.mjs` scripts.

/** `resume.lazyRows` (LAZY-T5B): `lazy-rows.ts` (browser + server flag) / `lazy-rows-resume.ts` (resume factory slot). */
export const LAZY_SWITCHES = ["lazy-rows", "lazy-rows-resume"] as const;
/** `resume.domData` (DOM-DATA): `dom-data.ts` / `dom-data-resume.ts` (browser), `dom-data-server.ts` (server). */
export const DOM_DATA_SWITCHES = ["dom-data", "dom-data-resume", "dom-data-server"] as const;
/** `resume.model: "derived"` (M2 lane R): `derived.ts` (the adopt runtime's `_for` hook). A derived build serves it with the
 * `LAZY_SWITCHES` (their `_adoption.node` / `slot` hooks carry the adopt run). */
export const DERIVED_SWITCHES = ["derived"] as const;

/**
 * Opted-in content of switch module `name` (a name of `LAZY_SWITCHES` / `DOM_DATA_SWITCHES` / `DERIVED_SWITCHES`, else null); `from(module)`
 * spells the import of a sibling runtime module (`dom-resume-lazy` → `"./dom-resume-lazy.js"` in a published build).
 * `unbundled`: served as is (runtime test harnesses, zero-cost hashes) — the lazy rows runtime is then imported by
 * `from`'s path when no lazy add-on names its chunk (bundled builds: never, a bundler would add its preload helper).
 */
export function switchContent(name: string, from: (module: string) => string, unbundled = false): string | null {
  switch (name) {
    case "lazy-rows":
      return "export const LAZY_ROWS = true;\n";
    case "lazy-rows-resume":
      // The lazy rows runtime is a chunk of its own: the resume entry awaits `_lazyReady(load)` (the compiler plugin appends
      // it, `lazyReady`: `load` = the entry's `import()` of the chunk), which loads it only on pages whose state holds `L`
      // entries (the loader's parsed state); later loads go through the lazy add-on (`document.$rl`: its `data-lz`, manifest
      // `lazyRows`, preloaded at the first event walk) or `load`; a failed load leaves `_lazyRows` null (`dom-resume.ts`
      // loads it when a state with `L` entries registers). No `import()` here: a bundler would add its preload helper to the
      // runtime of every page.
      return (
        // `@rivetjs/runtime/id` (row id scopes; page code imports it too) in the entry's closure: the lazy chunk then needs
        // nothing of page chunks (`vite.ts` merge input).
        `import ${JSON.stringify(from("id"))};\n` +
        `let load;\n` +
        `export const _lazyLoad = () => (document.$rl ? document.$rl() : load ? load() : ${unbundled ? `import(${JSON.stringify(from("dom-resume-lazy"))})` : 'Promise.reject(new Error("Rivet resume: no lazy rows chunk"))'});\n` +
        `export let _lazyRows = null;\n` +
        `export const _lazyReady = (importer) => ((load = importer), typeof document < "u" && document.$r?.p().L ? _lazyLoad().then((m) => void (_lazyRows = m._lazyRows), () => {}) : undefined);\n`
      );
    case "dom-data":
      return "export const DOM_DATA = true;\n";
    case "dom-data-resume":
      return `export { _domData } from "${from("dom-resume-data")}";\n`;
    case "derived":
      return "export const DERIVED = true;\n";
    case "dom-data-server":
      return `import { _domRegistry } from "${from("server-dom-data")}";\nexport const domServer = { create: _domRegistry };\n`;
  }
  return null;
}
