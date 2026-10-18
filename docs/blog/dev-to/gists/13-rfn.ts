// libs/runtime/server-resume.ts — how a function becomes resumable without shipping the function.
// The compiler wraps qualifying functions: `_rFn("@rivetjs/cdk/button/index.tsx#Button$13", () => …, [labelledBy, id])`.
// The symbol is an address into a client chunk; the captures are the data. That's the whole trick.
const fns = new WeakMap<object, { id: string; captures: Captures; render: object }>();

/**
 * A captured local function (or a const derived through functions); serialized as its symbol plus
 * captures. The first registration of a render wins: the creation site registers before any
 * `const x = props.fn ?? …` that passes the function on (whose captures hold `props` → the function
 * itself: a cycle, and a recipe that only returns the original). A function shared across renders
 * (module-level, cached) re-registers with the current render's captures.
 */
export function _rFn<F>(id: string, fn: F, captures: Captures): F {
  const recorder = store.getStore() ?? unrecordedRender;
  // A const derived through a function may hold a primitive (`find(arrow) ?? "x"`): serialized as itself.
  if (recorder && Object(fn) === fn && fns.get(fn as object)?.render !== recorder.options) fns.set(fn as object, { id, captures, render: recorder.options });
  return fn;
}

// libs/runtime/resume-format.ts — what gets refused, with a type name but without calling your code.
export function typeName(value: unknown): string {
  if (value === null) return "null";
  if (typeof value !== "object") return typeof value;
  const proto = Object.getPrototypeOf(value);
  const ctor = proto && Object.getOwnPropertyDescriptor(proto, "constructor")?.value;
  return typeof ctor === "function" && ctor.name ? ctor.name + " instance" : "object";
}
// …
if (typeof value === "function") throw new TypeError("function is not serializable");
// allow-list by exact prototype: Array, Object, null-proto, Date, URL, Map, Set …
else throw new TypeError(typeName(value) + " is not serializable"); // "Promise instance is not serializable"
