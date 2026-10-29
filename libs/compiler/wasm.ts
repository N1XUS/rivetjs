// Synchronous loader for the Rust/oxc compiler module: JSON request in, JSON response out.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface Exports {
  memory: WebAssembly.Memory;
  alloc(len: number): number;
  run(ptr: number, len: number): number;
  result_len(): number;
  panic_ptr?(): number;
  panic_len?(): number;
  source_hash_ptr?(): number;
  source_hash_len?(): number;
  /** The build implements the derived resume model (`resume.boundaries` / `independent`, `moduleFacts` `boundaries`); every build since M6. */
  has_derived_model?(): number;
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

function send<T>(wasm: Exports, request: Record<string, unknown>, json = JSON.stringify(request, wellFormed), keep?: (text: string) => void): T {
  const bytes = encoder.encode(json);
  const ptr = wasm.alloc(bytes.length);
  new Uint8Array(wasm.memory.buffer, ptr, bytes.length).set(bytes);
  let out: number;
  try {
    out = wasm.run(ptr, bytes.length);
  } catch (error) {
    throw new Fatal(error);
  }
  const text = decoder.decode(new Uint8Array(wasm.memory.buffer, out, wasm.result_len()));
  const response = JSON.parse(text) as { ok: T } | { error: string };
  if ("error" in response) throw new Error("rivet compiler: " + response.error);
  keep?.(text);
  return response.ok;
}

// INCR-BUILD persistent call cache (`setCallCache`): the compiler is a pure function of its request, the module it was
// built from and the static-call tables registered in the instance (the only state an instance keeps: `tables`, replayed
// into a replacement). Key = sha256(wasm bytes, tables, request JSON) → the response text, one file per key. Cross-module
// facts (boundary verdicts, call-site proofs, native-lite twins, class joins) reach the compiler only as request options,
// so a change anywhere that alters a module's output alters its key: never stale, no invalidation to get wrong.
let cacheDir: string | null = null;
let wasmDigest: string | undefined;
let tablesDigest: string | undefined;
/** Hits / misses / writes of this process (tests, build logs). */
export const callCacheStats = { hits: 0, misses: 0, writes: 0 };
/** Default size cap of the call cache (MB; env `RIVET_COMPILE_CACHE_MB`). */
export const CALL_CACHE_MB = 512;
const PRUNE_STAMP = ".pruned";
/** A directory pruned by one process is not scanned again by the next for this long (a build runs 3–4 Vite children). */
const PRUNE_EVERY_MS = 10 * 60 * 1000;

/**
 * Persist compiler responses under `dir` (`null` = off, the default). Called by the Vite plugin with
 * `<Vite cacheDir>/rivet-compile`; env `RIVET_COMPILE_CACHE=0` turns it off everywhere. Least recently used entries
 * (file mtime, touched on a hit) go once the directory is over `maxMB` (default `CALL_CACHE_MB`).
 */
export function setCallCache(dir: string | null, maxMB = Number(process.env.RIVET_COMPILE_CACHE_MB) || CALL_CACHE_MB): void {
  if (process.env.RIVET_COMPILE_CACHE === "0") dir = null;
  if (dir === cacheDir) return;
  cacheDir = dir;
  if (!dir) return;
  try {
    mkdirSync(dir, { recursive: true });
    pruneCallCache(dir, maxMB * 1024 * 1024);
  } catch {
    cacheDir = null;
  }
}

/** Drop least recently used entries until `dir` holds ≤ 80 % of `maxBytes` (when over `maxBytes`). */
export function pruneCallCache(dir: string, maxBytes: number, force = false): number {
  const stamp = join(dir, PRUNE_STAMP);
  if (!force) {
    try {
      if (Date.now() - statSync(stamp).mtimeMs < PRUNE_EVERY_MS) return 0;
    } catch {}
  }
  writeFileSync(stamp, "");
  const files: { path: string; size: number; time: number }[] = [];
  let total = 0;
  for (const sub of readdirSync(dir)) {
    if (sub === PRUNE_STAMP) continue;
    let names: string[];
    try {
      names = readdirSync(join(dir, sub));
    } catch {
      continue;
    }
    for (const name of names) {
      const path = join(dir, sub, name);
      try {
        const stat = statSync(path);
        files.push({ path, size: stat.size, time: stat.mtimeMs });
        total += stat.size;
      } catch {}
    }
  }
  if (total <= maxBytes) return 0;
  files.sort((a, b) => a.time - b.time);
  let removed = 0;
  for (const file of files) {
    if (total <= maxBytes * 0.8) break;
    try {
      unlinkSync(file.path);
      total -= file.size;
      removed++;
    } catch {}
  }
  return removed;
}

function callKey(json: string): string {
  wasmDigest ??= createHash("sha256")
    .update(readFileSync(new URL("./rivet_compiler.wasm", import.meta.url)))
    .digest("hex");
  if (tablesDigest === undefined) {
    const hash = createHash("sha256");
    for (const id of [...tables.keys()].sort()) hash.update(JSON.stringify(tables.get(id), wellFormed)).update("\0");
    tablesDigest = hash.digest("hex");
  }
  return createHash("sha256").update(wasmDigest).update("\0").update(tablesDigest).update("\0").update(json).digest("hex");
}

/** The cached response of `json`, or `undefined` (and a writer for the fresh response). */
function cached<T>(dir: string, json: string): { hit: true; value: T } | { hit: false; keep: (text: string) => void } {
  const key = callKey(json);
  const file = join(dir, key.slice(0, 2), key.slice(2) + ".json");
  let text: string | undefined;
  try {
    text = readFileSync(file, "utf8");
  } catch {}
  if (text !== undefined) {
    try {
      const value = (JSON.parse(text) as { ok: T }).ok;
      callCacheStats.hits++;
      try {
        const now = new Date();
        utimesSync(file, now, now);
      } catch {}
      return { hit: true, value };
    } catch {} // torn / foreign file: recompute and overwrite
  }
  callCacheStats.misses++;
  return {
    hit: false,
    keep(text) {
      try {
        mkdirSync(join(dir, key.slice(0, 2)), { recursive: true });
        // Atomic: concurrent build children write the same key with the same bytes.
        const temp = file + "." + process.pid + ".tmp";
        writeFileSync(temp, text);
        renameSync(temp, file);
        callCacheStats.writes++;
      } catch {}
    },
  };
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
  let json: string | undefined;
  let keep: ((text: string) => void) | undefined;
  if (cacheDir && request.op !== "registerTable") {
    json = JSON.stringify(request, wellFormed);
    const entry = cached<T>(cacheDir, json);
    if (entry.hit) return entry.value;
    keep = entry.keep;
  }
  const wasm = instance();
  try {
    const result = send<T>(wasm, request, json, keep);
    if (request.op === "registerTable") (tables.set(String(request.id), request), (tablesDigest = undefined));
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

/**
 * Whether the loaded module implements the derived resume model (`resume.boundaries` / `resume.independent`, `moduleFacts`
 * `boundaries`; export `has_derived_model`). Every build since M6 (the derived model is the only resume model) returns true.
 */
export function hasDerivedModel(): boolean {
  return (instance().has_derived_model?.() ?? 0) === 1;
}
