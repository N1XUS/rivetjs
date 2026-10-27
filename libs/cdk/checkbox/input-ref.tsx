// `mergeInputRefs` (checkbox / switch / radio parts), split out of `./behaviour.tsx` (BIG-UI leaf: importers that only merge refs do
// not ship the toggle behaviour). `.tsx` (no JSX): imports `@rivetjs/runtime/dom`.
// Ported from react-aria `useObjectRef(mergeRefs(…))` (packages/react-aria/src/utils), Apache-2.0, © Adobe.
import { ref as createRef } from "@rivetjs/runtime/dom";
import type { InputRef } from "./behaviour.tsx";

/**
 * One input ref from the component's own ref and the user's (`inputRef` prop, context `inputRef`): a
 * callback ref for the element that is also readable (`ref()` → the element), like RA `useObjectRef(mergeRefs(…))`.
 */
export function mergeInputRefs(
  ...refs: (InputRef | ((el: HTMLInputElement | null) => unknown) | { current: HTMLInputElement | null } | undefined)[]
): InputRef {
  const own = createRef<HTMLInputElement>();
  const targets = refs.filter((r) => r != null);
  if (!targets.length) return own;
  const merged = (...args: [HTMLInputElement | null]) => {
    if (!args.length) return own();
    const el = args[0];
    (own as unknown as { set(v: HTMLInputElement | undefined): void }).set(el ?? undefined);
    for (const target of targets) {
      if (typeof target === "function") {
        const signalRef = target as { set?: (value: HTMLInputElement | undefined) => void };
        if (signalRef.set) signalRef.set(el ?? undefined);
        else (target as (el: HTMLInputElement | null) => unknown)(el);
      } else target.current = el;
    }
  };
  return merged as unknown as InputRef;
}
