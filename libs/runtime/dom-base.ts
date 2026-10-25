// DOM leaf helpers (moved out of `dom.ts`, ZERO R4 2026-10-25): boolean attribute names, default-property writes, the
// construction document, `prop:` writes. No module state but the running mount's container; `dom.ts` re-exports them. A
// leaf so the lite resume runtime (`dom-lite.ts`) and `dom-attr.ts` / `dom-events.ts` do not pull `dom.ts` (mount,
// structural components) into their chunk.
import { INVALID_URL, MEDIA_URLS, URLS, unsafeUrl } from "./url.ts";

// Boolean attributes (a regex literal: side-effect free, so unused copies tree-shake); = template.ts
// `booleanAttributes` and html.rs `BOOLEAN_ATTRIBUTES` (C4).
export const _booleans =
  /^(?:allowfullscreen|alpha|async|autofocus|autoplay|checked|controls|default|defer|disabled|disablepictureinpicture|disableremoteplayback|formnovalidate|hidden|inert|ismap|itemscope|loop|multiple|muted|nomodule|novalidate|open|playsinline|readonly|required|reversed|selected|shadowrootclonable|shadowrootdelegatesfocus|shadowrootserializable)$/;
/**
 * Runtime-private (DOM attribute writers): `defaultValue` / `defaultChecked` — React's uncontrolled
 * defaults — write the default property (an input's `value` / `checked` attribute, a textarea's
 * content), never an attribute of that name; null / undefined clear it. False when the element has no
 * such property (the caller writes the `value` / `checked` attribute instead, as the server).
 */
export function _writeDefault(el: Element, lower: string, value: unknown): boolean {
  const checked = lower === "defaultchecked";
  if (!((checked ? "defaultChecked" : "defaultValue") in el)) return false;
  if (checked) (el as HTMLInputElement).defaultChecked = !!value;
  else if (value == null && el.localName !== "textarea") el.removeAttribute("value");
  else (el as HTMLInputElement).defaultValue = value == null ? "" : String(value);
  return true;
}
/** @internal The container of the running mount / render (`dom.ts` `attach` sets it): its document constructs DOM. */
export const _root: { c: Element | DocumentFragment | null } = { c: null };
/** @internal The document DOM is constructed in: the running mount's, else the global document. */
export function _constructionDoc(): Document {
  return _root.c?.ownerDocument ?? document;
}
/** Compiler ABI: set an element property for `prop:name` (URL properties checked like URL attributes). */
export function _setProp(target: Element, name: string, value: unknown): void {
  const lower = name.toLowerCase();
  if (!/^[A-Za-z_$][\w$]*$/.test(name) || /^on|^(innerhtml|outerhtml|srcdoc|style|__proto__|constructor|prototype)$/.test(lower))
    throw TypeError("Unsafe property name");
  // A URL property set to an object (`new URL(…)`, a TrustedScriptURL) is checked as the string the
  // setter will see (SEC4); the object itself is still what gets assigned when safe.
  let url = value;
  if (value !== null && typeof value === "object" && URLS.has(lower))
    try {
      url = String(value);
    } catch {
      // No string form (a null-prototype object): not a URL the browser could navigate to.
    }
  (target as unknown as Record<string, unknown>)[name] =
    typeof url === "string" && unsafeUrl(lower, url, MEDIA_URLS.test(target.localName + " " + lower)) ? INVALID_URL : value;
}
