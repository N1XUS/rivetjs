// Lite runtime: the light attribute bindings the compiler picks by name (RT-DIET; a leaf of `dom-lite.ts`, see
// `dom-lite-core.ts`): `class`, plain attributes, boolean attributes. URL-bearing / enumerated / form-value attributes
// go through `_la` (`dom-lite-write.ts`).
import { effect } from "./dom-lite-core.ts";

/** A dynamic `class` (`_className` semantics: null / false / "" remove the attribute). */
export const _lk = (el: Element, fn: () => unknown): void =>
  effect(() => {
    const v = fn();
    v == null || v === false || v === "" ? el.removeAttribute("class") : (el.className = v as string);
  });
/** A dynamic plain attribute (`_attrSet` semantics: null / undefined remove it, anything else is its text). */
export const _lq = (el: Element, name: string, fn: () => unknown): void =>
  effect(() => {
    const v = fn();
    v == null ? el.removeAttribute(name) : el.setAttribute(name, v as string);
  });
/** A dynamic boolean attribute of an HTML element (`name` lower case; truthiness, and its property when it has one). */
export const _lb = (el: Element, name: string, fn: () => unknown): void =>
  effect(() => {
    const on = !!fn();
    el.toggleAttribute(name, on);
    if (name in el) (el as unknown as Record<string, boolean>)[name] = on;
  });
