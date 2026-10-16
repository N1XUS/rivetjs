// P3 type contract of signal / computed / effect (checked by the reactivity typecheck and by
// signal-types.test.ts under strict tsc). Every `@ts-expect-error` must stay an error.
import { computed, effect, signal, type Signal } from "../index.ts";

// Signal<T> is invariant: `set`/`update` are function properties, checked contravariantly.
const choice = signal<"a" | "b">("a");
// @ts-expect-error a Signal<"a" | "b"> is not a Signal<string> (it would accept set("zzz"))
export const widened: Signal<string> = choice;
// @ts-expect-error not one of the literal members
choice.set("zzz");
choice.set("b");
// Read-only consumers take the getter.
export const reader: () => string = choice;
// A Signal<string> is not a Signal<"a"> either.
// @ts-expect-error narrowing
export const narrowed: Signal<"a"> = signal("a" as string);

// `signal<T>()` without an initial value is `Signal<T | undefined>`.
const later = signal<number>();
export const maybe: number | undefined = later();
// @ts-expect-error the value may be undefined
export const definitely: number = later();

// `signal([])` is `unknown[]`, not `never[]`; annotate for anything better.
const empty = signal([]);
empty.set([1, "a"]);
export const items: unknown[] = empty();
const numbers = signal<number[]>([]);
numbers.set([1, 2]);
// @ts-expect-error elements are numbers
numbers.set(["a"]);

// Union-typed initial values need the annotation (the argument, not the target, infers T).
interface Point {
  x: number;
}
export const point: Signal<Point | null> = signal<Point | null>(null);
// @ts-expect-error inferred Signal<null>
export const pointInferred: Signal<Point | null> = signal(null);

// effect / computed of an async function: the result is the `AsyncFunctionNotAllowed` error type.
const n = signal(0);
effect(() => {
  n();
});
export const stop: () => void = effect(() => n());
const doubled = computed(() => n() * 2);
export const twice: number = doubled();
const asyncComputed = computed(async () => n());
// @ts-expect-error computed(async …) is not readable
asyncComputed();
const asyncEffect = effect(async () => {
  n();
});
// @ts-expect-error effect(async …) has no disposer
asyncEffect();
// @ts-expect-error a Promise-returning computed is rejected too
export const promised: () => Promise<number> = computed(() => Promise.resolve(1));
// `any` and `never` results stay usable.
declare const anything: any;
export const anyComputed: () => any = computed(() => anything);
export const throwing: () => never = computed((): never => {
  throw new Error("x");
});

// Generic callers keep working (no deferred conditional types in the parameter).
export function generic<T>(read: () => T, initial: T): [() => T, Signal<T>, () => void] {
  return [computed(() => read()), signal(initial), effect(() => read())];
}
