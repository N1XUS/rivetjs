// Synchronous Rivet compiler (WASM) for editors: the same JSON protocol as @rivetjs/compiler, loaded
// from any `rivet_compiler.wasm` (the workspace's own build first, so editor and build agree).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { CheckOptions, CheckResult } from "@rivetjs/compiler";

export type { CheckDiagnostic, CheckOptions, CheckResult, CheckSite } from "@rivetjs/compiler";

export interface Compiler {
  /** Absolute path of the loaded module. */
  readonly wasm: string;
  check(source: string, options?: CheckOptions): CheckResult;
}

interface Exports {
  memory: WebAssembly.Memory;
  alloc(len: number): number;
  run(ptr: number, len: number): number;
  result_len(): number;
  panic_ptr?(): number;
  panic_len?(): number;
}

/**
 * Instantiate a compiler module; throws when it does not answer the `check` op (too old). A panic
 * inside `check` (the call traps) replaces the instance and reports one RV9001 diagnostic.
 */
export function loadCompiler(wasm: string): Compiler {
  const module = new WebAssembly.Module(readFileSync(wasm));
  let exports = new WebAssembly.Instance(module, {}).exports as unknown as Exports;
  const encoder = new TextEncoder(),
    decoder = new TextDecoder();
  const call = <T>(request: Record<string, unknown>): T => {
    const bytes = encoder.encode(JSON.stringify(request));
    const ptr = exports.alloc(bytes.length);
    new Uint8Array(exports.memory.buffer, ptr, bytes.length).set(bytes);
    const out = exports.run(ptr, bytes.length);
    const response = JSON.parse(decoder.decode(new Uint8Array(exports.memory.buffer, out, exports.result_len()))) as { ok: T } | { error: string };
    if ("error" in response) throw new Error("rivet compiler: " + response.error);
    return response.ok;
  };
  const check = (source: string, options: CheckOptions = {}): CheckResult => {
    try {
      return call<CheckResult>({ op: "check", source, options });
    } catch (error) {
      if (!(error instanceof WebAssembly.RuntimeError)) throw error;
      const trapped = exports;
      exports = new WebAssembly.Instance(module, {}).exports as unknown as Exports;
      const len = trapped.panic_len?.() ?? 0;
      const panic = len ? decoder.decode(new Uint8Array(trapped.memory.buffer, trapped.panic_ptr!(), len)) : error.message;
      const filename = options.filename ?? "module.tsx";
      const targets = options.targets ?? ["server", "dom"];
      return {
        diagnostics: [{ code: "RV9001", severity: "error", message: "Internal error: compiler panicked: " + panic, filename, start: 0, end: 0, targets }],
        sites: [],
      };
    }
  };
  const compiler: Compiler = { wasm, check };
  compiler.check("", { targets: ["dom"] });
  return compiler;
}

/** `rivet_compiler.wasm` of the `@rivetjs/compiler` resolvable from `directory`, if any. */
export function workspaceCompilerWasm(directory: string): string | null {
  try {
    const require = createRequire(join(directory, "noop.js"));
    // The package root entry (index.ts) sits next to the module; `./package.json` is not exported.
    return join(dirname(require.resolve("@rivetjs/compiler")), "rivet_compiler.wasm");
  } catch {
    return null;
  }
}

/** First candidate that loads (workspace compiler, then a bundled copy); null when none does. */
export function findCompiler(candidates: readonly (string | null | undefined)[], log?: (message: string) => void): Compiler | null {
  for (const wasm of candidates) {
    if (!wasm) continue;
    try {
      return loadCompiler(wasm);
    } catch (error) {
      log?.(`rivet: compiler ${wasm} unusable: ${(error as Error).message}`);
    }
  }
  return null;
}
