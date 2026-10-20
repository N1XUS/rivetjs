// DOM-backed loader data (DOM-DATA): the server's build-time switch. `create` is null here; builds with
// `rivet({ resume: { domData: true } })` get `server-dom-data.ts` `_domRegistry` instead (the compiler plugin's `load`
// hook, `libs/compiler/vite.ts` `domDataSwitch`), so the registry and the `D` encoder ship only in those servers.
// Tests set `create` themselves.
import type { _domRegistry as Factory } from "./server-dom-data.ts";

export const domServer: { create: typeof Factory | null } = { create: null };
