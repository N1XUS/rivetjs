// DOM data on derived (DERIVED-C5): the derived server's build-time switch. `api` is null here; resume builds (unless
// `rivet({ resume: { domData: false } })`) get `server-derived-dom.ts` `_derivedDom` instead (the compiler
// plugin's `load` hook, `libs/compiler/vite.ts` `domDataSwitch`), so the list registry and the `d` encoder ship only in
// those servers. Tests set `api` themselves.
import type { _derivedDom as Api } from "./server-derived-dom.ts";

export const derivedDom: { api: typeof Api | null } = { api: null };
/** The switch on (constant: the bundler folds it): the fetch-ahead list of a page with `d` entries names the browser's
 * reader chunk (manifest `domData`). */
export const DOM_DATA_SERVER = false as boolean;
