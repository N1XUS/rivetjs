// T7: Vite plugin include/exclude, foreign JSX pragmas, `.ts` route modules, source type from the
// filename, `@rivetjs/runtime/jsx-dev-runtime`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";
import { foreignJsxPragma, rivet, type RivetOptions } from "../vite.ts";

type Transform = (this: unknown, code: string, id: string, options?: { ssr?: boolean }) => { code: string } | null;
const ctx = {
  error(value: { message: string }) {
    throw Error(value.message);
  },
};
function plugin(options: RivetOptions = {}) {
  const p = rivet(options);
  (p.configResolved as (config: unknown) => void)({ root: "/app", command: "build", build: {}, plugins: [] });
  const transform = p.transform as Transform;
  return (code: string, id: string, ssr = false) => transform.call(ctx, code, id, { ssr })?.code ?? null;
}
const JSX = "export default () => <p>hello</p>;\n";

test("include / exclude select the modules the compiler transforms (globs relative to the Vite root)", () => {
  const excluded = plugin({ exclude: ["src/react/**"] });
  assert.equal(excluded(JSX, "/app/src/react/island.tsx"), null);
  assert.match(excluded(JSX, "/app/src/page.tsx")!, /runtime\/dom/);
  const included = plugin({ include: [/\/src\/rivet\//], exclude: "**/*.legacy.tsx" });
  assert.match(included(JSX, "/app/src/rivet/a.tsx")!, /runtime\/dom/);
  assert.equal(included(JSX, "/app/src/other/a.tsx"), null);
  assert.equal(included(JSX, "/app/src/rivet/a.legacy.tsx"), null);
});

test("a foreign @jsxImportSource / classic @jsx pragma leaves the file to its framework", () => {
  const transform = plugin();
  assert.equal(transform(`/** @jsxImportSource react */\n${JSX}`, "/app/src/island.tsx"), null);
  assert.equal(transform(`// @jsxImportSource preact\n${JSX}`, "/app/src/island.tsx"), null);
  assert.equal(transform(`/** @jsx h */\nimport { h } from "preact";\n${JSX}`, "/app/src/island.tsx"), null);
  assert.match(transform(`/** @jsxImportSource @rivetjs/runtime */\n${JSX}`, "/app/src/a.tsx")!, /runtime\/dom/);
  // Only leading comments count: a string mentioning the pragma is not one.
  assert.match(transform(`${JSX}export const doc = "/** @jsxImportSource react */";\n`, "/app/src/a.tsx")!, /runtime\/dom/);
  assert.equal(foreignJsxPragma("#!/usr/bin/env node\n/* @jsxImportSource solid-js */\n"), true);
  assert.equal(foreignJsxPragma("/** @jsxImportSource @rivetjs/runtime */"), false);
  assert.equal(foreignJsxPragma("/** @jsxFrag Fragment */"), false);
});

test("`.ts` route modules lose their server exports in browser builds (pages importing from an endpoint)", () => {
  const transform = plugin({ serverExports: { modules: ["src/routes/api/items.ts"] } });
  const source = `import { db } from "./db.server.ts";\nexport const LIMIT = 10;\nexport function onGet() {\n  return Response.json(db.all(LIMIT));\n}\n`;
  const browser = transform(source, "/app/src/routes/api/items.ts")!;
  assert.ok(browser, "transformed");
  assert.match(browser, /LIMIT = 10/);
  assert.doesNotMatch(browser, /onGet|db\.server|db\.all/);
  // Server builds keep everything (no transform); other `.ts` modules are untouched.
  assert.equal(transform(source, "/app/src/routes/api/items.ts", true), null);
  assert.equal(transform(source, "/app/src/lib/items.ts"), null);
});

test("@rivetjs/runtime/jsx-dev-runtime resolves and explains why automatic JSX cannot run", async () => {
  const runtime = (await import("@rivetjs/runtime/jsx-dev-runtime")) as { jsxDEV: (...args: unknown[]) => unknown };
  assert.throws(() => runtime.jsxDEV("p", {}), /must pass through @rivetjs\/compiler/);
});

test("the parser source type follows the filename: `.ts` casts, `.jsx` without type syntax", () => {
  // `.ts`: `<T>(x: T) => x` is a generic arrow (TSX reads a JSX element and fails).
  const generic = "const id = <T>(x: T) => x;\nexport const n = id(<number>(window as any).x);\n";
  const ts = compile(generic, { filename: "/app/src/util.ts", target: "dom" });
  assert.deepEqual(ts.diagnostics, []);
  assert.match(ts.code, /const id = \(x\) => x/);
  assert.ok(compile(generic, { filename: "/app/src/util.tsx", target: "dom" }).diagnostics.length > 0);
  // Route-module split of a `.ts` file with a cast.
  const split = compile("const id = <T>(x: T) => x;\nexport const n = id(1);\nexport const onGet = () => new Response(String(n));\n", {
    filename: "/app/src/routes/api.ts",
    target: "dom",
    serverExports: true,
  });
  assert.deepEqual(split.diagnostics, []);
  assert.doesNotMatch(split.code, /onGet/);
  // `.jsx`: type syntax is an error, JSX compiles.
  assert.match(compile("export const A = () => <p>x</p>;\n", { filename: "/app/a.jsx", target: "dom" }).code, /runtime\/dom/);
  assert.ok(compile("export const A = (p) => <p>{p as string}</p>;\n", { filename: "/app/a.jsx", target: "dom" }).diagnostics.length > 0);
});
