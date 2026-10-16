// Ported from angular/components src/cdk/coercion (MIT, © Google LLC).
// Coerce loosely typed option values (attribute strings, numbers, refs) into the type a widget needs.
// Pure and server-safe.

/** Allowed values for a boolean option. */
export type BooleanInput = string | boolean | null | undefined;
/** Allowed values for a number option. */
export type NumberInput = string | number | null | undefined;

/** Coerces a data-bound value (typically a string) to a boolean: everything but `null`, `undefined`, `false` and `"false"` is true. */
export function coerceBooleanProperty(value: unknown): boolean {
  return value != null && `${value}` !== "false";
}

/** Coerces a data-bound value (typically a string) to a number; non-numbers give `fallbackValue` (default 0). */
export function coerceNumberProperty(value: unknown): number;
export function coerceNumberProperty<D>(value: unknown, fallback: D): number | D;
export function coerceNumberProperty(value: unknown, fallbackValue: unknown = 0): unknown {
  if (_isNumberValue(value)) return Number(value);
  return arguments.length === 2 ? fallbackValue : 0;
}

/**
 * Whether the provided value is considered a number. `parseFloat` rejects null / "" / booleans (where
 * `Number` gives 0) but accepts "123hello", which `Number` rejects: both must agree.
 */
export function _isNumberValue(value: unknown): boolean {
  return !isNaN(parseFloat(value as string)) && !isNaN(Number(value));
}

/** Wraps the provided value in an array, unless the provided value is an array. */
export function coerceArray<T>(value: T | T[]): T[];
export function coerceArray<T>(value: T | readonly T[]): readonly T[];
export function coerceArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

/** Coerces a value to a CSS pixel value: numbers get `px`, strings pass, `null` / `undefined` give "". */
export function coerceCssPixelValue(value: unknown): string {
  if (value == null) return "";
  return typeof value === "string" ? value : `${value}px`;
}

/**
 * Coerces a value to an array of trimmed non-empty strings. Non-arrays are stringified and split with
 * `separator` (default whitespace); `null` / `undefined` give `[]`.
 */
export function coerceStringArray(value: unknown, separator: string | RegExp = /\s+/): string[] {
  const result: string[] = [];
  if (value != null) {
    const sourceValues: unknown[] = Array.isArray(value) ? value : `${value}`.split(separator);
    for (const sourceValue of sourceValues) {
      const trimmed = `${sourceValue}`.trim();
      if (trimmed) result.push(trimmed);
    }
  }
  return result;
}

/** A Rivet element ref (`ref<T>()` / signal accessor) or the element itself (Angular: `ElementRef<T> | T`). */
export type ElementInput<T> = T | (() => T | undefined | null);

/**
 * Coerces a ref (accessor function such as `ref<T>()`) or an element into the element. Angular's
 * `ElementRef` maps to Rivet's ref accessor.
 */
export function coerceElement<T>(elementOrRef: ElementInput<T>): T {
  return (typeof elementOrRef === "function" ? (elementOrRef as () => T)() : elementOrRef) as T;
}

/**
 * Angular `coerceObservable` equivalent: a reactive accessor (signal / computed / `() => T`) passes
 * through, a plain value becomes a constant accessor. Functions are always treated as accessors.
 */
export function coerceAccessor<T>(data: T | (() => T)): () => T {
  return typeof data === "function" ? (data as () => T) : () => data;
}
