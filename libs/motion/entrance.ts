// Client-render entrances (spec D9): the generated rule in one constructable stylesheet (`engine.ts` `clientRule`).
// The tag components (`tags.tsx`) hand it to `motionElement`, so `css.ts` sits on the tags' graph only: a resumed page's
// gesture handlers (symbols of `element.tsx`) load without it.
import { entranceRule, type ReducedPolicy, type Stagger } from "./css.ts";
import { clientRule } from "./engine.ts";
import { cached, sig } from "./memo.ts";
import type { Target, Transition } from "./values.ts";

/** The entrance attributes of a client-rendered element (`data-mve`, the stagger index), or undefined (nothing moves). */
export function entrance(
  initial: Target,
  animate: Target,
  transition: Transition | undefined,
  reduced: ReducedPolicy,
  stagger: Stagger | undefined,
  index: number,
): Record<string, string> | undefined {
  const rule = cached("r" + sig(stagger), initial, animate, transition, reduced, stagger, entranceRule);
  if (!rule) return undefined;
  clientRule(rule.hash, rule.css);
  return stagger?.each ? { "data-mve": rule.hash, "--rv-mvi": String(index) } : { "data-mve": rule.hash };
}
export type Entrance = typeof entrance;
