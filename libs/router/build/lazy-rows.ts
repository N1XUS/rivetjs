// Lazy collection rows, T1 measurement harness (spec docs/design/specs/2026-10-19-lazy-collection-rows-design.md §3.4, R2):
// `RIVET_LAZY_ROWS=swap` renders every For row inside a resumable region unrecorded and re-creates the region in the
// browser on the first interaction (create + swap). A bytes / server-CPU baseline only — it must never ship (the event
// target is replaced under the pointer, inputs lose their value, focus moves), so it is no option of `rivet.config` /
// `rivetRouter()`: only this environment variable turns it on, and only in the dev server or in a build whose environment
// also carries `LAZY_ROWS_HARNESS_ENV` (docs-kit `check-examples` / `scripts/lazy-rows/probe.ts` set it for their
// build children). Everything it adds is server code (`@rivetjs/runtime` `server-lazy-swap.ts`, installed first by the
// generated server entry): browser bundles are unchanged.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Plugin } from "vite";

/** The measurement mode env var: `swap` here; `on` / `off` belong to the runtime (server lazy row records, LAZY-ROWS T4, read at render). */
export const LAZY_ROWS_ENV = "RIVET_LAZY_ROWS";
/** Set by the measurement tools for their build children: production builds honour `RIVET_LAZY_ROWS` only with it. */
export const LAZY_ROWS_HARNESS_ENV = "RIVET_LAZY_ROWS_HARNESS";

/** Whether the swap harness applies to a Vite run (`command`): dev server, or a harness build. `on` / `off` → null (runtime
 * values, no build change). Throws on unknown values. */
export function lazyRowsMode(command: "serve" | "build", env: Readonly<Record<string, string | undefined>> = process.env): "swap" | null {
  const value = env[LAZY_ROWS_ENV];
  if (!value || value === "on" || value === "off") return null;
  if (value !== "swap") throw new Error(`${LAZY_ROWS_ENV}=${value}: the only measurement mode is "swap" ("on" / "off": server lazy row records)`);
  if (command === "serve" || env[LAZY_ROWS_HARNESS_ENV] === "1") return "swap";
  console.warn(`rivetRouter: ${LAZY_ROWS_ENV}=swap ignored: a measurement mode for the dev server and the lazy-rows tools only`);
  return null;
}

/**
 * Lazy rows proper (LAZY-ROWS T5): a build whose resume runtime materialises them has `resume.lazyRows` (the default since
 * LAZY-FLIP 2026-10-22). The measurement tools (docs-kit `check-examples`, `scripts/lazy-rows/probe.ts`) build app configs
 * they do not own: with `LAZY_ROWS_HARNESS_ENV` (which only they set for their build children) `RIVET_LAZY_ROWS=on` forces
 * the option on and `off` forces it off for that build (LAZY-T5B); `undefined` leaves the app's option.
 */
export function lazyRowsBuild(env: Readonly<Record<string, string | undefined>> = process.env): boolean | undefined {
  if (env[LAZY_ROWS_HARNESS_ENV] !== "1") return undefined;
  const value = env[LAZY_ROWS_ENV];
  return value === "on" ? true : value === "off" ? false : undefined;
}

/** The runtime module the server entry imports in swap mode (no package export: not public API). */
export function lazyRowsModule(): string {
  return join(dirname(createRequire(import.meta.url).resolve("@rivetjs/runtime/server-resume")), "server-lazy-swap.ts");
}

/** Vite plugin: in swap mode the generated server entry (`entry`) installs the swap row hook before anything else. */
export function lazyRowsHarness(entry: () => string): Plugin {
  let active = false;
  return {
    name: "vite-plugin-rivet-lazy-rows",
    enforce: "pre",
    config(_config, env) {
      active = lazyRowsMode(env.command) !== null;
      if (active) console.warn(`rivetRouter: ${LAZY_ROWS_ENV}=swap: For rows render unrecorded (measurement build, never ship it)`);
    },
    transform(code, id, options) {
      if (!active || !options?.ssr || id.split("?")[0] !== entry()) return null;
      // A call, not a bare import: the runtime package is `sideEffects: false`.
      return { code: `import { _lazyRowsSwap } from ${JSON.stringify(lazyRowsModule())};\n_lazyRowsSwap();\n` + code, map: null };
    },
  };
}
