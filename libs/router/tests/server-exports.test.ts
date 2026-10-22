// Route server exports are wrapper calls (`load(…)`, `onGet(…)`…, spec
// docs/design/specs/2026-10-20-server-exports-design.md): runtime normalization by tag, request handlers,
// plain `.ts` endpoint routes, codegen and types.
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
import { actions, entries, guard, headers, load, onDelete, onGet, onPost, onPut, onRequest, SERVER_EXPORT } from "../shared/server-exports.ts";

const render = (input: RenderInput) => new Response(JSON.stringify({ id: input.route.id, data: input.data }), { status: input.status, headers: input.headers });
const app = (routes: AppRoute[]) =>
  createHandler({ routes, render, renderError: ({ status, message, headers }) => new Response(`error ${status} ${message}`, { status, headers }) });
// Generated loaders hand the handler normalized modules.
const inline = (module: Record<string, unknown>) => async () => serverExports(module, "page.tsx");
const raw = (module: Record<string, unknown>) => async () => serverExports(module, "x.ts", true);

test("wrappers tag a fresh value with its kind; bad arguments throw", () => {
  const fn = () => 1;
  const h = () => new Response("x");
  const get = onGet(h),
    post = onPost(h);
  assert.notEqual(get, h);
  assert.ok(get({} as never) instanceof Response);
  assert.equal((get as unknown as Record<symbol, string>)[SERVER_EXPORT], "onGet");
  assert.equal((post as unknown as Record<symbol, string>)[SERVER_EXPORT], "onPost");
  assert.equal(SERVER_EXPORT, Symbol.for("rivet.server"));
  assert.deepEqual(Object.keys(get), []);
  const map = { save: fn };
  const forms = actions(map);
  assert.notEqual(forms, map);
  assert.deepEqual(Object.keys(forms), ["save"]);
  assert.throws(() => load(1 as never), /load\(\) expects a function/);
  assert.throws(() => actions({ save: 1 } as never), /`save` is not a function/);
});

test("serverExports: kinds by tag (any export name), plain prerender / csrf; duplicates and untagged magic names are errors", () => {
  const fn = () => 1;
  const module = {
    loader: load(fn),
    gate: guard(fn),
    prerender: true,
    csrf: false,
    GET: onGet(() => undefined),
    forms: actions({ a: fn }),
    paths: entries(() => []),
    extra: headers(() => undefined),
    helper: fn,
    default: fn,
  };
  const normalized = serverExports(module, "a.tsx");
  assert.deepEqual(Object.keys(normalized).sort(), ["actions", "csrf", "entries", "guard", "headers", "load", "onGet", "prerender"]);
  assert.equal(normalized.load, module.loader);
  assert.equal(serverExports(module, "a.tsx"), normalized);
  // One value under two names is one export.
  const loader = load(fn);
  assert.deepEqual(Object.keys(serverExports({ loader, alias: loader }, "b.tsx")), ["load"]);
  assert.throws(() => serverExports({ a: onGet(() => undefined), b: onGet(() => undefined) }, "c.tsx"), /c\.tsx: `a` and `b` are both `onGet\(…\)`; keep one/);
  assert.throws(() => serverExports({ onGet: fn }, "d.tsx"), /d\.tsx: `onGet` is not a server export: wrap it — `export const x = onGet\(…\)`/);
  assert.throws(() => serverExports({ serverLoad: fn }, "e.tsx"), /`serverLoad` is not a server export: wrap it — `export const x = load\(…\)`/);
  // Former sibling names: errors in raw server modules only (in pages they are ordinary exports).
  assert.deepEqual(serverExports({ load: fn, GET: fn }, "f.tsx"), {});
  assert.throws(() => serverExports({ GET: fn }, "f.server.ts", true), /`GET` is not a server export: wrap it — `export const x = onGet\(…\)`/);
  assert.throws(() => serverExports({ load: fn }, "g.server.ts", true), /`load` is not a server export/);
});

test("mergeServer: page + sibling by kind; one kind in both is an error; cached per module pair", () => {
  const fn = () => 1;
  const merged = mergeServer({ loader: load(fn) }, { access: guard(fn), forms: actions({}) }, ["a.tsx", "a.server.ts"]);
  assert.deepEqual(Object.keys(merged).sort(), ["actions", "guard", "load"]);
  const inline = { loader: load(fn) },
    sibling = { access: guard(fn) };
  assert.equal(mergeServer(inline, sibling), mergeServer(inline, sibling));
  assert.notEqual(mergeServer(inline, sibling), mergeServer(inline, { access: guard(fn) }));
  assert.throws(() => mergeServer({ a: load(fn) }, { b: load(fn) }, ["a.tsx", "a.server.ts"]), /a\.tsx and a\.server\.ts both define the route's `load`/);
});

test("handler: in-file loader data, onRequest/onGet middleware outer to inner, Response ends the request", async () => {
  const log: string[] = [];
  const handler = app([
    {
      id: "p",
      pattern: "/p",
      page: true,
      layouts: [inline({ middleware: onRequest(() => void log.push("layout onRequest")), GET: onGet(() => void log.push("layout onGet")) })],
      server: inline({
        middleware: onRequest(({ url }) => (log.push("page onRequest"), url.searchParams.has("stop") ? new Response("stopped") : undefined)),
        GET: onGet(() => void log.push("page onGet")),
        access: guard(() => void log.push("guard")),
        loader: load(() => ({ n: 1 })),
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
      server: inline({ PUT: onPut(() => undefined), DELETE: onDelete(() => new Response("gone", { status: 410 })) }),
    },
    { id: "plain", pattern: "/plain", page: true, layouts: [], server: inline({ loader: load(() => 1) }) },
    {
      id: "moved",
      pattern: "/moved",
      page: true,
      layouts: [],
      server: inline({
        GET: onGet(() => {
          throw redirect("/plain");
        }),
      }),
    },
  ]);
  assert.equal((await handler(new Request("http://x/form", { method: "PUT" }))).status, 200);
  assert.equal((await handler(new Request("http://x/form", { method: "DELETE" }))).status, 410);
  const patch = await handler(new Request("http://x/form", { method: "PATCH" }));
  assert.equal(patch.status, 405);
  assert.equal(patch.headers.get("allow"), "GET, HEAD, PUT, DELETE");
  const put = await handler(new Request("http://x/plain", { method: "PUT" }));
  assert.equal(put.status, 405);
  assert.equal(put.headers.get("allow"), "GET, HEAD");
  const moved = await handler(new Request("http://x/moved"));
  assert.equal(moved.status, 302);
  assert.equal(moved.headers.get("location"), "/plain");
});

test("handler: endpoint routes answer from on<Method>; must return a Response; an untagged former name fails the request", async () => {
  const handler = app([
    { id: "api", pattern: "/api", page: false, layouts: [], server: raw({ GET: onGet(() => Response.json({ ok: true })), POST: onPost(() => undefined) }) },
    { id: "legacy", pattern: "/legacy", page: false, layouts: [], server: raw({ GET: () => new Response("old") }) },
  ]);
  assert.deepEqual(await (await handler(new Request("http://x/api"))).json(), { ok: true });
  assert.equal((await handler(new Request("http://x/legacy"))).status, 500);
  const bad = await handler(new Request("http://x/api", { method: "POST" }));
  assert.equal(bad.status, 500);
  const none = await handler(new Request("http://x/api", { method: "DELETE" }));
  assert.equal(none.status, 405);
  assert.equal(none.headers.get("allow"), "GET, HEAD, POST");
});

test("route table: inline pages/layouts, plain .ts endpoints with handlers (kinds), helpers ignored, conflicts", () => {
  const exports = new Map([
    ["items/[id].tsx", ["load"]],
    ["_layout.tsx", ["guard"]],
    ["api/health.ts", ["onGet"]],
    ["api/proxy.ts", ["?"]],
    ["api/data.ts", ["load"]],
  ]);
  const table = routeTable(
    ["items/[id].tsx", "items/[id].server.ts", "_layout.tsx", "api/health.ts", "api/proxy.ts", "api/data.ts", "lib/helpers.ts", "about.tsx"],
    exports,
  );
  const item = table.routes.find((r) => r.id === "items/[id]")!;
  assert.deepEqual(
    [item.page, item.server, item.inline, item.layouts[0]],
    ["items/[id].tsx", "items/[id].server.ts", true, { page: "_layout.tsx", inline: true }],
  );
  const health = table.routes.find((r) => r.id === "api/health")!;
  assert.deepEqual([health.page, health.server], [undefined, "api/health.ts"]);
  assert.ok(!table.routes.some((r) => r.id === "lib/helpers"));
  // A re-export from a server-only module may be a handler (kind known at runtime); a loader alone is not an endpoint.
  assert.equal(table.routes.find((r) => r.id === "api/proxy")!.server, "api/proxy.ts");
  assert.ok(!table.routes.some((r) => r.id === "api/data"));
  assert.equal(table.routes.find((r) => r.id === "about")!.inline, undefined);
  assert.throws(() => routeTable(["x.ts", "x.server.ts"], new Map([["x.ts", ["onGet"]]])), /both server modules of x/);
});

test("scanRoutes reads server export kinds from route modules (needs the wrapper-aware compiler wasm)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rivet-scan-"));
  try {
    await mkdir(join(dir, "api"));
    const router = 'import { load, onGet } from "@rivetjs/router";\n';
    await writeFile(join(dir, "index.tsx"), router + "export const anything = load(() => 1);\nexport default function P() { return <p />; }\n");
    await writeFile(join(dir, "flag.tsx"), "export const prerender = true;\nexport default function P() { return <p />; }\n");
    await writeFile(join(dir, "plain.tsx"), "export const onClick = 1;\nexport default function P() { return <p />; }\n");
    await writeFile(join(dir, "api/ping.ts"), router + "export const ping = onGet(() => new Response('pong'));\n");
    await writeFile(join(dir, "api/util.ts"), "export const helper = 1;\n");
    const table = await scanRoutes(dir);
    const byId = Object.fromEntries(table.routes.map((r) => [r.id, r]));
    assert.equal(byId["index"]!.inline, true);
    assert.equal(byId["flag"]!.inline, true);
    assert.equal(byId["plain"]!.inline, undefined);
    assert.equal(byId["api/ping"]!.server, "api/ping.ts");
    assert.equal(byId["api/util"], undefined);
    // An untagged former magic name / two exports of one kind: the scan fails with the compiler's message.
    await writeFile(join(dir, "api/old.ts"), "export const onGet = () => new Response('old');\n");
    await assert.rejects(scanRoutes(dir), /api\/old\.ts:1:1: Untagged server export `onGet`/);
    await writeFile(join(dir, "api/old.ts"), router + "export const a = onGet(() => undefined);\nexport const b = onGet(() => undefined);\n");
    await assert.rejects(scanRoutes(dir), /Duplicate server export: `a` and `b` are both `onGet\(…\)`/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("codegen: inline, merged and sibling server loaders (normalized), RouteData types by tag, CSR error", () => {
  const files = ["_layout.tsx", "index.tsx", "items/[id].tsx", "items/[id].server.ts", "old.tsx", "old.server.ts"];
  const exports = new Map([
    ["_layout.tsx", ["guard"]],
    ["index.tsx", ["load"]],
    ["items/[id].tsx", ["load"]],
  ]);
  const out = generate(routeTable(files, exports), { routesDir: "src/routes" });
  const routes = out.files["routes.ts"]!;
  assert.match(routes, /import \{ mergeServer, serverExports, type AppRoute \} from "@rivetjs\/router\/server";/);
  assert.match(
    routes,
    /\{ id: "index", pattern: "\/", page: true, layouts: \[once\(async \(\) => serverExports\(L0, "src\/routes\/_layout\.tsx"\)\)\], keys: \["\/"\], server: once\(async \(\) => serverExports\(await import\("\.\.\/src\/routes\/index\.tsx"\), "src\/routes\/index\.tsx"\)\) \}/,
  );
  assert.match(
    routes,
    /server: once\(async \(\) => mergeServer\(await import\("\.\.\/src\/routes\/items\/\[id\]\.tsx"\), await import\("\.\.\/src\/routes\/items\/\[id\]\.server\.ts"\), \["src\/routes\/items\/\[id\]\.tsx","src\/routes\/items\/\[id\]\.server\.ts"\]\)/,
  );
  assert.match(
    routes,
    /\{ id: "old", [^\n]*server: once\(async \(\) => serverExports\(await import\("\.\.\/src\/routes\/old\.server\.ts"\), "src\/routes\/old\.server\.ts", true\)\) \}/,
  );
  const types = out.files["routes.d.ts"]!;
  assert.match(types, /interface RouteData \{/);
  assert.match(types, /"index": ModuleData<typeof import\("\.\.\/src\/routes\/index\.tsx"\)>;/);
  assert.match(
    types,
    /"items\/\[id\]": ModuleData<typeof import\("\.\.\/src\/routes\/items\/\[id\]\.tsx"\)> & ModuleData<typeof import\("\.\.\/src\/routes\/items\/\[id\]\.server\.ts"\)>;/,
  );
  assert.doesNotMatch(types, /InlineData/);
  assert.match(types, /"old": ModuleData<typeof import\("\.\.\/src\/routes\/old\.server\.ts"\)>;/);
  // Sibling-only apps import `serverExports` only; apps without server modules import types only.
  const sibling = generate(routeTable(["index.tsx", "index.server.ts"]), { routesDir: "src/routes" }).files["routes.ts"]!;
  assert.match(sibling, /^import \{ serverExports, type AppRoute \} from "@rivetjs\/router\/server";$/m);
  const none = generate(routeTable(["index.tsx"]), { routesDir: "src/routes" }).files["routes.ts"]!;
  assert.match(none, /^import type \{ AppRoute \} from "@rivetjs\/router\/server";$/m);
  assert.throws(
    () => generate(routeTable(["index.tsx"], new Map([["index.tsx", ["load"]]])), { routesDir: "src/routes", mode: "csr" }),
    /CSR apps have no server.*index\.tsx/,
  );
});

test("types: PageProps<typeof loader>, Unchecked, RequestEvent<route id>, serializability, wrapper typing", async () => {
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
