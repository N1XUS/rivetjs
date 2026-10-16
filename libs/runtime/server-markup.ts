// @rivetjs/runtime/server-markup — trusted framework markup for framework bridges (pay-per-use: server.ts never imports
// it). Underscore ABI: only `@rivetjs/bridge` calls it, with HTML a framework renderer escaped itself (React / Vue /
// Svelte / Solid / Preact SSR output). Apps have no raw-HTML sink; language-core RV2143 (planned, bridges T14) flags a
// user import.
import type { ServerValue } from "./server.ts";
import { template } from "./template.ts";

/**
 * @internal Bridge ABI: framework-rendered HTML written verbatim as one template fragment (the writer's existing
 * raw-fragment path: no new branch in the hot writer; resume marker strides reset after it, as after any runtime
 * template). XSS sink: `html` must be markup a framework renderer escaped; never pass user-controlled text.
 */
export function _markup(html: string): ServerValue {
  if (typeof html !== "string") throw new TypeError("_markup expects a string of trusted HTML");
  return template([html]);
}
