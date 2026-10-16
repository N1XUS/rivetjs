// Ported from embla-carousel (packages/embla-carousel-class-names/src/components/utils.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts, formatting; `'embla-carousel'` imports / module augmentation → `../../engine/` files; otherwise verbatim.
import type { ClassNameOptionType } from "./Options.ts";

export function normalizeClassNames(classNames: ClassNameOptionType): string[] {
  const normalized = Array.isArray(classNames) ? classNames : [classNames];
  return normalized.filter(Boolean);
}

export function removeClass(node: HTMLElement, classNames: string[]): void {
  if (!node || !classNames.length) return;
  node.classList.remove(...classNames);
}

export function addClass(node: HTMLElement, classNames: string[]): void {
  if (!node || !classNames.length) return;
  node.classList.add(...classNames);
}
