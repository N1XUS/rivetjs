// Vite / Vitest plugin for component tests: `.tsx` / `.jsx` modules compile through the Rivet compiler
// (the role `@rivetjs/runtime/testing/register` plays under `node --test`). Target: DOM by default,
// server for `*.server.test.*` files and every `.tsx` / `.jsx` module they import (transitively
// through `.tsx` / `.jsx` modules and relative `.ts` / `.mts` imports, e.g. an `index.ts` barrel), or for
// every module with `target: "server"`. Package specifiers are never tagged, so runtime singletons
// (`@rivetjs/reactivity`, …) load once. Server-graph modules carry a `?rivet-target=server` query, so
// one run can hold both compilations of a component. Same rule as `@rivetjs/runtime/testing/register`.
// Vitest config it adds: `setupFiles` `./cleanup.ts` (auto `cleanup()` after each test) and
// `snapshotSerializers` `./serializer.ts` (snapshots without runtime marker comments).
// DOM-target modules compile like the Vite plugin's client modules (DOM v2, the only DOM lowering).
import { fileURLToPath } from "node:url";
import { compile } from "@rivetjs/compiler";
import { formatDiagnostic } from "@rivetjs/compiler/format";
import type { Plugin } from "vite";

export interface RivetTestOptions {
  /** Compile every `.tsx` / `.jsx` module for this target. Default: by test file name (see above). */
  target?: "dom" | "server";
  /** Run `cleanup()` from `@rivetjs/runtime/testing` after every test (default true; false: call it yourself). */
  cleanup?: boolean;
  /** Register `rivetSerializer` (DOM snapshots without runtime marker comments; default true). */
  serializer?: boolean;
}

const jsx = /\.[jt]sx$/;
const ts = /\.m?ts$/;
const relative = /^\.{1,2}\//;
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
      const carries = jsx.test(path) || (ts.test(path) && relative.test(source));
      if (!carries || params.has(query)) return resolved;
      params.set(query, "server");
      return { ...resolved, id: `${path}?${params}` };
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
      // Compiler warnings (RV2012–RV2015): printed once per site and message with their origin, never dropped.
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
