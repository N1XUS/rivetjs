// Compiler ↔ runtime ABI handshake. Compiled modules call `_`-prefixed @rivetjs/runtime helpers whose
// names AND meaning this compiler relies on; a skewed install (compiler and runtime from different
// releases) fails on a missing import name at best and misrenders silently at worst. `RUNTIME_ABI` is
// the helper contract this compiler emits for; @rivetjs/runtime declares the contract it implements in
// its package.json (`"rivet": { "abi": N }`). The Vite plugin compares them when a build or the dev
// server starts: build-time only, nothing is added to compiled output.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Runtime helper contract the compiler emits for. Bump it together with `rivet.abi` in
 * libs/runtime/package.json whenever compiled output and runtime helpers change in a way the other
 * side must match (new/removed/renamed helper, changed arguments, template/marker/resume format).
 */
// 8: Function Bridge (_rMod, thunk captures, _rCell, _rBound, _rFn member, _rStorePaths, _rClass).
export const RUNTIME_ABI = 8;

/** The @rivetjs/runtime package owning `file` (any resolved runtime module). */
export interface RuntimePackage {
  readonly dir: string;
  readonly version: string;
  /** `rivet.abi` of its package.json (`undefined`: a runtime older than the handshake). */
  readonly abi: number | undefined;
}

export function runtimePackage(file: string): RuntimePackage | undefined {
  for (let dir = dirname(file), parent; ; dir = parent) {
    let json: { name?: string; version?: string; rivet?: { abi?: unknown } } | undefined;
    try {
      json = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    } catch {}
    if (json?.name === "@rivetjs/runtime") return { dir, version: json.version ?? "?", abi: typeof json.rivet?.abi === "number" ? json.rivet.abi : undefined };
    if ((parent = dirname(dir)) === dir) return undefined;
  }
}

/** The error for a runtime whose ABI differs from `RUNTIME_ABI` (`undefined`: compatible). */
export function runtimeAbiProblem(runtime: RuntimePackage): string | undefined {
  if (runtime.abi === RUNTIME_ABI) return undefined;
  return (
    `@rivetjs/compiler emits code for runtime ABI ${RUNTIME_ABI}, but the resolved @rivetjs/runtime ${runtime.version} (${runtime.dir}) ` +
    `implements ABI ${runtime.abi ?? "unknown (older than the handshake)"}: install @rivetjs/compiler and @rivetjs/runtime from the same release.`
  );
}
