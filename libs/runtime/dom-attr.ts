// Attribute writes (moved out of `dom-v2.ts`, ZERO R4 2026-10-25): the one client rule for attribute values (booleans,
// enumerated `hidden` / `popover`, URL checks, form-control properties). A leaf module for the lite resume runtime
// (`dom-lite.ts` `_la`); `dom-v2.ts` re-exports `_attrValue` and uses `write` / `coerce` itself.
import { _bindingEffect } from "@rivetjs/reactivity";
import { INVALID_URL, MEDIA_URLS, unsafeUrl } from "./url.ts";
import { _booleans, _writeDefault } from "./dom-base.ts";

const HTML = "http://www.w3.org/1999/xhtml";
export const unsupported = (): never => {
  throw TypeError("Unsupported DOM child value");
};
export const coerce = (v: unknown): string => (v == null || typeof v === "boolean" ? "" : typeof v === "symbol" ? unsupported() : String(v));
/** Write one attribute value (null/false remove, URL checks, control properties). */
export function write(el: Element, name: string, value: unknown): void {
  let lower = name.toLowerCase();
  const html = el.namespaceURI === HTML;
  // `defaultValue` / `defaultChecked`: the default property; without one, the attribute it stands for (server parity).
  if (html && (lower === "defaultvalue" || lower === "defaultchecked")) {
    if (_writeDefault(el, lower, value)) return;
    name = lower = lower.slice(7);
  }
  // `popover` is enumerated: `true` is the empty keyword (`auto`), `false` removes it (server parity, C4).
  if (html && lower === "popover" && typeof value === "boolean") value = value ? "" : null;
  const // `hidden` is enumerated (`until-found`): a non-empty string is its keyword, written verbatim; "" omits it (server parity).
    word = lower === "hidden" && typeof value === "string",
    bool = html && _booleans.test(lower) && !(word && value);
  if (html && (lower === "value" || lower === "checked" || lower === "selected") && lower in el) {
    const next = lower === "value" ? coerce(value) : Boolean(value);
    if ((el as unknown as Record<string, unknown>)[lower] !== next) (el as unknown as Record<string, unknown>)[lower] = next;
  }
  // Boolean attributes follow truthiness (`0`, `""`, `NaN` remove them), like the server.
  if (value == null || (bool && (!value || word))) {
    if (name.startsWith("xlink:")) el.removeAttributeNS("http://www.w3.org/1999/xlink", name.slice(6));
    else el.removeAttribute(name);
    if (bool && lower in el) (el as unknown as Record<string, unknown>)[lower] = false;
    return;
  }
  let encoded = bool ? "" : String(value);
  if (unsafeUrl(lower, encoded, html && MEDIA_URLS.test(el.localName + " " + lower))) encoded = INVALID_URL;
  if (name.startsWith("xlink:")) el.setAttributeNS("http://www.w3.org/1999/xlink", name, encoded);
  else if (name.startsWith("xml:")) el.setAttributeNS("http://www.w3.org/XML/1998/namespace", name, encoded);
  else el.setAttribute(name, encoded);
  if (bool && lower in el) (el as unknown as Record<string, unknown>)[lower] = true;
}
/** Compiler ABI: an identifier-only attribute value: written once unless it is an accessor. */
export function _attrValue(el: Element, name: string, value: unknown): void {
  if (typeof value === "function") _bindingEffect(() => write(el, name, (value as () => unknown)()));
  else write(el, name, value);
}
