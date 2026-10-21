// Build-time constants the router's Vite plugin rewrites (`build/vite.ts` `transform`): `TRAILING_SLASH`
// (shared/slash.ts, `rivetRouter({ trailingSlash })`) and `SHELL_BUILD` (server/shell-build.ts, a `shell` route
// rule). Each declaration must be found both in the workspace `.ts` source (type cast kept) and in the published
// `.js` (TypeScript emit: cast stripped) — `scripts/package/smoke.ts` checks the installed tarball the same way.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import type { Plugin } from "vite";
import { rivetRouter } from "../build/vite.ts";

const SLASH = fileURLToPath(new URL("../shared/slash.ts", import.meta.url));
const SHELL = fileURLToPath(new URL("../server/shell-build.ts", import.meta.url));
/** The published form of a source module (what `scripts/package/build.ts` emits: TypeScript, types erased). */
const emitted = (file: string) =>
  ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true },
  }).outputText;

function transform(plugins: Plugin[], code: string, id: string): string {
  const plugin = plugins.find((p) => p.name === "vite-plugin-rivet-router")!;
  const hook = plugin.transform as (this: unknown, code: string, id: string, options?: { ssr?: boolean }) => { code: string } | null;
  const context = {
    error(message: string): never {
      throw new Error(message);
    },
  };
  const result = hook.call(context, code, id, { ssr: true });
  assert.ok(result, "transform returned nothing for " + id);
  return result.code;
}

for (const [form, read] of [
  ["source .ts", (file: string) => readFileSync(file, "utf8")],
  ["published .js", emitted],
] as const) {
  test(`trailingSlash rewrites TRAILING_SLASH (${form})`, () => {
    const code = read(SLASH);
    if (form === "published .js") assert.match(code, /export const TRAILING_SLASH = "ignore";/);
    for (const policy of ["never", "always"] as const) {
      const out = transform(rivetRouter({ trailingSlash: policy }), code, SLASH);
      assert.match(out, new RegExp(`export const TRAILING_SLASH = "${policy}"${form === "source .ts" ? " as TrailingSlash" : ""};`));
      assert.doesNotMatch(out, /TRAILING_SLASH = "ignore"/);
    }
  });

  test(`a shell rule rewrites SHELL_BUILD (${form})`, () => {
    const out = transform(rivetRouter({ routeRules: { "/s/**": { shell: true } } }), read(SHELL), SHELL);
    assert.match(out, /export const SHELL_BUILD = \(\) => import\(".*shell-cache\.ts"\);/);
  });
}

test("unset options leave both modules untouched", () => {
  const plugins = rivetRouter({});
  const plugin = plugins.find((p) => p.name === "vite-plugin-rivet-router")!;
  const hook = plugin.transform as (code: string, id: string, options?: { ssr?: boolean }) => unknown;
  assert.equal(hook.call({}, readFileSync(SLASH, "utf8"), SLASH, { ssr: true }) ?? null, null);
  assert.equal(hook.call({}, readFileSync(SHELL, "utf8"), SHELL, { ssr: true }) ?? null, null);
});
