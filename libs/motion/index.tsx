// @rivetjs/motion: Motion (motion.dev) on Rivet signals. Spec docs/design/specs/2026-10-11-motion-design.md,
// plan docs/design/plans/2026-10-11-motion.md.
//
// `<Motion.div>` / `<Motion.button>` / `<Motion.svg>`, …: the `Motion` namespace of tag components (`tags.tsx`, one
// compiled element per tag over `motionElement` in `element.tsx`; namespace member access tree-shakes, so a bundle
// carries the tags it uses). `<MotionElement as="…">` looks the tag up in the namespace (it brings every tag).
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { splitProps } from "@rivetjs/runtime/props";
import * as tags from "./tags.tsx";
import type { MotionTagProps } from "./element.tsx";

export * as Motion from "./tags.tsx";
export { MotionConfig, type MotionProps, type MotionTagProps, type Viewport } from "./element.tsx";
export type { Definition, Variants } from "./variants.ts";
export type { Easing, Target, Target as MotionTarget, Transition, ValueTarget } from "./values.ts";
export type { ReducedPolicy } from "./css.ts";
export { spring, stagger } from "motion";

/** Tags `Motion` has (`tags.tsx`). */
export type MotionTag = keyof typeof tags;
export type MotionElementProps<T extends MotionTag> = { as: T } & MotionTagProps<T>;

/** `<Motion.<as>>` for a tag chosen by value (every tag of `Motion` ships with it: prefer `Motion.<tag>`). */
export function MotionElement<T extends MotionTag>(props: MotionElementProps<T>): JSX.Element {
  const [own, rest] = splitProps(props as { as: T }, ["as"]);
  return (tags[own.as] as (props: object) => JSX.Element)(rest);
}
