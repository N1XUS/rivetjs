// Rivet-only (no HeroUI counterpart): color props handed to cdk color parts in their string form.
import { stringifyColor } from "@rivetjs/cdk/color";
import type { Color } from "@rivetjs/cdk/color";

const isColor = (v: unknown): v is Color => typeof v === "object" && v !== null && typeof (v as Color).getColorSpace === "function";

/**
 * A cdk color prop (`color`, `value`, `defaultValue`) as its lossless string form (`stringifyColor`: own color space, unrounded
 * channels): the cdk parts capture their props in resumable closures, and a `Color` instance is not serializable (the server render
 * fails on a resumed page). Signals / accessors (functions), strings and nullish values pass through.
 */
export function colorProp<T>(value: T): T {
  return (isColor(value) ? stringifyColor(value) : value) as T;
}

/** The passed (`!== undefined`) `keys` of `props` through `colorProp` (cdk tells controlled from uncontrolled by `!== undefined`). */
export function colorProps(props: object, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = (props as Record<string, unknown>)[key];
    if (value !== undefined) out[key] = colorProp(value);
  }
  return out;
}
