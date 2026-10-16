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
    source.startsWith("@") ? { id: `/node_modules/${source}/index.ts` } : { id: `/src/${source.replace(/^\.\//, "")}` },
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

test("package specifiers stay untagged (runtime singletons load once)", async () => {
  assert.deepEqual(await resolve("@rivetjs/reactivity", "/src/view.server.test.tsx"), { id: "/node_modules/@rivetjs/reactivity/index.ts" });
});

test("DOM-target importers tag nothing", async () => {
  assert.equal(await resolve("./index.ts", "/src/view.test.tsx"), null);
});
