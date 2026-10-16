// Test helpers: a tiny Standard Schema, FormData from pairs, a serializability probe.
import { _inspect } from "@rivetjs/reactivity";
import { createEncoder } from "@rivetjs/runtime/resume-format";
import type { StandardSchemaV1 } from "../standard-schema.ts";

type Rule<T> = (input: T) => { path?: (string | number)[]; message: string }[];
/** A Standard Schema from a rule function (sync, or async with `async: true`). */
export function schema<T = Record<string, unknown>>(rule: Rule<T>, options: { async?: boolean; output?: (input: T) => unknown } = {}): StandardSchemaV1<T, T> {
  const run = (input: unknown): StandardSchemaV1.Result<T> => {
    const issues = rule(input as T);
    return issues.length ? { issues } : { value: (options.output ? options.output(input as T) : input) as T };
  };
  return { "~standard": { version: 1, vendor: "test", validate: (input) => (options.async ? Promise.resolve().then(() => run(input)) : run(input)) } };
}
export const fd = (pairs: [string, string | File][]): FormData => {
  const data = new FormData();
  for (const [name, value] of pairs) data.append(name, value);
  return data;
};
/** Encode like the resume state does (signals as `{s}`); throws on functions/class instances. */
export function encodeState(value: unknown): string {
  const encoder = createEncoder({
    special: (object, ref) => {
      if (typeof object !== "function") return undefined;
      const reactive = _inspect(object);
      return reactive?.kind === "signal" ? { s: ref(reactive.value) } : undefined;
    },
  });
  const root = encoder.ref(value);
  return JSON.stringify({ t: encoder.table, r: root });
}
export const tick = (ms = 0): Promise<void> => new Promise((done) => setTimeout(done, ms));
/** Stand-in for the `<form>` element: the engine only hands it to remote checks. */
export const fakeElement = {} as HTMLFormElement;
