// In-file route server exports (`serverLoad`…), request handlers (`onRequest`, `onGet`…), plain `.ts`
// endpoint routes, sibling migration names, codegen and types.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHandler, type AppRoute, type RenderInput } from "../server/handler.ts";
import { mergeServer, serverExports } from "../server/module.ts";
import { routeTable, scanRoutes } from "../build/routes.ts";
import { generate } from "../build/codegen.ts";
import { redirect } from "../shared/errors.ts";

const render = (input: RenderInput) => new Response(JSON.stringify({ id: input.route.id, data: input.data }), { status: input.status, headers: input.headers });
const app = (routes: AppRoute[]) =>
  createHandler({ routes, render, renderError: ({ status, message, headers }) => new Response(`error ${status} ${message}`, { status, headers }) });
// Generated loaders hand the handler normalized in-file modules.
const inline = (module: Record<string, unknown>) => async () => serverExports(module, false);
const raw = (module: Record<string, unknown>) => async () => module;

test("in-file names normalize; sibling modules accept old names; both in one sibling or across files is an error", () => {
  const load = () => 1;
  assert.deepEqual(Object.keys(serverExports({ serverLoad: load, serverGuard: load, prerender: true, onGet: load, default: load, load }, false)), [
    "load",
    "guard",
    "prerender",
    "onGet",
  ]);
  // In-file modules: `load` is an ordinary export.
  assert.equal(serverExports({ load }, false).load, undefined);
  assert.equal(serverExports({ load }, true).load, load);
  assert.equal(serverExports({ GET: load }, true).GET, load);
  assert.throws(() => serverExports({ load, serverLoad: load }, true, "a.server.ts"), /a\.server\.ts: exports both `load` and `serverLoad`/);
  const merged = mergeServer({ serverLoad: load }, { guard: load, serverActions: {} }, ["a.tsx", "a.server.ts"]);
  assert.deepEqual(Object.keys(merged).sort(), ["actions", "guard", "load"]);
  // Cached per (inline, sibling) pair; other module objects (a hot edit) merge again.
  const inline = { serverLoad: load },
    sibling = { guard: load };
  assert.equal(mergeServer(inline, sibling), mergeServer(inline, sibling));
  assert.notEqual(mergeServer(inline, sibling), mergeServer(inline, { guard: load }));
  assert.throws(() => mergeServer({ serverLoad: load }, { load }, ["a.tsx", "a.server.ts"]), /a\.tsx and a\.server\.ts both define the route's `load`/);
});

test("handler: in-file loader data, onRequest/onGet middleware outer to inner, Response ends the request", async () => {
  const log: string[] = [];
  const handler = app([
    {
      id: "p",
      pattern: "/p",
      page: true,
      layouts: [inline({ onRequest: () => void log.push("layout onRequest"), onGet: () => void log.push("layout onGet") })],
      server: inline({
        onRequest: ({ url }: { url: URL }) => (log.push("page onRequest"), url.searchParams.has("stop") ? new Response("stopped") : undefined),
        onGet: () => void log.push("page onGet"),
        serverGuard: () => void log.push("guard"),
        serverLoad: () => ({ n: 1 }),
      }),
    },
  ]);
  const ok = await handler(new Request("http://x/p"));
  assert.equal(ok.status, 200);
  assert.deepEqual(JSON.parse(await ok.text()).data, [null, { n: 1 }]);
  assert.deepEqual(log, ["layout onRequest", "layout onGet", "page onRequest", "page onGet", "guard"]);
  log.length = 0;
  assert.equal(await (await handler(new Request("http://x/p?stop"))).text(), "stopped");
  assert.deepEqual(log, ["layout onRequest", "layout onGet", "page onRequest"]);
});

test("handler: page routes accept methods their module handles; undefined renders the page; thrown redirects apply", async () => {
  const handler = app([
    {
      id: "form",
      pattern: "/form",
      page: true,
      layouts: [],
      server: inline({ onPut: () => undefined, onDelete: () => new Response("gone", { status: 410 }) }),
    },
    { id: "plain", pattern: "/plain", page: true, layouts: [], server: inline({ serverLoad: () => 1 }) },
    {
      id: "moved",
      pattern: "/moved",
      page: true,
      layouts: [],
      server: inline({
        onGet: () => {
          throw redirect("/plain");
        },
      }),
    },
  ]);
  assert.equal((await handler(new Request("http://x/form", { method: "PUT" }))).status, 200);
  assert.equal((await handler(new Request("http://x/form", { method: "DELETE" }))).status, 410);
  const patch = await handler(new Request("http://x/form", { method: "PATCH" }));
  assert.equal(patch.status, 405);
  assert.equal(patch.headers.get("allow"), "GET, HEAD, POST, PUT, DELETE");
  const put = await handler(new Request("http://x/plain", { method: "PUT" }));
  assert.equal(put.status, 405);
  assert.equal(put.headers.get("allow"), "GET, HEAD, POST");
  const moved = await handler(new Request("http://x/moved"));
  assert.equal(moved.status, 302);
  assert.equal(moved.headers.get("location"), "/plain");
});

test("handler: endpoint routes answer from on<Method> (or legacy GET in a sibling); must return a Response", async () => {
  const handler = app([
    { id: "api", pattern: "/api", page: false, layouts: [], server: raw({ onGet: () => Response.json({ ok: true }), onPost: () => undefined }) },
    { id: "legacy", pattern: "/legacy", page: false, layouts: [], server: raw({ GET: () => new Response("old") }) },
  ]);
  assert.deepEqual(await (await handler(new Request("http://x/api"))).json(), { ok: true });
  assert.equal(await (await handler(new Request("http://x/legacy"))).text(), "old");
  const bad = await handler(new Request("http://x/api", { method: "POST" }));
  assert.equal(bad.status, 500);
  const none = await handler(new Request("http://x/api", { method: "DELETE" }));
  assert.equal(none.status, 405);
  assert.equal(none.headers.get("allow"), "GET, HEAD, POST");
});

test("route table: inline pages/layouts, plain .ts endpoints with handlers, helpers ignored, conflicts", () => {
  const exports = new Map([
    ["items/[id].tsx", ["serverLoad"]],
    ["_layout.tsx", ["serverGuard"]],
    ["api/health.ts", ["onGet"]],
  ]);
  const table = routeTable(["items/[id].tsx", "items/[id].server.ts", "_layout.tsx", "api/health.ts", "lib/helpers.ts", "about.tsx"], exports);
  const item = table.routes.find((r) => r.id === "items/[id]")!;
  assert.deepEqual(
    [item.page, item.server, item.inline, item.layouts[0]],
    ["items/[id].tsx", "items/[id].server.ts", true, { page: "_layout.tsx", inline: true }],
  );
  const health = table.routes.find((r) => r.id === "api/health")!;
  assert.deepEqual([health.page, health.server], [undefined, "api/health.ts"]);
  assert.ok(!table.routes.some((r) => r.id === "lib/helpers"));
  assert.equal(table.routes.find((r) => r.id === "about")!.inline, undefined);
  assert.throws(() => routeTable(["x.ts", "x.server.ts"], new Map([["x.ts", ["onGet"]]])), /both server modules of x/);
});

test("scanRoutes reads server exports from route modules", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rivet-scan-"));
  try {
    await mkdir(join(dir, "api"));
    await writeFile(join(dir, "index.tsx"), "export const serverLoad = () => 1;\nexport default function P() { return <p />; }\n");
    await writeFile(join(dir, "flag.tsx"), "export const prerender = true;\nexport default function P() { return <p />; }\n");
    await writeFile(join(dir, "plain.tsx"), "export const onClick = 1;\nexport default function P() { return <p />; }\n");
    await writeFile(join(dir, "api/ping.ts"), "export const onGet = () => new Response('pong');\n");
    await writeFile(join(dir, "api/util.ts"), "export const helper = 1;\n");
    const table = await scanRoutes(dir);
    const byId = Object.fromEntries(table.routes.map((r) => [r.id, r]));
    assert.equal(byId["index"]!.inline, true);
    assert.equal(byId["flag"]!.inline, true);
    assert.equal(byId["plain"]!.inline, undefined);
    assert.equal(byId["api/ping"]!.server, "api/ping.ts");
    assert.equal(byId["api/util"], undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("codegen: inline and merged server loaders, RouteData types, sibling-only output unchanged, CSR error", () => {
  const files = ["_layout.tsx", "index.tsx", "items/[id].tsx", "items/[id].server.ts", "old.tsx", "old.server.ts"];
  const exports = new Map([
    ["_layout.tsx", ["serverGuard"]],
    ["index.tsx", ["serverLoad"]],
    ["items/[id].tsx", ["serverLoad"]],
  ]);
  const out = generate(routeTable(files, exports), { routesDir: "src/routes" });
  const routes = out.files["routes.ts"]!;
  assert.match(routes, /import \{ mergeServer, serverExports, type AppRoute \} from "@rivetjs\/router\/server";/);
  assert.match(
    routes,
    /\{ id: "index", pattern: "\/", page: true, layouts: \[once\(async \(\) => serverExports\(L0, false, "src\/routes\/_layout\.tsx"\)\)\], keys: \["\/"\], server: once\(async \(\) => serverExports\(await import\("\.\.\/src\/routes\/index\.tsx"\), false, "src\/routes\/index\.tsx"\)\) \}/,
  );
  assert.match(
    routes,
    /server: once\(async \(\) => mergeServer\(await import\("\.\.\/src\/routes\/items\/\[id\]\.tsx"\), await import\("\.\.\/src\/routes\/items\/\[id\]\.server\.ts"\), \["src\/routes\/items\/\[id\]\.tsx","src\/routes\/items\/\[id\]\.server\.ts"\]\)/,
  );
  assert.match(routes, /\{ id: "old", [^\n]*server: once\(\(\) => import\("\.\.\/src\/routes\/old\.server\.ts"\)\) \}/);
  const types = out.files["routes.d.ts"]!;
  assert.match(types, /interface RouteData \{/);
  assert.match(types, /"index": InlineData<typeof import\("\.\.\/src\/routes\/index\.tsx"\)>;/);
  assert.match(
    types,
    /"items\/\[id\]": InlineData<typeof import\("\.\.\/src\/routes\/items\/\[id\]\.tsx"\)> & ModuleData<typeof import\("\.\.\/src\/routes\/items\/\[id\]\.server\.ts"\)>;/,
  );
  assert.match(types, /"old": ModuleData<typeof import\("\.\.\/src\/routes\/old\.server\.ts"\)>;/);
  // An app without in-file server exports generates what it did before.
  const before = generate(routeTable(["index.tsx", "index.server.ts"]), { routesDir: "src/routes" }).files["routes.ts"]!;
  assert.match(before, /^import type \{ AppRoute \} from "@rivetjs\/router\/server";$/m);
  assert.throws(
    () => generate(routeTable(["index.tsx"], new Map([["index.tsx", ["serverLoad"]]])), { routesDir: "src/routes", mode: "csr" }),
    /CSR apps have no server.*index\.tsx/,
  );
});

test("types: PageProps<typeof serverLoad>, Unchecked, RequestEvent<route id>, serializability", async () => {
  const { default: ts } = await import("typescript");
  const program = ts.createProgram([new URL("./server-exports-types.tsx", import.meta.url).pathname], {
    strict: true,
    noEmit: true,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: "@rivetjs/runtime",
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    lib: ["lib.es2023.d.ts", "lib.dom.d.ts"],
    allowImportingTsExtensions: true,
  });
  assert.deepEqual(
    ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    [],
  );
});
