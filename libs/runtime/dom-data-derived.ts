// DOM data on derived (DERIVED-C5): the derived server's build-time switch. `api` is null here; builds with
// `rivet({ resume: { domData: true } })` get `server-derived-dom.ts` `_derivedDom` instead (the compiler
// plugin's `load` hook, `libs/compiler/vite.ts` `domDataSwitch`), so the list registry and the `d` encoder ship only in
// those servers. Tests set `api` themselves.
import type { _derivedDom as Api } from "./server-derived-dom.ts";

export const derivedDom: { api: typeof Api | null } = { api: null };
