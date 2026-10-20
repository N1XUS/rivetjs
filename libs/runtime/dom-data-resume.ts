// DOM-backed loader data (DOM-DATA): the resume runtime's DOM tree reader slot. null here; builds with
// `rivet({ resume: { domData: true } })` get `export { _domData } from "./dom-resume-data.ts";` in its place (the
// compiler plugin, with `dom-data.ts`). `dom-resume.ts` calls it only under `DOM_DATA`.
import type { _domData as Factory } from "./dom-resume-data.ts";
export const _domData = null as typeof Factory | null;
