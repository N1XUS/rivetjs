// Vite / Vitest plugin for component tests: `.tsx` / `.jsx` modules compile through the Rivet compiler
// (the role `@rivetjs/runtime/testing/register` plays under `node --test`). Target: DOM by default,
// server for `*.server.test.*` files and every `.tsx` / `.jsx` module they import (transitively
// through `.tsx` / `.jsx` modules and `.ts` / `.mts` imports, e.g. an `index.ts` barrel), or for
// every module with `target: "server"`. A `.ts` file is tagged whether a relative path or a package specifier
// reaches it (cdk imports `../i18n/index.ts` and `@rivetjs/cdk/i18n` alike: one instance, one context token);
// `@rivetjs/reactivity` / `@rivetjs/runtime` specifiers never are, so the runtime singletons load once. Server-graph modules carry a `?rivet-target=server` query, so
// one run can hold both compilations of a component. Same rule as `@rivetjs/runtime/testing/register`.
// Vitest config it adds: `setupFiles` `./cleanup.ts` (auto `cleanup()` after each test) and
// `snapshotSerializers` `./serializer.ts` (snapshots without runtime marker comments).
// DOM-target modules compile like the Vite plugin's client modules (DOM v2, the only DOM lowering).
// Runtime switch modules (`@rivetjs/compiler/switches`) load with the content a resumable app build ships by default
// (derived adopt run: `derived` + `lazy-rows` on; `domData` on, `resume: { domData: false }` opts out, as the compiler
// plugin): suites run the same runtime code as the app. Applies to runtime modules Vite loads (workspace sources,
// non-prebundled browser-mode modules); a runtime Vitest externalizes to Node keeps its files' content (off), and so does
// the node `@rivetjs/runtime/testing/register` hook.
import { fileURLToPath } from "node:url";
import { compile } from "@rivetjs/compiler";
import { formatDiagnostic } from "@rivetjs/compiler/format";
import { DERIVED_SWITCHES, DOM_DATA_SWITCHES, SWITCH_MODULE, switchContent } from "@rivetjs/compiler/switches";
import type { Plugin } from "vite";

export interface RivetTestOptions {
  /** Compile every `.tsx` / `.jsx` module for this target. Default: by test file name (see above). */
  target?: "dom" | "server";
  /** Run `cleanup()` from `@rivetjs/runtime/testing` after every test (default true; false: call it yourself). */
  cleanup?: boolean;
  /** Register `rivetSerializer` (DOM snapshots without runtime marker comments; default true). */
  serializer?: boolean;
  /** Runtime switches, as the compiler plugin's `resume` options: `domData` default true (the shipped default); the derived
   *  adopt run switches (`derived`, `lazy-rows`) are always served opted in. */
  resume?: { domData?: boolean };
}

const jsx = /\.[jt]sx$/;
const ts = /\.m?ts$/;
const relative = /^\.{1,2}\//;
const singleton = /^@rivetjs\/(reactivity|runtime)(\/|$)/;
const serverTest = /\.server\.test\.[cm]?[jt]sx?$/;
const query = "rivet-target";

const split = (id: string) => {
  const at = id.indexOf("?");
  return at < 0 ? { path: id, params: new URLSearchParams() } : { path: id.slice(0, at), params: new URLSearchParams(id.slice(at + 1)) };
};
const isServerId = (id: string) => {
  const { path, params } = split(id);
  return params.get(query) === "server" || serverTest.test(path);
};

export function rivetTest(options: RivetTestOptions = {}): Plugin {
  // Compiler warnings already printed (file, position, message).
  const warned = new Set<string>();
  return {
    name: "rivet:test",
    enforce: "pre",
    config() {
      const test: { setupFiles?: string[]; snapshotSerializers?: string[] } = {};
      if (options.cleanup !== false) test.setupFiles = [fileURLToPath(new URL("./cleanup.ts", import.meta.url))];
      if (options.serializer !== false) test.snapshotSerializers = [fileURLToPath(new URL("./serializer.ts", import.meta.url))];
      return { test } as Record<string, unknown>;
    },
    async resolveId(source, importer, resolveOptions) {
      if (options.target || !importer || !isServerId(importer)) return null;
      const resolved = await this.resolve(source, importer, { ...resolveOptions, skipSelf: true });
      if (!resolved || resolved.external) return resolved;
      const { path, params } = split(resolved.id);
      const carries = jsx.test(path) || (ts.test(path) && (relative.test(source) || (!singleton.test(source) && !path.includes("/node_modules/"))));
      if (!carries || params.has(query)) return resolved;
      params.set(query, "server");
      return { ...resolved, id: `${path}?${params}` };
    },
    load(id) {
      const hit = SWITCH_MODULE.exec(split(id).path);
      if (!hit) return null;
      const name = hit[1]!;
      const on =
        (DERIVED_SWITCHES as readonly string[]).includes(name) ||
        ((DOM_DATA_SWITCHES as readonly string[]).includes(name) && options.resume?.domData !== false);
      return on ? switchContent(name, (module) => "./" + module + "." + hit[2]) : null;
    },
    transform(code, id) {
      const { path } = split(id);
      if (!jsx.test(path) || path.includes("/node_modules/")) return null;
      const target = options.target ?? (isServerId(id) ? "server" : "dom");
      const result = compile(code, { target, filename: path, sourceMap: true });
      if (result.diagnostics.length)
        throw new SyntaxError(
          "Rivet compile failed:\n" +
            result.diagnostics.map((d) => `  ${d.filename || path}${d.line ? `:${d.line}:${d.column ?? 0}` : ""} ${d.message}`).join("\n"),
        );
      // Compiler warnings (RV2104): printed once per site and message with their origin, never dropped.
      for (const w of result.warnings ?? []) {
        const key = `${path}\0${w.line ?? 0}:${w.column ?? 0}\0${w.message}`;
        if (warned.has(key)) continue;
        warned.add(key);
        this.warn(formatDiagnostic({ origin: "compiler", code: w.code, message: w.message, file: path, line: w.line, column: w.column }));
      }
      return { code: result.code, map: result.map ?? null };
    },
  };
}

/**
 * Resolve packages the way plain `node` does. Vite adds a `development|production` condition (it turns
 * into `development` outside production mode) and `node` / `module`; with `viteModuleRunner: false`
 * Vitest forwards them to the workers as `--conditions` flags, so a suite would silently run against
 * the development façades. This clears them; pass `--conditions=development` in `execArgv` instead.
 */
export function nodeConditions(): Plugin {
  return {
    name: "rivet:node-conditions",
    enforce: "post",
    configEnvironment(_name, config) {
      config.resolve ??= {};
      config.resolve.conditions = [];
      config.resolve.externalConditions = [];
    },
  };
}
