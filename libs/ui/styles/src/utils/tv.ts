// Rivet-authored (NOT vendored from @heroui/styles; TWEAKS.md row): the `tv` every `*.styles.ts` definition imports.
// Same output as tailwind-variants' default `tv` (`twMerge: true`), but tailwind-merge only runs when a call passes a
// non-empty `class` / `className` override. The component's own class strings (base + variants + compounds) are joined
// (`tailwind-variants/lite`): merging them is a no-op for every vendored definition (tests/tv-merge.test.ts enumerates
// every definition × variant combination × slot, byte for byte), and skipping it skips tailwind-merge's lazy class-map
// build (≈ 1.6 ms on the first tv call of a page). With an override the joined core + override go through
// tailwind-merge exactly like upstream (`cn(core, class, className)`), so conflicting user utilities still dedupe.
// The public `tv` / `cn` (`../index.ts`, `@rivetjs/ui`) stay tailwind-variants' own.
import type {TV} from "tailwind-variants";

import {cn} from "tailwind-variants";
import {tv as tvJoin} from "tailwind-variants/lite";

type ClassProps = {class?: unknown; className?: unknown} | null | undefined;
type Resolver = ((props?: ClassProps) => unknown) & Record<string, unknown>;

// = tailwind-variants `hasClassOverride` (the condition its own override merge runs on).
const hasOverride = (props: ClassProps): boolean =>
  props != null && ((props.class != null && props.class !== "") || (props.className != null && props.className !== ""));

const mergeOverride = (joined: unknown, props: ClassProps): unknown => (hasOverride(props) ? cn(joined as string) : joined);

const METADATA = ["variantKeys", "extend", "base", "slots", "variants", "defaultVariants", "compoundSlots", "compoundVariants"];

export const tv = ((options: {slots?: unknown}, config?: {twMerge?: boolean; twMergeConfig?: object}) => {
  // Explicit configs (none in the vendored styles) keep upstream behaviour.
  if (config != null) return (tvJoin as unknown as (o: unknown, c: unknown) => unknown)(options, config);
  const inner = (tvJoin as unknown as (o: unknown) => Resolver)(options);
  let component: Resolver;
  if (options.slots === undefined) {
    component = ((props?: ClassProps) => mergeOverride(inner(props), props)) as Resolver;
  } else {
    // Slot results are cached by tv per variant fingerprint: wrap each result's slot functions once, in place.
    const wrapped = new WeakSet<object>();
    component = ((props?: ClassProps) => {
      const result = inner(props) as Record<string, (slotProps?: ClassProps) => unknown>;
      if (!wrapped.has(result)) {
        wrapped.add(result);
        for (const key in result) {
          const slot = result[key];
          result[key] = (slotProps?: ClassProps) => mergeOverride(slot(slotProps), slotProps);
        }
      }
      return result;
    }) as Resolver;
  }
  for (const key of METADATA) component[key] = inner[key];
  return component;
}) as unknown as TV;
