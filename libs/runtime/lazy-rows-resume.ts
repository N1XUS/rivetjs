// Lazy collection rows (LAZY-ROWS T5): the resume runtime's lazy rows factory slot. null here; builds with
// `rivet({ resume: { lazyRows: true } })` get `export { _lazyRows } from "./dom-resume-lazy.ts";` in its place (the
// compiler plugin, with `lazy-rows.ts`). A module of its own so other builds never reach `dom-resume-lazy.ts` (nor
// the modules it imports) at all: `dom-resume.ts` calls it only under `LAZY_ROWS`.
import type { _lazyRows as Factory } from "./dom-resume-lazy.ts";
export const _lazyRows = null as typeof Factory | null;
