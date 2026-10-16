// CSS lowering of entrances (spec D9, ruling 2026-10-11): `initial` → `animate` at mount plays as a CSS animation, with
// no JS. Server and client share it (server: rule in the head with the request nonce; client render: a constructable
// stylesheet). One rule per distinct entrance, named by a content hash; `prefers-reduced-motion` in the same CSS.
//
// Why `@keyframes` + `animation … backwards` and not `@starting-style`: the element carries its final state inline
// (visible and LCP-valid without CSS or JS), and an inline style beats any `@starting-style` rule in the cascade, while
// CSS animations sit above it. `backwards` (not `both`): the last keyframe equals the inline final state, and no
// forwards fill may outlive the entrance (it would override later inline values: JS animations, gestures).
//
// Two forms: `entranceRule` (one generated rule per distinct entrance, via the head sink / a constructable sheet) and
// `entranceVars` (inline custom properties for the static `entrance.css`, pages without a head sink).
//
// Springs: Motion's `spring` value (`transition={{ type: spring }}`, D4b; the string `"spring"` is an error) becomes a
// `linear()` easing sampled from the spring itself (`spring.applyToOptions`, as Motion's WAAPI path runs it: 10 ms points).
import { REDUCED_DROPS, cssKeyframes, cssProperty, finalState, transitionOf, type Easing, type Target, type Transition } from "./values.ts";

export type ReducedPolicy = "user" | "always" | "never";

const NATIVE: Record<string, string> = {
  linear: "linear",
  ease: "ease",
  easeIn: "ease-in",
  easeOut: "ease-out",
  easeInOut: "ease-in-out",
  circIn: "cubic-bezier(0, 0.65, 0.55, 1)",
  circOut: "cubic-bezier(0.55, 0, 1, 0.45)",
  backIn: "cubic-bezier(0.31, 0.01, 0.66, -0.59)",
  backOut: "cubic-bezier(0.33, 1.53, 0.69, 0.99)",
};

/** `linear(…)` points of `easing` over `duration` ms (Motion's `generateLinearEasing`, 10 ms resolution). */
export function linearEasing(easing: (t: number) => number, duration: number, resolution = 10): string {
  const n = Math.max(Math.round(duration / resolution), 2);
  let points = "";
  for (let i = 0; i < n; i++) points += (i ? ", " : "") + Math.round(easing(i / (n - 1)) * 10000) / 10000;
  return `linear(${points})`;
}

/** CSS easing for a Motion easing (names, cubic-bezier arrays, functions sampled over `duration` ms). */
export function cssEasing(ease: Easing | undefined, duration: number): string {
  if (ease === undefined) return NATIVE.easeOut!;
  if (typeof ease === "function") return linearEasing(ease, duration);
  if (Array.isArray(ease)) return `cubic-bezier(${ease.join(", ")})`;
  const name = ease as string;
  if (NATIVE[name]) return NATIVE[name];
  if (name === "circInOut") return linearEasing((p) => (p <= 0.5 ? circIn(2 * p) / 2 : (2 - circIn(2 * (1 - p))) / 2), duration);
  throw new Error(`@rivetjs/motion: easing "${name}" has no CSS form; use a cubic-bezier array or a function`);
}
const circIn = (p: number) => 1 - Math.sin(Math.acos(Math.min(1, Math.max(0, p))));

/** The error of a spring that is not Motion's `spring` value (engine.ts too). */
export const SPRING = `type: "spring" needs Motion's spring value: import { spring } from "@rivetjs/motion" and pass { type: spring }`;

export interface Timing {
  duration: number;
  delay: number;
  easing: string;
  iterations: number;
  direction: "normal" | "alternate";
}
type SpringValue = ((...args: never[]) => unknown) & { applyToOptions?: (o: Record<string, unknown>) => { ease: (p: number) => number; duration: number } };

/** CSS timing for a transition (ms); per-keyframe easings handled by the keyframes writer. */
export function cssTiming(t: Transition, frames: number): Timing {
  const delay = (t.delay ?? 0) * 1000;
  const iterations = t.repeat === undefined ? 1 : t.repeat === Infinity ? Infinity : t.repeat + 1;
  const direction = t.repeat && (t.repeatType === "reverse" || t.repeatType === "mirror") ? "alternate" : "normal";
  if ((t.type as unknown) === "spring" || typeof t.type === "function") {
    const apply = typeof t.type === "function" ? (t.type as SpringValue).applyToOptions : undefined;
    if (!apply) throw new Error(SPRING);
    // Motion's WAAPI layer passes milliseconds (mini converts the user's seconds first).
    const { type: _type, ...options } = t;
    const resolved = apply(options.duration !== undefined ? { ...options, duration: options.duration * 1000 } : { ...options });
    return {
      duration: resolved.duration,
      delay,
      easing: typeof resolved.ease === "function" ? linearEasing(resolved.ease, resolved.duration) : "linear",
      iterations,
      direction,
    };
  }
  const duration = (t.duration ?? (frames > 2 ? 0.8 : 0.3)) * 1000;
  const easing = Array.isArray(t.ease) && typeof t.ease[0] !== "number" ? "linear" : cssEasing(t.ease as Easing | undefined, duration);
  return { duration, delay, easing, iterations, direction };
}

/** FNV-1a 32 → base 36. */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/** A variant parent's orchestration for its children's entrances (ms): `start + index × each`. */
export interface Stagger {
  start: number;
  each: number;
}

export interface EntranceRule {
  /** Content hash: the element's `data-mve` value. */
  hash: string;
  /** Complete CSS (keyframes, the element rule, the reduced-motion override). */
  css: string;
}

interface Group {
  timing: Timing;
  times?: readonly number[];
  eases?: readonly Easing[];
  props: string[];
}
/** Keyframes per CSS property + the properties grouped by timing (one CSS animation per group). */
function entrance(initial: Target, animate: Target, transition: Transition | undefined) {
  const frames = cssKeyframes(animate, finalState(initial));
  const t = transition ?? (animate.transition as Transition | undefined);
  const groups = new Map<string, Group>();
  for (const property in frames) {
    const list = frames[property]!;
    if (list.every((v) => v === list[0])) continue; // nothing moves
    const own = transitionOf(t, animate, property);
    const timing = cssTiming(own, list.length);
    const eases = Array.isArray(own.ease) && typeof own.ease[0] !== "number" ? (own.ease as readonly Easing[]) : undefined;
    const key = JSON.stringify([timing, own.times, eases?.map((e) => (typeof e === "function" ? String(e) : e)), list.length]);
    let group = groups.get(key);
    if (!group) groups.set(key, (group = { timing, ...(own.times ? { times: own.times } : {}), ...(eases ? { eases } : {}), props: [] }));
    group.props.push(property);
  }
  return { frames, groups };
}

/**
 * The CSS entrance for `initial` → `animate` (undefined: nothing animates). Properties group by their resolved timing
 * (one `@keyframes` + one `animation` per group). `reduced` (Motion's reduced motion: transform / layout terms jump,
 * opacity / color still animate): `"user"` under `prefers-reduced-motion: reduce`, `"always"` regardless, `"never"` off.
 */
export function entranceRule(
  initial: Target,
  animate: Target,
  transition: Transition | undefined,
  reduced: ReducedPolicy = "user",
  stagger?: Stagger,
): EntranceRule | undefined {
  const { frames, groups } = entrance(initial, animate, transition);
  if (!groups.size) return undefined;
  const body = (suffix: string, keep: (property: string) => boolean): { keyframes: string; animation: string } => {
    let keyframes = "";
    const animations: string[] = [];
    let i = 0;
    for (const group of groups.values()) {
      const props = group.props.filter(keep);
      i++;
      if (!props.length) continue;
      const count = frames[props[0]!]!.length;
      const name = `rv-mve-@-${i}${suffix}`;
      let steps = "";
      for (let k = 0; k < count; k++) {
        const offset = group.times?.[k] ?? (count === 1 ? 1 : k / (count - 1));
        let decl = props.map((p) => `${p}:${frames[p]![k]}`).join(";");
        const ease = group.eases?.[k];
        if (ease !== undefined && k < count - 1) decl += `;animation-timing-function:${cssEasing(ease, group.timing.duration)}`;
        steps += `${Math.round(offset * 10000) / 100}%{${decl}}`;
      }
      keyframes += `@keyframes ${name}{${steps}}`;
      const { duration, delay, easing, iterations, direction } = group.timing;
      // Variant children: the parent's orchestration delay per child from its `--rv-mvi` index (one rule for all).
      const start = stagger
        ? stagger.each
          ? `calc(var(--rv-mvi,0)*${round(stagger.each)}ms + ${round(delay + stagger.start)}ms)`
          : `${round(delay + stagger.start)}ms`
        : `${round(delay)}ms`;
      animations.push(`${name} ${round(duration)}ms ${easing} ${start} ${iterations === Infinity ? "infinite" : iterations} ${direction} backwards`);
    }
    return { keyframes, animation: animations.join(",") };
  };
  // Reduced motion = Motion's semantics: transform / layout properties jump, the rest still animates.
  // `"always"` applies it regardless of the user preference; `"user"` under `prefers-reduced-motion`.
  const full = body("", reduced === "always" ? (p) => !REDUCED_DROPS.has(p) : () => true);
  if (!full.animation) return undefined;
  let css = full.keyframes + `[data-mve="@"]{animation:${full.animation}}`;
  if (reduced === "user") {
    const kept = body("r", (p) => !REDUCED_DROPS.has(p));
    css += `@media (prefers-reduced-motion:reduce){${kept.keyframes}[data-mve="@"]{animation:${kept.animation || "none"}}}`;
  }
  const hash = hashText(css);
  return { hash, css: css.replaceAll("@-", hash + "-").replaceAll('"@"', `"${hash}"`) };
}

/** Keyframes names of `entrance.css` per CSS property (the custom-property form). */
const VAR_NAMES: Record<string, string> = { opacity: "o", translate: "t", scale: "s", rotate: "r" };
/**
 * The custom-property form of an entrance (`@rivetjs/motion/entrance.css`, pages without a head sink): inline
 * `--rv-mve-*` declarations for `[data-mvv]`. Covers two-frame entrances of opacity / translate / scale / rotate
 * with one play each (any timing per property); undefined when nothing moves, a reason string when the form
 * cannot express it (the element then renders its final state; dev warning).
 */
export function entranceVars(
  initial: Target,
  animate: Target,
  transition: Transition | undefined,
  reduced: ReducedPolicy = "user",
  extraDelay = 0,
): Record<string, string> | string | undefined {
  const { frames, groups } = entrance(initial, animate, transition);
  if (!groups.size) return undefined;
  const style: Record<string, string> = {};
  const names: string[] = [],
    durations: string[] = [],
    easings: string[] = [],
    delays: string[] = [],
    // Under prefers-reduced-motion ("user"): opacity alone, with its own timing lists (aligned with `nr`).
    reducedTiming: string[][] = [[], [], [], []];
  for (const group of groups.values())
    for (const property of group.props) {
      const id = VAR_NAMES[property];
      if (!id) return `\`${property}\` needs the generated entrance rule (a head sink: @rivetjs/router with @rivetjs/kit)`;
      const list = frames[property]!;
      const { duration, delay, easing, iterations, direction } = group.timing;
      if (list.length !== 2 || iterations !== 1 || direction !== "normal" || group.eases)
        return "keyframe arrays / repeats need the generated entrance rule (a head sink)";
      if (reduced === "always" && REDUCED_DROPS.has(property)) continue;
      style["--rv-mve-" + id] = list[0]!;
      names.push("rv-mve-" + id);
      durations.push(round(duration) + "ms");
      easings.push(easing);
      delays.push(round(delay + extraDelay) + "ms");
      if (!REDUCED_DROPS.has(property)) {
        reducedTiming[0]!.push("rv-mve-" + id);
        reducedTiming[1]!.push(round(duration) + "ms");
        reducedTiming[2]!.push(easing);
        reducedTiming[3]!.push(round(delay + extraDelay) + "ms");
      }
    }
  if (!names.length) return undefined;
  style["--rv-mve-n"] = names.join(",");
  const [kept, d, e, l] = reducedTiming as [string[], string[], string[], string[]];
  if (reduced !== "user") style["--rv-mve-nr"] = names.join(",");
  else if (kept.length) style["--rv-mve-nr"] = kept.join(",");
  style["--rv-mve-d"] = durations.join(",");
  style["--rv-mve-e"] = easings.join(",");
  style["--rv-mve-l"] = delays.join(",");
  // The reduced lists' own timings, only when they differ from the full lists (fewer names: opacity among others).
  if (reduced === "user" && kept.length && kept.length !== names.length) {
    style["--rv-mve-dr"] = d.join(",");
    style["--rv-mve-er"] = e.join(",");
    style["--rv-mve-lr"] = l.join(",");
  }
  return style;
}
const round = (ms: number) => Math.round(ms * 100) / 100;

/** The CSS property names an entrance animates (reduced-motion tests, docs). */
export const entranceProperties = (animate: Target): string[] => [
  ...new Set(
    Object.keys(animate)
      .filter((k) => k !== "transition")
      .map(cssProperty),
  ),
];
