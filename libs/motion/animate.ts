// @rivetjs/motion/animate (spec D15): Motion's hybrid `animate` typed for Rivet. Targets also take `Ref<Element>`
// (`ref()`), accessors and arrays of them; sequences map their segment targets the same way. Browser only: a server
// call is a dev error (call it from a handler or a `clientEffect`). Hybrid weight (~17 KB br) only where imported.
import { animate as motionAnimate } from "motion";
import type { AnimationOptions, AnimationPlaybackControlsWithThen, DOMKeyframesDefinition, SequenceOptions } from "motion";
import { DEV } from "#dev";

export { spring, stagger } from "motion";
export type { AnimationOptions, AnimationPlaybackControlsWithThen, DOMKeyframesDefinition, SequenceOptions } from "motion";

type One = Element | string | null | undefined | (() => Element | null | undefined);
/** An element, a selector, a `ref()` / accessor, or a list of them. */
export type AnimateTarget = One | readonly One[];
/** A sequence segment: `[target, keyframes, options?]` (options may carry `at`) or a label string. */
export type Segment = string | readonly [AnimateTarget, DOMKeyframesDefinition, (AnimationOptions & { at?: number | string })?];

const one = (target: One): Element | string | undefined => (typeof target === "function" ? (target() ?? undefined) : (target ?? undefined));
const resolve = (target: AnimateTarget): (Element | string)[] => {
  const list = Array.isArray(target) ? target : [target];
  const out: (Element | string)[] = [];
  for (const item of list as One[]) {
    const value = one(item);
    if (value !== undefined) out.push(value);
  }
  return out;
};
const browser = (): boolean => {
  if (typeof window !== "undefined") return true;
  if (DEV) throw new Error("@rivetjs/motion/animate: browser only: call it from an event handler or a clientEffect");
  return false;
};
const NONE = { then: (resolve?: () => void) => Promise.resolve().then(resolve) } as unknown as AnimationPlaybackControlsWithThen;

/** Animate elements (Motion's DOM `animate`) or play a sequence. */
export function animate(target: AnimateTarget, keyframes: DOMKeyframesDefinition, options?: AnimationOptions): AnimationPlaybackControlsWithThen;
export function animate(sequence: readonly Segment[], options?: SequenceOptions): AnimationPlaybackControlsWithThen;
export function animate(
  target: AnimateTarget | readonly Segment[],
  keyframes?: DOMKeyframesDefinition | SequenceOptions,
  options?: AnimationOptions,
): AnimationPlaybackControlsWithThen {
  if (!browser()) return NONE;
  const isSequence =
    Array.isArray(target) && Array.isArray(target[0]) && target[0].length >= 2 && typeof target[0][1] === "object" && !Array.isArray(target[0][1]);
  if (isSequence) {
    const sequence = (target as readonly Segment[]).map((segment) =>
      typeof segment === "string" ? segment : ([resolve(segment[0]), segment[1], segment[2]] as const),
    );
    return motionAnimate(sequence as never, keyframes as SequenceOptions);
  }
  return motionAnimate(resolve(target as AnimateTarget) as never, keyframes as DOMKeyframesDefinition, options);
}
