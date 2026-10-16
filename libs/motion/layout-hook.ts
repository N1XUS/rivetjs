// The core's link to `@rivetjs/motion/layout` (filled when that module is evaluated): a Motion element with `layoutId`
// takes the box of the element it replaces at creation (`from`) and plays the shared-element FLIP after mount
// (`play`). Without `/layout` in the bundle both stay unset and `layoutId` only writes its attribute.
import type { ReducedPolicy } from "./css.ts";
import type { Transition } from "./values.ts";

export interface LayoutHook {
  from?(id: string): DOMRect | undefined;
  gone?(id: string, el: Element | undefined): void;
  play?(el: Element, from: DOMRect, type: string, transition: Transition | undefined, reduced: ReducedPolicy): void;
}
export const layoutHook: LayoutHook = {};
