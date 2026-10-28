// Route sheets vs Vite's CSS preload lists (`build/route-css.ts` `cssDepsPlan` / `rewriteCSSDeps`, ROUTE-CSS): a
// dynamic import's preload list never names a stylesheet the page already has (the host's, inside the target route's
// merged sheet), so a resumed page's first interaction loads no CSS it was served; a client navigation loads the
// target's route sheet; a lazily loaded part still loads its own stylesheets before it runs.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readdir, readFile, rm } from "node:fs/promises";
import type { Rollup } from "vite";
import { build } from "vite";
import { cssDepsMarker, cssDepsPlan, pageSheets, rewriteCSSDeps } from "../build/route-css.ts";
import type { RouteTable } from "../build/routes.ts";
import { withNodeEnv } from "./vite-env.ts";

const chunk = (fileName: string, options: { modules?: string[]; imports?: string[]; css?: string[] }): Rollup.OutputChunk =>
  ({
    type: "chunk",
    fileName,
    isEntry: false,
    facadeModuleId: null,
    moduleIds: options.modules ?? [],
    imports: options.imports ?? [],
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
  } finally {
    await rm(root + "dist", { recursive: true, force: true });
  }
});
