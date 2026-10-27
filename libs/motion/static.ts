// Build-time lowering of a CSS-only Motion element (MOTION-CSS, user ruling 2026-10-27: a CSS entrance ships 0 JS).
// `@rivetjs/compiler` (`static-motion.ts`) calls it at build time, in Node, for a `<Motion.<tag>>` call site whose props are
// constants and whose ancestors provide no Motion context (no `MotionConfig`, no variant parent, no presence scope): the
// call becomes the plain `<tag>` with these attributes, and the rule joins the module's CSS. Same code as the element
// (`element.tsx` `motionElement` with no config / parent / scope): final state inline, one `@keyframes` rule per distinct
// entrance (`css.ts` `entranceRule`), reduced motion in the same rule. Never imported by browser or server bundles.
import { entranceRule, type ReducedPolicy } from "./css.ts";
import { finalState, hybridReason, toStyle, type Target, type Transition } from "./values.ts";
import { mergeTransition } from "./variants.ts";

/** The props a static Motion element may have (constants; anything else keeps the component). */
export interface StaticMotionProps {
  initial?: Target | false;
  animate?: Target;
  transition?: Transition;
  reducedMotion?: ReducedPolicy;
}

/** What the plain element carries: its inline final state and, with an entrance, `data-mve` + the rule's CSS. */
export interface StaticMotion {
  style: Record<string, string>;
  mve?: string;
  css?: string;
}

const isTarget = (value: unknown): value is Target => value !== null && typeof value === "object" && !Array.isArray(value);
const POLICIES = new Set(["user", "always", "never"]);

/** The static form of a Motion element, or why it has none (a reason string: the call keeps the component). */
export function staticMotion(props: StaticMotionProps): StaticMotion | string {
  const { initial: start, animate, transition, reducedMotion } = props;
  if (animate !== undefined && !isTarget(animate)) return "`animate` is not a target (variant labels need the component)";
  if (start !== undefined && start !== false && !isTarget(start)) return "`initial` is not a target (variant labels need the component)";
  if (transition !== undefined && !isTarget(transition)) return "`transition` is not an object";
  if (reducedMotion !== undefined && !POLICIES.has(reducedMotion)) return "`reducedMotion` is not a policy";
  const initial = start === false ? undefined : start;
  const reason = (animate && hybridReason(animate, transition)) || (initial && hybridReason(initial));
  if (reason) return reason;
  const style = toStyle(finalState(animate, finalState(initial)));
  if (!initial || !animate) return { style };
  try {
    const rule = entranceRule(initial, animate, mergeTransition(undefined, transition, animate.transition), reducedMotion ?? "user");
    return rule ? { style, mve: rule.hash, css: rule.css } : { style };
  } catch (error) {
    return (error as Error).message;
  }
}
