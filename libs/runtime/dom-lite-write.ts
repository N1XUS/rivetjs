// Lite runtime: attribute / property bindings with the full client write rules (URL checks, enumerated and form
// attributes; RT-DIET: a leaf of `dom-lite.ts` of its own — `dom-attr.ts` loads only for the residuals that need it).
import { write } from "./dom-attr.ts";
import { _setProp } from "./dom-base.ts";
import { effect } from "./dom-lite-core.ts";

/** A dynamic attribute (same write rules as a client render: booleans, URL checks, form properties). */
export const _la = (el: Element, name: string, fn: () => unknown): void => effect(() => write(el, name, fn()));
/** A dynamic DOM property (`prop:x`; same name / URL checks as a client render). */
export const _lp = (el: Element, name: string, fn: () => unknown): void => effect(() => _setProp(el, name, fn()));
