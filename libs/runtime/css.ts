// Scoped styles: css`` blocks compile away (class names inline into templates, CSS extracts to a
// stylesheet); `cx` joins class names at runtime.
import { classNames } from "./style.ts";
import type { ClassValue } from "./style.ts";
export type { ClassValue, StyleObject } from "./style.ts";

/** Class map of a css`` block: local name → scoped class name. */
export type ClassMap = Readonly<Record<string, string>>;

/**
 * Scoped stylesheet as a tagged template at module top level: `const s = css\`.card { … }\``.
 * The compiler (`rivet()` Vite plugin) replaces it with a frozen class map and extracts the CSS;
 * calling it at runtime means the module was not compiled with styles enabled.
 */
export function css(_strings: TemplateStringsArray, ..._values: never[]): ClassMap {
  throw new Error("css``: this module was not compiled by the Rivet Vite plugin (rivet() from @rivetjs/compiler/vite)");
}

/**
 * Join class names, skipping falsy parts: `cx(s.card, active && s.active, props.class)`. Arrays and
 * `{ name: condition }` objects are flattened like `class={…}` objects / arrays.
 */
export function cx(...parts: ClassValue[]): string {
  return classNames(parts);
}
