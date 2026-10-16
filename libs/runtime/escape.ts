// HTML escaping: the one implementation behind server rendering (template.ts / server.ts), router
// head tags and adapters, and dev pages (`@rivetjs/runtime/escape`). Dependency-free, so importing it
// pulls nothing else into a bundle.
import type { Coercible } from "./template.ts";

const TEXT_ESCAPE = /[&<>]/g;
const ATTRIBUTE_ESCAPE = /[&<>"']/g;
// Non-global twins: a match test is cheaper than replace() on the common clean string.
/** Matches a character `escapeText` rewrites (a clean string needs no copy). */
export const TEXT_SPECIAL = /[&<>]/;
const ATTRIBUTE_SPECIAL = /[&<>"']/;
const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const replacement = (character: string): string => ESCAPES[character]!;
/** Escape untrusted text (element content); attribute quotes are escaped only in attribute context. */
export function escapeText(value: Coercible): string {
  value = String(value);
  return TEXT_SPECIAL.test(value) ? value.replace(TEXT_ESCAPE, replacement) : value;
}
/** Escape a quoted HTML attribute value (either quote style: `"` and `'` both escaped). */
export function escapeAttribute(value: Coercible): string {
  value = String(value);
  return ATTRIBUTE_SPECIAL.test(value) ? value.replace(ATTRIBUTE_ESCAPE, replacement) : value;
}
