// Decoder of the built-in resume entries outside the core decoder (C1C2-SLIM zero cost): RegExp `t`, URLSearchParams
// `U`, binary `b`, errors `E` and `registerClass` instances `cls` + `rv`. Loading this module installs it for
// `resume-format.ts` (`globalThis[_BUILTINS]`), so pages whose data holds none of them never load these bytes. Loaded on
// demand: a route payload / router data / form answer holding such entries names its chunk (`x`, manifest `builtins`)
// and runs it before decoding (`_decodeWire`, the generated `Root`). A side-effect module: load it
// as a module script or `import()` (bundlers drop a bare static import: the package is `sideEffects: false`).
import type { BuiltinDecoder, ClassRegistry, EntryRecord } from "./resume-format.ts";
import { BINARY, ERRORS, builtin } from "./resume-kinds.ts";

const invalid = (): never => {
  throw new TypeError("Invalid resume table entry");
};
const decode: BuiltinDecoder = (entry: EntryRecord, get, keep) => {
  // `registerClass` instance (BUSY in the core decoder meanwhile: a cycle back to it throws). Its data decodes first,
  // then the registered reviver builds it (registry: resume-format `_CLASSES`).
  if (entry.rv) {
    const id = entry.cls!,
      registered = (globalThis as { [key: symbol]: ClassRegistry | undefined })[Symbol.for("rivet.classes")]?.ids.get(id);
    if (!registered?.revive)
      throw new TypeError("Resume class `" + id + "` is not registered here: import the module calling registerClass in the browser entry too");
    let data: unknown;
    try {
      data = get(entry.a![0]!);
    } catch (error) {
      // A cycle met while this instance's data decodes runs through it (the innermost instance names it).
      if (error instanceof TypeError && error.message === "Cyclic reference through a revived instance")
        throw new TypeError(
          "Cyclic reference through revive of " + id + ": its serialized data leads back to a value still decoding (the reviver needs the data first)",
        );
      throw error;
    }
    return keep(registered.revive(data));
  }
  if (entry.t) {
    const [source, flags, last] = entry.t,
      re = keep(new RegExp(source, flags));
    if (last) re.lastIndex = last;
    return re;
  }
  if (entry.U !== undefined) return keep(new URLSearchParams(entry.U));
  if (entry.b) {
    const [kind, data] = entry.b;
    if (!BINARY.includes(kind)) invalid();
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)).buffer;
    return keep(kind === "ArrayBuffer" ? bytes : new (builtin(kind) as unknown as new (buffer: ArrayBuffer) => unknown)(bytes));
  }
  if (!entry.E) throw new TypeError("Unknown resume table entry");
  const [kind, message, data] = entry.E as [string, string, number?];
  if (!ERRORS.includes(kind)) invalid();
  const C = builtin(kind) as unknown as new (...args: unknown[]) => Error;
  const error = keep(kind === "AggregateError" ? new C([], message) : new C(message));
  if (data !== undefined) {
    const fields = get(data) as Record<string, unknown>;
    for (const key of Object.keys(fields))
      if (key === "cause" || key === "errors") Object.defineProperty(error, key, { value: fields[key], writable: true, configurable: true });
      // Own data property (resume-format `own`): plain assignment except `__proto__`.
      else if (key === "__proto__") Object.defineProperty(error, key, { value: fields[key], writable: true, enumerable: true, configurable: true });
      else (error as unknown as Record<string, unknown>)[key] = fields[key];
  }
  return error;
};
// resume-format `_BUILTINS` (not imported: this chunk shares nothing with the decoder's).
(globalThis as { [key: symbol]: unknown })[Symbol.for("rivet.builtins")] = decode;
