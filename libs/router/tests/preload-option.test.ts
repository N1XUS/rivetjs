// `createApp({ preload: { background, lean } })`: the app's background prefetch budget reaches the resume planner, as a number
// or per request URL (docs-kit example frames pass `0`). A `visible` chunk within the budget plans as `P` (visible +
// idle-time background prefetch), outside it as `v` (viewport only).
// Run: `npx vitest run --project router libs/router/tests/preload-option.test.ts`.
import { test } from "vitest";
import assert from "node:assert/strict";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { createApp } from "../server/app.ts";
import { compileResume, importServer } from "../../runtime/tests/resume/compile.ts";

const source = `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/server";
export function Rows() {
  const picked = signal("");
  return <ul><For each={() => ["a", "b", "c", "d"]} by={(x) => x}>{(x) => <li><button onClick={() => picked.set(x())}>{x()}</button></li>}</For></ul>;
}
`;
const symbols = compileResume(source, "dom").symbols;
const { Rows } = await importServer<{ Rows: () => unknown }>(compileResume(source, "server").code);
// `sizes`: a build manifest field beyond the public `ResumeManifest` contract.
const manifest = {
  runtime: "/rt.js",
  symbols: Object.fromEntries(symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
  sizes: { "/c/Rows.js": 4_000 },
} as ResumeManifest;
const entry = {
  routes: [{ id: "p", pattern: "/*rest", page: true, layouts: [] }],
  universal: {},
  page: () => Rows,
  document: () => ({ start: "<body>", end: "</body>" }),
};
const strategy = async (preload: Parameters<typeof createApp>[0]["preload"], path = "/p") => {
  const html = await (await createApp({ entry: entry as never, manifest, csp: false, ...(preload ? { preload } : {}) })(new Request("http://x" + path))).text();
  const plan = /data-preload="([^"]*)"/.exec(html)?.[1];
  assert.ok(plan, html);
  return (JSON.parse(plan.replaceAll("&quot;", '"')) as [string, ...[string, string][]]).slice(1).find(([url]) => url === "/c/Rows.js")?.[1];
};

test("createApp preload.background: default budget, a number, a per-URL function", async () => {
  assert.equal(await strategy(undefined), "P");
  assert.equal(await strategy({ background: 0 }), "v");
  assert.equal(await strategy({ background: 3_000 }), "v");
  const frames = { background: (url: URL) => (url.pathname.startsWith("/frame/") ? 0 : undefined) };
  assert.equal(await strategy(frames, "/frame/a"), "v");
  assert.equal(await strategy(frames, "/page"), "P");
});

test("createApp preload.lean: no preload schedule on lean pages, as a boolean or per URL", async () => {
  const planned = async (preload: Parameters<typeof createApp>[0]["preload"], path = "/p") =>
    /data-preload=/.test(
      await (await createApp({ entry: entry as never, manifest, csp: false, ...(preload ? { preload } : {}) })(new Request("http://x" + path))).text(),
    );
  assert.equal(await planned({ lean: true }), false);
  const home = { lean: (url: URL) => url.pathname === "/" || undefined };
  assert.equal(await planned(home, "/"), false);
  assert.equal(await planned(home, "/page"), true);
});

test("rivetRouter preload: codegen exports the app default; createApp uses it unless its own preload is set", async () => {
  const { generate } = await import("../build/codegen.ts");
  const { routeTable } = await import("../build/routes.ts");
  const { rivetRouter } = await import("../build/vite.ts");
  const table = routeTable(["index.tsx"]);
  assert.match(generate(table, { routesDir: "src/routes", preloadBackground: 0 }).files["entry.server.tsx"]!, /export const preloadBackground = 0;/);
  assert.doesNotMatch(generate(table, { routesDir: "src/routes" }).files["entry.server.tsx"]!, /preloadBackground/);
  assert.throws(() => rivetRouter({ preload: { background: -1 } }), /preload\.background must be a non-negative number/);
  const off = { ...entry, preloadBackground: 0 };
  const html = async (config: Record<string, unknown>) =>
    (await (await createApp({ entry: off as never, manifest, csp: false, ...config })(new Request("http://x/p"))).text()).includes("&quot;P&quot;");
  assert.equal(await html({}), false);
  assert.equal(await html({ preload: { background: 1 << 20 } }), true);
});

test("fetch-ahead of islands-only lean pages (bridge D-lean): codegen exports it with document prefetch; createApp passes preload.ahead", async () => {
  const { generate } = await import("../build/codegen.ts");
  const { routeTable } = await import("../build/routes.ts");
  const table = routeTable(["index.tsx"]);
  const server = (options: Record<string, unknown>) =>
    generate(table, { routesDir: "src/routes", document: "src/document.ts", ...options }).files["entry.server.tsx"]!;
  assert.match(server({ prefetch: "document" }), /export const fetchAhead = true;/);
  assert.doesNotMatch(server({}), /fetchAhead/);
  // What the render's lean tail provider sees (`_rLean`: the bridge's islands collector reads `preload.ahead` through it).
  const { _rLean } = await import("@rivetjs/runtime/server-resume");
  let seen: unknown = "unset";
  const probe = {
    ...entry,
    page: () => () => (
      _rLean(() => ({ tail: (view: unknown) => ((seen = (view as { options: { preload?: { ahead?: boolean } } }).options.preload?.ahead), null) })),
      Rows()
    ),
  };
  const ahead = async (entryAhead: boolean | undefined, preload?: Record<string, unknown>) => {
    seen = "unset";
    const app = createApp({
      entry: { ...probe, ...(entryAhead === undefined ? {} : { fetchAhead: entryAhead }) } as never,
      manifest,
      csp: false,
      ...(preload ? { preload } : {}),
    });
    await (await app(new Request("http://x/p"))).text();
    return seen;
  };
  assert.equal(await ahead(true), true);
  assert.equal(await ahead(undefined), undefined);
  assert.equal(await ahead(true, { ahead: false }), undefined);
  assert.equal(await ahead(undefined, { ahead: true }), true);
});
