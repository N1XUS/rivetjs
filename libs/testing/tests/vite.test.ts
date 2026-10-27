import { test } from "vitest";
import assert from "node:assert/strict";
import { rivetTest } from "../vite.ts";

// `resolveId` with a stub `this.resolve` that maps every source to `/src/<source without ./>`.
type Resolved = { id: string; external?: boolean } | null;
const resolveId = rivetTest().resolveId as unknown as (
  this: { resolve: (source: string) => Promise<Resolved> },
  source: string,
  importer: string | undefined,
  options: object,
) => Promise<Resolved>;
const context = {
  resolve: async (source: string): Promise<Resolved> =>
    source.startsWith("@rivetjs/cdk/")
      ? { id: `/libs/cdk/${source.slice(13)}/index.ts` }
      : source.startsWith("@")
        ? { id: `/node_modules/${source}/index.ts` }
        : { id: `/src/${source.replace(/^\.\//, "")}` },
};
const resolve = (source: string, importer: string) => resolveId.call(context, source, importer, {});

test("server test: .tsx imports carry the server target", async () => {
  assert.deepEqual(await resolve("./view.tsx", "/src/view.server.test.tsx"), { id: "/src/view.tsx?rivet-target=server" });
});

test("server graph: relative .ts / .mts barrels carry it, so the .tsx they import compile for the server", async () => {
  assert.deepEqual(await resolve("./index.ts", "/src/view.server.test.tsx"), { id: "/src/index.ts?rivet-target=server" });
  assert.deepEqual(await resolve("./util.mts", "/src/index.ts?rivet-target=server"), { id: "/src/util.mts?rivet-target=server" });
  assert.deepEqual(await resolve("./view.tsx", "/src/index.ts?rivet-target=server"), { id: "/src/view.tsx?rivet-target=server" });
});

test("runtime singletons and installed packages stay untagged (they load once)", async () => {
  assert.deepEqual(await resolve("@rivetjs/reactivity", "/src/view.server.test.tsx"), { id: "/node_modules/@rivetjs/reactivity/index.ts" });
});

test("a workspace .ts reached through a package specifier carries it (same instance as its relative imports)", async () => {
  assert.deepEqual(await resolve("@rivetjs/cdk/i18n", "/src/view.server.test.tsx"), { id: "/libs/cdk/i18n/index.ts?rivet-target=server" });
});

test("DOM-target importers tag nothing", async () => {
  assert.equal(await resolve("./index.ts", "/src/view.test.tsx"), null);
});

// Runtime switch modules: served like a default resumable app build (`@rivetjs/compiler/switches`).
const load = (options: Parameters<typeof rivetTest>[0], id: string) => (rivetTest(options).load as unknown as (id: string) => string | null)(id);

test("runtime switches: the derived adopt run switches opted in, workspace sources and installed packages", () => {
  assert.equal(load({}, "/repo/libs/runtime/derived.ts"), "export const DERIVED = true;\n");
  assert.equal(load({}, "/app/node_modules/@rivetjs/runtime/lazy-rows.js"), "export const LAZY_ROWS = true;\n");
  assert.equal(load({}, "/repo/libs/runtime/lazy-rows.ts?v=1"), "export const LAZY_ROWS = true;\n");
});

test("runtime switches: DOM data on by default, `resume: { domData: false }` opts out; other files untouched", () => {
  assert.equal(
    load({}, "/repo/libs/runtime/dom-data.ts"),
    'export const DOM_DATA = true;\nexport const DOM_READER = new URL("./dom-data-reader.ts", import.meta.url).href;\n',
  );
  assert.match(load({}, "/repo/libs/runtime/dom-data-derived.ts")!, /from "\.\/server-derived-dom\.ts"/);
  assert.equal(
    load({ resume: { domData: true } }, "/repo/libs/runtime/dom-data.ts"),
    'export const DOM_DATA = true;\nexport const DOM_READER = new URL("./dom-data-reader.ts", import.meta.url).href;\n',
  );
  assert.equal(load({ resume: { domData: false } }, "/repo/libs/runtime/dom-data.ts"), null);
  assert.equal(load({ resume: { domData: false } }, "/repo/libs/runtime/dom-data-derived.ts"), null);
  assert.equal(load({}, "/repo/libs/runtime/dom.ts"), null);
  assert.equal(load({}, "/repo/src/derived.ts"), null);
});
