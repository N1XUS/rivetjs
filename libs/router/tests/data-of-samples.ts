// Loader-data samples with the `DataOf` serializability verdict pinned at the type level (router
// typecheck + tests/data-of.test.ts strict tsc): changing `Leaf`/`Serializable` in ../index.ts flips a
// verdict here and fails to compile. data-of.test.ts checks every verdict against the resume encoder.
import type { DataOf, NotSerializable } from "../index.ts";

type Accepts<T> = DataOf<() => T> extends NotSerializable<unknown> ? false : true;

class Model {
  n = 1;
  get(): number {
    return this.n;
  }
}
class Fields {
  n = 1;
}
class AppError extends Error {}

export const samples = {
  string: "a",
  number: 1,
  nan: Number.NaN,
  boolean: true,
  bigint: 1n,
  null: null,
  undefined: undefined,
  date: new Date(0),
  url: new URL("https://rivet.test/a?b=1"),
  map: new Map<string, number>([["a", 1]]),
  set: new Set(["a"]),
  array: [1, "a", null],
  nested: { a: [{ b: new Date(0), c: new Map([[1, new Set([new URL("https://rivet.test/")])]]) }] },
  nameMessage: { name: "n", message: "m" },
  nameMessageFunction: { name: "n", message: "m", f: () => 1 },
  symbol: Symbol("x"),
  objectWithSymbol: { s: Symbol("x") },
  regexp: /x/g,
  error: new Error("x"),
  typeError: new TypeError("x"),
  searchParams: new URLSearchParams("a=1"),
  bytes: new Uint8Array([1, 2]),
  buffer: new ArrayBuffer(2),
  dataView: new DataView(new ArrayBuffer(2)),
  errorSubclass: new AppError("x"),
  function: () => 1,
  mapOfFunctions: new Map([["a", () => 1]]),
  classWithMethod: new Model(),
  fieldOnlyClass: new Fields(),
};

type Verdicts = { [K in keyof typeof samples]: Accepts<(typeof samples)[K]> };
export const typeVerdicts: Verdicts = {
  string: true,
  number: true,
  nan: true,
  boolean: true,
  bigint: true,
  null: true,
  undefined: true,
  date: true,
  url: true,
  map: true,
  set: true,
  array: true,
  nested: true,
  nameMessage: true,
  nameMessageFunction: false,
  symbol: false,
  objectWithSymbol: false,
  regexp: true,
  error: true,
  typeError: true,
  searchParams: true,
  bytes: true,
  buffer: true,
  dataView: true,
  function: false,
  mapOfFunctions: false,
  classWithMethod: false,
  // Structural typing cannot tell a methodless class instance from a plain object: the type accepts it,
  // the encoder rejects it (known gap, data-of.test.ts `TYPE_GAPS`).
  fieldOnlyClass: true,
  // Same for Error subclasses: structurally an Error, but the encoder only writes the global constructors'
  // own prototypes (known gap, `TYPE_GAPS`).
  errorSubclass: true,
};
