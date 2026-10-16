// Motion values → CSS, pure and target-independent (server markup, CSS entrances and the WAAPI engine share it).
//
// Independent transforms map to the CSS individual transform properties, which WAAPI animates on the compositor:
//   x / y / z → `translate: <x> <y> <z>`, scale / scaleX / scaleY → `scale`, rotate / rotateZ → `rotate`.
// A partial target (only `x`) keeps the other axes from the element's current motion state. Values the WAAPI path
// cannot express (3D rotations, skew, SVG path drawing, objects) get `hybridReason`: callers raise a dev error that
// names `animate` from `@rivetjs/motion/animate` (spec D4).

export type Primitive = number | string;
/** One value: final value or keyframes (`null` = the current value, first keyframe only). */
export type ValueTarget = Primitive | readonly (Primitive | null)[];
export type Easing = string | readonly [number, number, number, number] | ((t: number) => number);

/** Motion transition options (subset the WAAPI path and CSS entrances support; times in seconds like Motion). */
export interface Transition {
  /** `"tween"` (default) or Motion's `spring` generator value (`import { spring } from "@rivetjs/motion"`; entrances:
   * lowered to a CSS `linear()` easing). */
  type?: "tween" | "keyframes" | ((...args: never[]) => unknown);
  duration?: number;
  delay?: number;
  ease?: Easing | readonly Easing[];
  times?: readonly number[];
  repeat?: number;
  repeatType?: "loop" | "reverse" | "mirror";
  bounce?: number;
  visualDuration?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
  velocity?: number;
  restSpeed?: number;
  restDelta?: number;
  /** Variants: delay before children start (seconds, or a `stagger(…)` function). */
  delayChildren?: number | ((index: number, total: number) => number);
  /** Variants: delay between children (seconds). */
  staggerChildren?: number;
  /** Per-value overrides (`{ opacity: { duration: 0.1 } }`). */
  [value: string]: unknown;
}

/** A target: motion values plus an optional `transition`. */
export interface Target {
  transition?: Transition;
  [value: string]: ValueTarget | Transition | undefined;
}

/** Final motion values per key (`x`, `opacity`, `--tint`, …). */
export type MotionState = Record<string, Primitive>;

const TRANSLATE = ["x", "y", "z"] as const;
const SCALE = ["scale", "scaleX", "scaleY"] as const;
const ROTATE = ["rotate", "rotateZ"] as const;
/** Keys only the hybrid engine animates. */
const HYBRID = new Set([
  "rotateX",
  "rotateY",
  "skew",
  "skewX",
  "skewY",
  "transformPerspective",
  "pathLength",
  "pathOffset",
  "pathSpacing",
  "originX",
  "originY",
  "originZ",
]);
/** Numeric values without a unit. */
const UNITLESS = new Set([
  "opacity",
  "zIndex",
  "fillOpacity",
  "strokeOpacity",
  "flex",
  "flexGrow",
  "flexShrink",
  "order",
  "fontWeight",
  "lineHeight",
  "aspectRatio",
  "scale",
  "scaleX",
  "scaleY",
]);

/** The CSS property a motion key animates (`x` → `translate`, `backgroundColor` → `background-color`). */
export function cssProperty(key: string): string {
  if (key === "x" || key === "y" || key === "z") return "translate";
  if (key === "scale" || key === "scaleX" || key === "scaleY") return "scale";
  if (key === "rotate" || key === "rotateZ") return "rotate";
  if (key.startsWith("--")) return key;
  let name = kebab.get(key);
  if (name === undefined) kebab.set(key, (name = key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())));
  return name;
}
// Value keys repeat per element (server lists): the camelCase → kebab-case replace once per key (bounded by the CSS
// properties a page animates; custom properties pass through above).
const kebab = new Map<string, string>();

/** A value with Motion's default unit (`px`; `deg` for rotations; none for unitless keys and CSS variables). */
export function withUnit(key: string, value: Primitive): string {
  if (typeof value !== "number") return value;
  if (key === "rotate" || key === "rotateZ") return value + "deg";
  return UNITLESS.has(key) || key.startsWith("--") ? String(value) : value + "px";
}

const last = (value: ValueTarget): Primitive | null =>
  Array.isArray(value) ? ((value as readonly (Primitive | null)[]).at(-1) ?? null) : (value as Primitive);
const isValueKey = (key: string) => key !== "transition" && key !== "transitionEnd";

/** Why `target` needs the hybrid engine (undefined: the WAAPI / CSS path can run it). */
export function hybridReason(target: Target, transition?: Transition): string | undefined {
  for (const key in target) {
    if (!isValueKey(key)) continue;
    const value = target[key];
    if (value === undefined) continue;
    if (HYBRID.has(key)) return `\`${key}\` needs the hybrid engine: use animate() from "@rivetjs/motion/animate" in a handler or clientEffect`;
    const ok = (v: unknown) => v === null || typeof v === "number" || typeof v === "string";
    if (!(Array.isArray(value) ? value.every(ok) : ok(value)))
      return `\`${key}\`: only numbers, strings and keyframe arrays animate here; use animate() from "@rivetjs/motion/animate" for objects`;
  }
  const t = transition ?? target.transition;
  if (t) {
    // One transition per CSS property: x and y (one `translate`) with different overrides cannot run on WAAPI.
    for (const group of [TRANSLATE, SCALE, ROTATE] as readonly (readonly string[])[]) {
      const own = group.filter((key) => key in target && t[key] !== undefined);
      if (own.length > 1 && own.some((key) => JSON.stringify(t[key]) !== JSON.stringify(t[own[0]!])))
        return `${own.join(" / ")} have different transitions but animate one CSS property (${cssProperty(own[0]!)}); use animate() from "@rivetjs/motion/animate"`;
    }
  }
  return undefined;
}

/** `previous` with the final values of `target` merged in (a new object). */
export function finalState(target: Target | undefined, previous?: MotionState): MotionState {
  const state: MotionState = { ...previous };
  if (target)
    for (const key in target) {
      if (!isValueKey(key)) continue;
      const value = target[key] as ValueTarget | undefined;
      if (value === undefined) continue;
      const end = last(value);
      if (end !== null) state[key] = end;
    }
  return state;
}

/** One frame's CSS for the transform groups + plain keys of `state` (CSS property → value). */
export function toStyle(state: MotionState): Record<string, string> {
  const style: Record<string, string> = {};
  for (const key in state) {
    if ((TRANSLATE as readonly string[]).includes(key) || (SCALE as readonly string[]).includes(key) || (ROTATE as readonly string[]).includes(key)) continue;
    style[cssProperty(key)] = withUnit(key, state[key]!);
  }
  const translate = translateOf(state);
  if (translate !== undefined) style.translate = translate;
  const scale = scaleOf(state);
  if (scale !== undefined) style.scale = scale;
  const rotate = state.rotateZ ?? state.rotate;
  if (rotate !== undefined) style.rotate = withUnit("rotate", rotate);
  return style;
}

function translateOf(state: MotionState): string | undefined {
  if (state.x === undefined && state.y === undefined && state.z === undefined) return undefined;
  const x = withUnit("x", state.x ?? 0);
  const y = withUnit("y", state.y ?? 0);
  return state.z !== undefined ? `${x} ${y} ${withUnit("z", state.z)}` : `${x} ${y}`;
}
function scaleOf(state: MotionState): string | undefined {
  if (state.scale === undefined && state.scaleX === undefined && state.scaleY === undefined) return undefined;
  const s = Number(state.scale ?? 1);
  const sx = s * Number(state.scaleX ?? 1);
  const sy = s * Number(state.scaleY ?? 1);
  return sx === sy ? String(sx) : `${sx} ${sy}`;
}

/**
 * WAAPI / CSS keyframes per CSS property for animating `target` from `from` (the current motion state). Transform
 * groups compose per frame: a key without its own keyframes holds its `from` value. `null` (or a single value) starts
 * at `from`; a missing `from` value starts at the key's identity (0, scale 1).
 */
export function cssKeyframes(target: Target, from: MotionState): Record<string, string[]> {
  const frames: Record<string, string[]> = {};
  const groups: Record<string, string[]> = {};
  for (const key in target) {
    if (!isValueKey(key) || target[key] === undefined) continue;
    (groups[cssProperty(key)] ??= []).push(key);
  }
  for (const property in groups) {
    const keys = groups[property]!;
    const series = keys.map((key) => {
      const value = target[key] as ValueTarget;
      const list = Array.isArray(value) ? [...(value as readonly (Primitive | null)[])] : [null, value as Primitive];
      if (list.length === 1) list.unshift(null);
      return list.map((v) => (v === null ? (from[key] ?? identity(key)) : v));
    });
    const length = Math.max(...series.map((s) => s.length));
    const out: string[] = [];
    for (let i = 0; i < length; i++) {
      const frame: MotionState = { ...from };
      keys.forEach((key, k) => {
        const s = series[k]!;
        // Shorter series (a group mixing 2-frame and n-frame keys): spread over the frames.
        frame[key] = s.length === length ? s[i]! : s[Math.round((i / (length - 1)) * (s.length - 1))]!;
      });
      out.push(styleOf(property, frame, keys[0]!));
    }
    frames[property] = out;
  }
  return frames;
}

const identity = (key: string): Primitive => ((SCALE as readonly string[]).includes(key) ? 1 : 0);
function styleOf(property: string, frame: MotionState, key: string): string {
  if (property === "translate") return translateOf(frame)!;
  if (property === "scale") return scaleOf(frame)!;
  if (property === "rotate") return withUnit("rotate", frame.rotateZ ?? frame.rotate ?? 0);
  return withUnit(key, frame[key]!);
}

/** Per-property transition: the value override (`transition.x` for `translate`) over the shared options. */
export function transitionOf(transition: Transition | undefined, target: Target, property: string): Transition {
  const base: Transition = {};
  if (transition) for (const key in transition) if (!isTransitionValueKey(transition, key)) base[key] = transition[key];
  if (transition)
    for (const key in target) {
      if (isValueKey(key) && cssProperty(key) === property && transition[key] && typeof transition[key] === "object")
        return { ...base, ...(transition[key] as Transition) };
    }
  return base;
}
const OPTION_KEYS = new Set([
  "type",
  "duration",
  "delay",
  "ease",
  "times",
  "repeat",
  "repeatType",
  "repeatDelay",
  "bounce",
  "visualDuration",
  "stiffness",
  "damping",
  "mass",
  "velocity",
  "restSpeed",
  "restDelta",
  "delayChildren",
  "staggerChildren",
  "when",
]);
const isTransitionValueKey = (transition: Transition, key: string) =>
  !OPTION_KEYS.has(key) && typeof transition[key] === "object" && !Array.isArray(transition[key]);

/** CSS declarations text for a style record (`a:b;c:d`). */
export function styleText(style: Record<string, string>): string {
  let out = "";
  for (const property in style) out += (out ? ";" : "") + property + ":" + style[property];
  return out;
}

/** Transform-like CSS properties `reducedMotion: "user"` drops (Motion React: transform and layout animations). */
export const REDUCED_DROPS = new Set(["translate", "scale", "rotate", "transform", "width", "height", "top", "left", "right", "bottom", "inset"]);
