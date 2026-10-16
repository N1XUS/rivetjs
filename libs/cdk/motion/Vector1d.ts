// Ported from embla-carousel (packages/embla-carousel/src/components/Vector1d.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: verbatim (TypeScript module specifiers, formatting); part of the DOM-agnostic `@rivetjs/cdk/motion` core.
import { isNumber } from "./utils.ts";

export type Vector1DType = {
  get: () => number;
  set: (n: Vector1DType | number) => void;
  add: (n: Vector1DType | number) => void;
  subtract: (n: Vector1DType | number) => void;
};

/** A mutable 1-D value (location, target, …) shared by reference between the motion parts. */
export function Vector1D(initialValue: number): Vector1DType {
  let value = initialValue;

  function get(): number {
    return value;
  }

  function set(n: Vector1DType | number): void {
    value = normalizeInput(n);
  }

  function add(n: Vector1DType | number): void {
    value += normalizeInput(n);
  }

  function subtract(n: Vector1DType | number): void {
    value -= normalizeInput(n);
  }

  function normalizeInput(n: Vector1DType | number): number {
    return isNumber(n) ? n : n.get();
  }

  const self: Vector1DType = {
    get,
    set,
    add,
    subtract,
  };
  return self;
}
