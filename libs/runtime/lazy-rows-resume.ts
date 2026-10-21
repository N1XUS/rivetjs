// Lazy collection rows (LAZY-ROWS T5): the resume runtime's lazy rows factory slot. null here; builds with
// `rivet({ resume: { lazyRows: true } })` get the opted-in content of `libs/compiler/switches.ts` in its place (the
// compiler plugin, with `lazy-rows.ts`): `_lazyLoad` imports `dom-resume-lazy.ts` — a chunk of its own (LAZY-BLOCKERS) —
// and `_lazyReady(load)`, which the resume entry awaits with its own `import()` of the chunk (a top-level await the plugin appends to it), sets `_lazyRows` to its
// factory when the page's state holds lazy row records (`L`, read through the loader's `document.$r`; the lazy add-on
// preloads the chunk). In the entry, not here: the lazy chunk imports the runtime's shared chunks, and a top-level await
// in a module it imports would never settle. A module of its own so other builds never reach `dom-resume-lazy.ts` (nor
// the modules it imports) at all: `dom-resume.ts` calls it only under `LAZY_ROWS`.
import type { _lazyRows as Factory } from "./dom-resume-lazy.ts";
export const _lazyRows = null as typeof Factory | null;
export const _lazyLoad = null as (() => Promise<{ _lazyRows: typeof Factory }>) | null;
export const _lazyReady = null as ((load?: () => Promise<{ _lazyRows: typeof Factory }>) => Promise<void> | undefined) | null;
