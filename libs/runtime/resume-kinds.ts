// Built-in constructors with their own resume entries (Function Bridge C1): binary views / buffers `b` and errors `E`,
// by global constructor name. Shared by the encoder (`resume-format.ts`) and the on-demand decoders
// (`resume-builtins.ts`); the compiler's `new X` capture allowlist (`resume.rs` `SERIALIZABLE_BUILTINS`) must match.
export const BINARY = [
  "ArrayBuffer",
  "DataView",
  "Int8Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "Int16Array",
  "Uint16Array",
  "Int32Array",
  "Uint32Array",
  "Float16Array",
  "Float32Array",
  "Float64Array",
  "BigInt64Array",
  "BigUint64Array",
];
export const ERRORS = ["Error", "EvalError", "RangeError", "ReferenceError", "SyntaxError", "TypeError", "URIError", "AggregateError"];
export const builtin = (name: string): { prototype?: unknown } | undefined =>
  (globalThis as unknown as Record<string, { prototype?: unknown } | undefined>)[name];
