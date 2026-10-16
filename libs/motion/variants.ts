// Variants and gesture layers, pure (server + DOM). Priority follows framer-motion's `variantPriorityOrder`
// (`animate` < `whileInView` < `whileFocus` < `whileHover` < `whilePress` < `exit`; Rivet names `whileTap` `whilePress`).
import type { Target, Transition } from "./values.ts";

/** A target, a variant label, several labels, or a function of `custom`. */
export type Definition = Target | string | readonly string[] | ((custom: unknown) => Target);
export type Variants = Record<string, Target | ((custom: unknown) => Target)>;
export const LAYERS = ["animate", "whileInView", "whileFocus", "whileHover", "whilePress", "exit"] as const;
export type Layer = (typeof LAYERS)[number];

/** Resolve a definition against `variants` (labels merge left to right) and `custom`. */
export function resolveTarget(def: Definition | false | undefined, variants: Variants | undefined, custom: unknown): Target | undefined {
  if (def === undefined || def === false) return undefined;
  if (typeof def === "function") return def(custom);
  if (typeof def === "string" || Array.isArray(def)) {
    let out: Target | undefined;
    for (const label of typeof def === "string" ? [def] : (def as readonly string[])) {
      const v = variants?.[label];
      const target = typeof v === "function" ? v(custom) : v;
      if (target) out = { ...out, ...target, ...(out?.transition || target.transition ? { transition: { ...out?.transition, ...target.transition } } : {}) };
    }
    return out;
  }
  return def as Target;
}

/** Labels of a definition (variant propagation to children); undefined for targets / functions. */
export const labelsOf = (def: Definition | false | undefined): readonly string[] | undefined =>
  typeof def === "string" ? [def] : Array.isArray(def) ? (def as readonly string[]) : undefined;

/** The highest active layer's value per key, over `base` (the `animate` target). */
export function activeTarget(layers: Partial<Record<Layer, Target | undefined>>): Target {
  const out: Target = {};
  let transition: Transition | undefined;
  for (const layer of LAYERS) {
    const target = layers[layer];
    if (!target) continue;
    for (const key in target) if (key !== "transition") out[key] = target[key];
    if (target.transition) transition = target.transition;
  }
  if (transition) out.transition = transition;
  return out;
}

/** Keys a layer animates whose value must return to the next layer down when it ends. */
export function fallbackTarget(layers: Partial<Record<Layer, Target | undefined>>, ending: Layer, initial: Target | undefined): Target {
  const rest = { ...layers, [ending]: undefined };
  const target = activeTarget(rest);
  const leaving = layers[ending];
  // Keys only the ending layer set go back to `initial` (or stay: no value known).
  if (leaving) for (const key in leaving) if (key !== "transition" && !(key in target) && initial && key in initial) target[key] = initial[key];
  return target;
}

/** Transition precedence: value override > target `transition` > element `transition` > `MotionConfig` default. */
export function mergeTransition(config: Transition | undefined, element: Transition | undefined, target: Transition | undefined): Transition | undefined {
  if (!config && !element && !target) return undefined;
  return { ...config, ...element, ...target };
}
