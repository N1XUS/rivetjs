// Decoder of the built-in resume entries outside the core decoder (Function Bridge C1; C1C2-SLIM zero cost): RegExp
// `t`, URLSearchParams `U`, binary `b`, errors `E`, data class instances `cls` (T23 fix 1) and resource holders `cls` + `rv` (T25). Loading this module installs it for `resume-format.ts`
// (`globalThis[_BUILTINS]`), so pages whose state holds none of them never load these bytes. Loaded on demand: resumed
// pages through the chunk the server lists in the `needs` of every entry reaching such a value (manifest `builtins`);
// router data / form answers name it in `x` and run it before decoding (`_decodeWire`). A side-effect module: load it
// as a module script or `import()` (bundlers drop a bare static import: the package is `sideEffects: false`).
import type { BuiltinDecoder, ClassRegistry, EntryRecord } from "./resume-format.ts";
import { BINARY, ERRORS, builtin } from "./resume-kinds.ts";

const invalid = (): never => {
  throw new TypeError("Invalid resume table entry");
};
// Class instance fills deferred (`later`) while a resource holder's data decodes: run before its reviver reads the data.
let reviving = 0;
const pending: (() => void)[] = [];
const decode: BuiltinDecoder = (entry: EntryRecord, get, keep, later, need) => {
  // Resource holder (Function Bridge T25; BUSY in the core decoder meanwhile: a cycle back to it throws). Its data decodes
  // first — instances in it complete (their deferred fills run now) — then its reviver builds it: the `registerClass` hooks
  // of a registered id (a string `cls`; registry: resume-format `_CLASSES`), else the class symbol's `static [revive]`.
  if (entry.rv) {
    // A registered id: a string without `#` (a class symbol id always has one; the wire holds its page index).
    const cls = entry.cls,
      id = typeof cls === "string" && !cls.includes("#"),
      registered = id ? (globalThis as { [key: symbol]: ClassRegistry | undefined })[Symbol.for("rivet.classes")]?.ids.get(cls as string) : undefined;
    if (id && !registered?.revive)
      throw new TypeError("Resume class `" + cls + "` is not registered here: import the module calling registerClass in the browser entry too");
    const Cls = registered ? undefined : (need("fn")(cls!, [], undefined) as { [key: symbol]: (data: unknown) => unknown });
    const mark = pending.length;
    let data: unknown;
    reviving++;
    try {
      data = get(entry.a![0]!);
      while (pending.length > mark) pending.splice(mark, 1)[0]!();
    } catch (error) {
      // Review T25 L2: a cycle met while this holder's data decodes runs through it (the innermost holder names it).
      if (error instanceof TypeError && error.message === "Cyclic reference through a reactive or function entry")
        throw new TypeError(
          "Cyclic reference through revive of " +
            (registered ? cls : (Cls as unknown as { name?: string }).name || cls) +
            ": its [serialize] data leads back to a value still decoding (the reviver needs the data first)",
        );
      throw error;
    } finally {
      reviving--;
      pending.length = mark;
    }
    return keep(registered ? registered.revive!(data) : Cls![Symbol.for("rivet.revive")]!(data));
  }
  // Data class instance (Function Bridge T23): the class symbol's factory returns the class (`fn` hook, no captures). The
  // prototype is memoized first (a function among the fields may capture the instance), then the own fields are defined as
  // data properties (class fields define, never assign: a prototype setter does not run) — inside a BUSY entry once the
  // outermost one is done (`later`). The constructor never runs. A symbol returning no class throws (`Object.create`).
  if (entry.cls !== undefined) {
    const out = keep(Object.create((need("fn")(entry.cls, [], undefined) as { prototype: object }).prototype) as object);
    let done = false;
    const fill = (): void => {
      if (done) return;
      done = true;
      const data = get(entry.a![0]!) as Record<string, unknown>;
      for (const key of Object.keys(data)) Object.defineProperty(out, key, { value: data[key], writable: true, enumerable: true, configurable: true });
    };
    // Inside a resource holder's data: also queued for it (whichever runs first fills; T25).
    if (reviving) pending.push(fill);
    later(fill);
    return out;
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
