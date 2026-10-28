// Route sheets vs Vite's CSS preload lists (`build/route-css.ts` `cssDepsPlan` / `rewriteCSSDeps`, ROUTE-CSS): a
// dynamic import's preload list never names a stylesheet the page already has (the host's, inside the target route's
// merged sheet), so a resumed page's first interaction loads no CSS it was served; a client navigation loads the
// target's route sheet; a lazily loaded part still loads its own stylesheets before it runs, and the ones a merged route
// sheet of a route reaching the importer holds only when the page does not have that sheet (CSS-LAZY, run-time check).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readdir, readFile, rm } from "node:fs/promises";
import type { Rollup } from "vite";
import { build } from "vite";
import { cssDepsMarker, cssDepsPlan, MAX_CHECKED_SHEETS, pageSheets, rewriteCSSDeps, routeSheets } from "../build/route-css.ts";
import type { RouteTable } from "../build/routes.ts";
import { withNodeEnv } from "./vite-env.ts";

const chunk = (fileName: string, options: { modules?: string[]; imports?: string[]; dynamic?: string[]; css?: string[] }): Rollup.OutputChunk =>
  ({
    type: "chunk",
    fileName,
    isEntry: false,
    facadeModuleId: null,
    moduleIds: options.modules ?? [],
    imports: options.imports ?? [],
    dynamicImports: options.dynamic ?? [],
    viteMetadata: { importedCss: new Set(options.css ?? []), importedAssets: new Set() },
  }) as unknown as Rollup.OutputChunk;

const bundle = {
  "app.js": chunk("app.js", { modules: ["/r/_layout.tsx"], imports: ["ui.js"], css: ["assets/layout.css"] }),
  "ui.js": chunk("ui.js", { css: ["assets/ui.css"] }),
  "index.js": chunk("index.js", { modules: ["/r/index.tsx"], imports: ["ui.js", "card.js"] }),
  "card.js": chunk("card.js", { css: ["assets/card.css"] }),
  "about.js": chunk("about.js", { modules: ["/r/about.tsx"], imports: ["card.js"], css: ["assets/about.css"] }),
  "panel.js": chunk("panel.js", { imports: ["card.js", "ui.js"], css: ["assets/panel.css"] }),
} as unknown as Rollup.OutputBundle;
const table = {
  routes: [
    { id: "/", page: "index.tsx", layouts: [{ page: "_layout.tsx" }] },
    { id: "/about", page: "about.tsx", layouts: [{ page: "_layout.tsx" }] },
  ],
} as unknown as RouteTable;
const lists = {
  "/": ["/assets/ui.css", "/assets/layout.css", "/assets/card.css"],
  "/about": ["/assets/ui.css", "/assets/layout.css", "/assets/card.css", "/assets/about.css"],
};
const merged = { "/": ["/assets/route-a.css"], "/about": ["/assets/route-b.css"] };

test("route CSS deps: route page chunks map to their merged route sheet; a page on two different sheets has none", () => {
  const sheets = pageSheets(bundle, table, "/r", "/", lists, merged);
  assert.deepEqual([...sheets.keys()], ["index.js", "about.js"]);
  assert.deepEqual(sheets.get("index.js"), { sheet: "assets/route-a.css", parts: new Set(["assets/ui.css", "assets/layout.css", "assets/card.css"]) });
  const twice = { routes: [...table.routes, { id: "/home", page: "index.tsx", layouts: [] }] } as unknown as RouteTable;
  const other = pageSheets(
    bundle,
    twice,
    "/r",
    "/",
    { ...lists, "/home": ["/assets/ui.css", "/assets/card.css"] },
    { ...merged, "/home": ["/assets/route-c.css"] },
  );
  assert.deepEqual([...other.keys()], ["about.js"]);
  // A list of one file is linked as is (no merged sheet): nothing to map.
  assert.equal(pageSheets(bundle, table, "/r", "/", { "/": ["/assets/card.css"] }, { "/": ["/assets/card.css"] }).size, 0);
});

test("route CSS deps: a page import lists its route sheet, a lazy part's list drops the host's stylesheets only", () => {
  const sheets = pageSheets(bundle, table, "/r", "/", lists, merged);
  // App → route page: the host's (layout + ui) dropped, the page's own in the route sheet → the route sheet.
  assert.deepEqual(cssDepsPlan(bundle, "app.js", "index.js", sheets), {
    drop: new Set(["assets/ui.css", "assets/card.css"]),
    add: ["assets/route-a.css"],
  });
  assert.deepEqual(cssDepsPlan(bundle, "app.js", "about.js", sheets), {
    drop: new Set(["assets/about.css", "assets/card.css"]),
    add: ["assets/route-b.css"],
  });
  // Page → lazily loaded part: card + ui come with the page; panel.css still loads before the part runs.
  assert.deepEqual(cssDepsPlan(bundle, "index.js", "panel.js", sheets), { drop: new Set(["assets/card.css", "assets/ui.css"]), add: [] });
  // Nothing the page has: no plan.
  assert.equal(cssDepsPlan(bundle, "about.js", "ui.js", new Map()), undefined);
  assert.equal(cssDepsPlan(bundle, "ui.js", "card.js", new Map()), undefined);
});

test("route CSS deps: a lazy part's stylesheets inside the route sheets of routes reaching its importer are checked at run time", () => {
  // The layout (app.js, on both routes) lazily loads drawer.js: card + badge components and its own stylesheet.
  const lazy = {
    ...bundle,
    "app.js": chunk("app.js", { modules: ["/r/_layout.tsx"], imports: ["ui.js"], dynamic: ["drawer.js"], css: ["assets/layout.css"] }),
    "about.js": chunk("about.js", { modules: ["/r/about.tsx"], imports: ["card.js", "badge.js"], css: ["assets/about.css"] }),
    "badge.js": chunk("badge.js", { css: ["assets/badge.css"] }),
    "drawer.js": chunk("drawer.js", { imports: ["card.js", "badge.js", "ui.js"], css: ["assets/drawer.css"] }),
  } as unknown as Rollup.OutputBundle;
  const withBadge = { ...lists, "/about": [...lists["/about"], "/assets/badge.css"] };
  const routes = routeSheets(lazy, table, "/r", "/", withBadge, merged);
  assert.deepEqual([...routes.sheets.keys()], ["assets/route-a.css", "assets/route-b.css"]);
  assert.deepEqual(routes.of("app.js"), ["assets/route-a.css", "assets/route-b.css"]);
  assert.deepEqual(routes.of("about.js"), ["assets/route-b.css"]);
  assert.deepEqual(routes.of("drawer.js"), ["assets/route-a.css", "assets/route-b.css"], "reached through the layout's dynamic import");
  const sheets = pageSheets(lazy, table, "/r", "/", withBadge, merged);
  // ui.css comes with the layout (dropped); card is in both sheets, badge in /about's only; drawer.css in none.
  assert.deepEqual(cssDepsPlan(lazy, "app.js", "drawer.js", sheets, routes), {
    drop: new Set(["assets/ui.css"]),
    add: [],
    check: [
      { sheet: "assets/route-a.css", files: ["assets/card.css"] },
      { sheet: "assets/route-b.css", files: ["assets/badge.css", "assets/card.css"] },
    ],
  });
  // The /about page → drawer: card + badge come with the page; ui (the layout's) is checked in route-b, the only sheet
  // of a route reaching about.js.
  assert.deepEqual(cssDepsPlan(lazy, "about.js", "drawer.js", sheets, routes), {
    drop: new Set(["assets/badge.css", "assets/card.css"]),
    add: [],
    check: [{ sheet: "assets/route-b.css", files: ["assets/ui.css"] }],
  });
  // Without route sheets: the ROUTE-CSS plan.
  assert.deepEqual(cssDepsPlan(lazy, "app.js", "drawer.js", sheets), { drop: new Set(["assets/ui.css"]), add: [] });
  // A route page import never checks the sheet it adds.
  assert.equal(cssDepsPlan(lazy, "app.js", "index.js", sheets, routes)!.check, undefined);
  // At most MAX_CHECKED_SHEETS sheets, the ones most routes reaching the host link first.
  const many = {
    routes: Array.from({ length: MAX_CHECKED_SHEETS + 2 }, (_, i) => ({ id: "r" + i, page: "about.tsx", layouts: [{ page: "_layout.tsx" }] })),
  } as unknown as RouteTable;
  const manyLists = Object.fromEntries(many.routes.map((r) => [r.id, ["/assets/card.css", "/assets/x" + r.id + ".css"]]));
  const manyMerged = Object.fromEntries(many.routes.map((r, i) => [r.id, ["/assets/route-" + (i < 2 ? "shared" : r.id) + ".css"]]));
  const manyPlan = cssDepsPlan(lazy, "app.js", "drawer.js", new Map(), routeSheets(lazy, many, "/r", "/", manyLists, manyMerged))!;
  assert.equal(manyPlan.check!.length, MAX_CHECKED_SHEETS);
  assert.equal(manyPlan.check![0]!.sheet, "assets/route-shared.css");
});

const mapDeps = (files: string[]) => `const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=${JSON.stringify(files)})))=>i.map(i=>d[i]);\n`;
const depsOf = (code: string): string[][] => {
  const start = code.indexOf("m.f=") + 4;
  const files = JSON.parse(code.slice(start, code.indexOf("])))=>", start) + 1)) as string[];
  return [...code.matchAll(/__vite__mapDeps\(\[([\d,]*)\]\)/g)].map((m) => (m[1] ? m[1].split(",").map((i) => files[Number(i)]!) : []));
};

test("route CSS deps: marked preload lists get their plan; unmarked lists, JS deps and unknown stylesheets stay", () => {
  const plans = [
    { drop: new Set(["assets/ui.css", "assets/card.css"]), add: ["assets/route-a.css"] },
    { drop: new Set(["assets/card.css"]), add: [] },
  ];
  const files = [
    "assets/index.js",
    "assets/x.js",
    cssDepsMarker(0),
    "assets/ui.css",
    "assets/card.css",
    "assets/panel.js",
    cssDepsMarker(1),
    "assets/panel.css",
    "assets/pure.css",
  ];
  const code =
    mapDeps(files) +
    "e(()=>import(`./index.js`),__vite__mapDeps([0,1,2,3,4]));" +
    "e(()=>import(`./panel.js`).then(m=>m.n),__vite__mapDeps([5,6,4,7,8]));" +
    "e(()=>import(`./other.js`),__vite__mapDeps([1,4]));";
  const out = rewriteCSSDeps(code, "assets/app.js", plans, false)!;
  assert.deepEqual(depsOf(out), [
    ["assets/index.js", "assets/x.js", "assets/route-a.css"],
    ["assets/panel.js", "assets/panel.css", "assets/pure.css"],
    ["assets/x.js", "assets/card.css"],
  ]);
  assert.ok(!out.includes("__rivet_css__"), "markers gone");
  // The list naming a route sheet skips it when the page has it inline (`<style data-href>`): one helper, one wrapped call.
  assert.equal(out.split("const __rivet_inlined__=").length, 2);
  assert.equal(out.split("__rivet_inlined__(__vite__mapDeps(").length, 2);
  assert.ok(out.indexOf("const __rivet_inlined__=") < out.indexOf("const __vite__mapDeps="));
  // Padded: calls that shrink keep their length (source map columns).
  const dropOnly = [plans[1]!, plans[1]!];
  const padded = rewriteCSSDeps(code, "assets/app.js", dropOnly, false, true)!;
  assert.deepEqual(depsOf(padded), depsOf(rewriteCSSDeps(code, "assets/app.js", dropOnly, false)!));
  assert.equal(padded.slice(padded.indexOf("\n")).length, code.slice(code.indexOf("\n")).length);
  // No marker: untouched.
  assert.equal(rewriteCSSDeps(mapDeps(["assets/a.js", "assets/a.css"]) + "__vite__mapDeps([0,1])", "assets/app.js", plans, false), null);
});

test("route CSS deps: the inline helper drops stylesheets the page has as <style data-href>, keeps the rest", () => {
  const code = rewriteCSSDeps(
    mapDeps(["assets/i.js", cssDepsMarker(0), "assets/a.css"]) + "globalThis.out=__vite__mapDeps([0,1,2]);",
    "assets/app.js",
    [{ drop: new Set(["assets/a.css"]), add: ["assets/route-a.css", "assets/route-b.css"] }],
    false,
  )!;
  const inline = new Set(["/assets/route-a.css"]);
  const document = {
    querySelector: (selector: string) => ([...inline].some((href) => selector === `style[data-href$="/${href.split("/").pop()}"]`) ? {} : null),
  };
  const scope: { out?: string[] } = {};
  new Function("document", "globalThis", code)(document, scope);
  assert.deepEqual(scope.out, ["assets/i.js", "assets/route-b.css"]);
});

test("route CSS deps: checked calls skip the stylesheets of a route sheet the page has (linked or inline), keep the rest", () => {
  const plans = [
    {
      drop: new Set<string>(),
      add: [],
      check: [
        { sheet: "assets/route-a.css", files: ["assets/card.css"] },
        { sheet: "assets/route-b.css", files: ["assets/card.css", "assets/badge.css"] },
      ],
    },
  ];
  const code = rewriteCSSDeps(
    mapDeps(["assets/drawer.js", cssDepsMarker(0), "assets/card.css", "assets/badge.css", "assets/drawer.css"]) +
      "globalThis.out=__vite__mapDeps([0,1,2,3,4]);",
    "assets/app.js",
    plans,
    false,
  )!;
  assert.ok(code.includes('__rivet_sheets__(__vite__mapDeps([0,1,2,3]),[["route-a.css",1],["route-b.css",1,2]])'), code);
  assert.equal(code.split("const __rivet_sheets__=").length, 2);
  const run = (present: string[]) => {
    const document = {
      querySelector: (selector: string) =>
        present.some((file) => selector === `link[rel=stylesheet][href$="/${file}"],style[data-href$="/${file}"]`) ? {} : null,
    };
    const scope: { out?: string[] } = {};
    new Function("document", "globalThis", code)(document, scope);
    return scope.out;
  };
  assert.deepEqual(run([]), ["assets/drawer.js", "assets/card.css", "assets/badge.css", "assets/drawer.css"]);
  assert.deepEqual(run(["route-a.css"]), ["assets/drawer.js", "assets/badge.css", "assets/drawer.css"]);
  assert.deepEqual(run(["route-b.css"]), ["assets/drawer.js", "assets/drawer.css"]);
  assert.deepEqual(run(["route-a.css", "route-b.css"]), ["assets/drawer.js", "assets/drawer.css"]);
  // A call that also adds a route sheet: the inline filter runs on the checked list.
  const both = rewriteCSSDeps(
    mapDeps(["assets/i.js", cssDepsMarker(0), "assets/card.css"]) + "globalThis.out=__vite__mapDeps([0,1,2]);",
    "assets/app.js",
    [{ drop: new Set<string>(), add: ["assets/route-c.css"], check: [{ sheet: "assets/route-a.css", files: ["assets/card.css"] }] }],
    false,
  )!;
  assert.ok(both.includes('__rivet_inlined__(__rivet_sheets__(__vite__mapDeps([0,2,1]),[["route-a.css",2]]))'), both);
});

test("route CSS deps: a relative base (files listed relative to the chunk)", () => {
  const plans = [{ drop: new Set(["assets/card.css"]), add: ["assets/route-a.css"] }];
  const code = mapDeps(["./index.js", "../" + cssDepsMarker(0), "./card.css"]) + "e(()=>import(`./index.js`),__vite__mapDeps([0,1,2]));";
  assert.deepEqual(depsOf(rewriteCSSDeps(code, "assets/app.js", plans, true)!), [["./index.js", "./route-a.css"]]);
});

// End to end: a static build of fixture-route-css (layout + page with per-component stylesheets, a lazily imported part).
const root = new URL("./fixture-route-css/", import.meta.url).pathname;

test("route CSS deps: the client build's preload lists name route sheets and a lazy part's own stylesheets", { timeout: 120_000 }, async () => {
  await rm(root + "dist", { recursive: true, force: true });
  try {
    await withNodeEnv("production", () => build({ root, configFile: root + "vite.config.ts", logLevel: "silent" }));
    const client = root + "dist/client/";
    const routeCSS = JSON.parse(await readFile(client + ".vite/rivet-route-css.json", "utf8")) as Record<string, string[]>;
    const manifest = JSON.parse(await readFile(client + ".vite/manifest.json", "utf8")) as Record<string, { file: string; css?: string[] }>;
    const sheetOf = (id: string) => routeCSS[id]!.map((href) => href.slice(1));
    assert.equal(sheetOf("index").length, 1);
    assert.match(sheetOf("index")[0]!, /^assets\/route-/);
    // The interactive layout has a lite graph copy (`_layout.tsx?rivet-lite`, no stylesheets): its CSS stays in both
    // route sheets (the copy once took the module's place, CSS-LAZY).
    for (const id of ["index", "other"]) assert.match(await readFile(client + sheetOf(id)[0]!, "utf8"), /\.layout\{/, id);
    const fileOf = (src: string) => manifest[src]!.file;
    const css = (name: string) =>
      manifest[`src/${name}.css`]?.file ??
      Object.values(manifest)
        .flatMap((m) => m.css ?? [])
        .find((f) => f.includes(`/${name}-`))!;
    // Every dynamic import's preload list, by imported file.
    const lists = new Map<string, string[][]>();
    for (const file of await readdir(client + "assets")) {
      if (!file.endsWith(".js")) continue;
      const code = await readFile(client + "assets/" + file, "utf8");
      if (!code.includes("__vite__mapDeps")) continue;
      assert.ok(!code.includes("__rivet_css__"), `${file}: markers gone`);
      const start = code.indexOf("m.f=") + 4;
      const files = JSON.parse(code.slice(start, code.indexOf("])))=>", start) + 1)) as string[];
      for (const m of code.matchAll(/import\(`\.\/([^`]+)`\)[^]{0,40}?__vite__mapDeps\(\[([\d,]*)\]\)/g)) {
        const deps = m[2] ? m[2].split(",").map((i) => files[Number(i)]!) : [];
        lists.set("assets/" + m[1], [...(lists.get("assets/" + m[1]) ?? []), deps]);
      }
    }
    const cssOf = (target: string) => (lists.get(target) ?? []).map((deps) => deps.filter((dep) => dep.endsWith(".css")));
    // The App's page imports: the route sheet, not the component stylesheets inside it.
    assert.deepEqual(cssOf(fileOf("src/routes/index.tsx")), [sheetOf("index")]);
    assert.deepEqual(cssOf(fileOf("src/routes/other.tsx")), [sheetOf("other")]);
    // The lazily loaded part: its own stylesheet; the button's (the page has it) is not listed.
    const panel = cssOf(fileOf("src/panel.ts"));
    assert.ok(panel.length > 0, "panel import has a preload list");
    for (const deps of panel) assert.deepEqual(deps, [css("panel")]);
    // The layout's lazily loaded drawer: card (both route sheets) and button (the index's) are checked at run time.
    // (The layout chunk: the one importing drawer.ts with its stylesheets; the lite graph's copy lists none.)
    const checkedCall = /import\(`\.\/(drawer-[^`]+)`\)[^]{0,80}?__rivet_sheets__\(__vite__mapDeps\(\[([\d,]*)\]\),(\[[^)]*\])\)/;
    const codes = await Promise.all((await readdir(client + "assets")).filter((f) => f.endsWith(".js")).map((f) => readFile(client + "assets/" + f, "utf8")));
    const code = codes.find((c) => checkedCall.test(c));
    assert.ok(code, "drawer import is checked");
    const call = checkedCall.exec(code)!;
    const start = code.indexOf("m.f=") + 4;
    const files = JSON.parse(code.slice(start, code.indexOf("])))=>", start) + 1)) as string[];
    const deps = call[2]!.split(",").map((i) => files[Number(i)]!);
    const check = JSON.parse(call[3]!) as [string, ...number[]][];
    const name = (file: string) => file.split("/").pop()!;
    const checked = new Map(check.map(([sheet, ...at]) => [sheet, at.map((i) => deps[i]!).sort()]));
    assert.deepEqual(
      checked,
      new Map([
        [name(sheetOf("index")[0]!), [css("button"), css("card")].sort()],
        [name(sheetOf("other")[0]!), [css("card")]],
      ]),
    );
    assert.deepEqual(deps.filter((dep) => dep.endsWith(".css")).sort(), [css("button"), css("card")].sort(), "no other stylesheet listed");
  } finally {
    await rm(root + "dist", { recursive: true, force: true });
  }
});
