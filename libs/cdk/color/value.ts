// Rivet plumbing for the color states (port of react-stately `useControlledState` semantics over signals).
// Not a port: the stored value is a color string (or a Color in a user-owned signal); Color class
// instances are not serializable, so uncontrolled state keeps `stringifyColor` strings.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { colorKey, stringifyColor, type Color } from "./color.ts";

/** A stored color value: a parseable string, a Color, or null / undefined (empty). */
export type ColorValue = string | Color | null | undefined;

/**
 * Controlled color input: a two-way signal (the state writes it), a read-only accessor (Rivet: a controlled value
 * that changes — the state only calls `onChange`, like a React controlled prop; ColorPicker provides one), or a
 * fixed plain value.
 */
export type ColorInput<T extends ColorValue = string | Color> = T | Signal<T> | (() => T);

export interface ColorCell<T extends ColorValue = ColorValue> {
  /** Value source; read with `read()` (a Signal when `writable`). */
  readonly read: () => T;
  /** Whether writes go to `read` (uncontrolled or a two-way signal). */
  readonly writable: boolean;
}

/** A controlled source that is read, not parsed: a Signal or an accessor. */
export const isColorSource = (v: unknown): v is () => ColorValue => typeof v === "function";

export const isSignal = <T>(v: unknown): v is Signal<T> => typeof v === "function" && typeof (v as Signal<T>).set === "function";

/** react-stately `useControlledState(value, defaultValue)`: controlled when `input !== undefined`. */
export function colorCell<T extends ColorValue>(input: ColorInput<T> | undefined, defaultValue: T): ColorCell<T> {
  if (input === undefined) {
    const initial = (defaultValue != null && typeof defaultValue !== "string" ? stringifyColor(defaultValue as Color) : defaultValue) as T;
    return { read: signal<T>(initial), writable: true };
  }
  if (isSignal<T>(input)) return { read: input, writable: true };
  if (typeof input === "function") return { read: input as () => T, writable: false };
  const fixed = (input != null && typeof input !== "string" ? stringifyColor(input as Color) : input) as T;
  return { read: signal<T>(fixed), writable: false };
}

/**
 * useControlledState `setValue`: no-op when the color is unchanged (same `colorKey`; upstream compares
 * object identity), else writes the cell (a Color into a signal holding a Color, otherwise the lossless
 * string) and calls `onChange`.
 */
export function writeColor<C extends Color | null>(cell: ColorCell, color: C, onChange: ((value: C) => void) | undefined): void {
  const current = untrack(cell.read);
  if (colorKey(current) === colorKey(color)) return;
  if (cell.writable) {
    const stored: ColorValue = color == null ? color : current != null && typeof current !== "string" ? color : stringifyColor(color);
    (cell.read as Signal<ColorValue>).set(stored);
  }
  onChange?.(color);
}
