// Synchronous loader for the Rust/oxc compiler module: JSON request in, JSON response out.
import { readFileSync } from "node:fs";

interface Exports {
  memory: WebAssembly.Memory;
  alloc(len: number): number;
  run(ptr: number, len: number): number;
  result_len(): number;
  panic_ptr?(): number;
  panic_len?(): number;
  source_hash_ptr?(): number;
  source_hash_len?(): number;
}

/** A compiler panic (RV9001): the request trapped; the instance was replaced. */
export class CompilerPanic extends Error {
  readonly code = "RV9001";
  /** The panic message (payload and Rust source location). */
  readonly panic: string;
  constructor(panic: string) {
    super("Internal error: compiler panicked: " + panic);
    this.name = "CompilerPanic";
    this.panic = panic;
  }
}

let module: WebAssembly.Module | undefined;
let exports: Exports | undefined;
/** `registerTable` requests, replayed into a replacement instance (tables live in the instance). */
const tables = new Map<string, Record<string, unknown>>();
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function instance(): Exports {
  if (!exports) {
    module ??= new WebAssembly.Module(readFileSync(new URL("./rivet_compiler.wasm", import.meta.url)));
    exports = new WebAssembly.Instance(module, {}).exports as unknown as Exports;
    for (const request of tables.values()) send(exports, request);
  }
  return exports;
}

/** Linear memory never shrinks: past this high-water mark the instance is replaced after the call (T8). */
export const MEMORY_LIMIT = 256 * 1024 * 1024;

/**
 * Lone surrogates become U+FFFD (same UTF-16 length, so positions hold): `JSON.stringify` escapes
 * them as `\udXXX`, which serde rejects as an invalid request (P4).
 */
// ES2024 string methods (Node ≥ 20); the package's `lib` predates them.
type WellFormed = string & { isWellFormed(): boolean; toWellFormed(): string };
const wellFormed = (_key: string, value: unknown) =>
  typeof value === "string" && !(value as WellFormed).isWellFormed() ? (value as WellFormed).toWellFormed() : value;

/** A throw out of `run` itself: the instance state is unknown (trap or stack overflow). */
class Fatal {
  readonly error: unknown;
  constructor(error: unknown) {
    this.error = error;
  }
}

function send<T>(wasm: Exports, request: Record<string, unknown>): T {
  const bytes = encoder.encode(JSON.stringify(request, wellFormed));
  const ptr = wasm.alloc(bytes.length);
  new Uint8Array(wasm.memory.buffer, ptr, bytes.length).set(bytes);
  let out: number;
  try {
    out = wasm.run(ptr, bytes.length);
  } catch (error) {
    throw new Fatal(error);
  }
  const response = JSON.parse(decoder.decode(new Uint8Array(wasm.memory.buffer, out, wasm.result_len()))) as { ok: T } | { error: string };
  if ("error" in response) throw new Error("rivet compiler: " + response.error);
  return response.ok;
}

/**
 * Run one request (`{ op, ... }`) through the compiler module. Any throw out of `run` drops the
 * instance — its heap may be inconsistent — and throws `CompilerPanic`: a Rust panic (`panic =
 * "abort"` traps with `unreachable`) carries the message the panic hook kept; a V8 stack overflow
 * inside wasm (a plain `RangeError`, T8: deeply nested input) reports the nesting. The next call
 * instantiates a fresh module (tables re-registered). An instance whose memory grew past
 * `MEMORY_LIMIT` is replaced after the call (linear memory never shrinks).
 */
export function call<T>(request: Record<string, unknown>): T {
  const wasm = instance();
  try {
    const result = send<T>(wasm, request);
    if (request.op === "registerTable") tables.set(String(request.id), request);
    if (wasm.memory.buffer.byteLength > MEMORY_LIMIT) exports = undefined;
    return result;
  } catch (thrown) {
    if (!(thrown instanceof Fatal)) throw thrown;
    exports = undefined;
    const error = thrown.error;
    if (error instanceof RangeError) throw new CompilerPanic("stack overflow: the input nests too deeply (" + error.message + ")");
    const len = error instanceof WebAssembly.RuntimeError ? (wasm.panic_len?.() ?? 0) : 0;
    const message = len ? decoder.decode(new Uint8Array(wasm.memory.buffer, wasm.panic_ptr!(), len)) : error instanceof Error ? error.message : String(error);
    // No panic message: an out-of-bounds trap is the shadow stack running past linear memory's start.
    throw new CompilerPanic(len || !/out of bounds/.test(message) ? message : message + " (stack overflow: the input likely nests too deeply)");
  }
}

/** Test hook: whether a live instance exists (after a fatal error or a memory reset it does not). */
export const hasInstance = () => exports !== undefined;

/** sha256 of the Rust sources the loaded module was built from (`rust/build.sh`; "" when unknown). X2 staleness guard. */
export function wasmSourceHash(): string {
  const wasm = instance();
  const len = wasm.source_hash_len?.() ?? 0;
  return len ? decoder.decode(new Uint8Array(wasm.memory.buffer, wasm.source_hash_ptr!(), len)) : "";
}
