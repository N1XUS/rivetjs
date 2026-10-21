import { test } from "vitest";
import assert from "node:assert/strict";
import { generate, routePathRegExp } from "../build/codegen.ts";
import { routeTable } from "../build/routes.ts";
import { mergeHeads } from "../server/app.ts";
import { headTags } from "../server/render.ts";
import { rivetRouter } from "../build/vite.ts";

const table = routeTable([
  "_layout.tsx",
  "_layout.server.ts",
  "_404.tsx",
  "index.tsx",
  "docs/_404.tsx",
  "docs/[[lang]]/[...path].tsx",
  "(shop)/cart.tsx",
  "(shop)/_404.tsx",
  "users/[id]/_404.tsx",
  "users/[id].tsx",
  "users/[id].server.ts",
  "api/health.server.ts",
]);

test("routes.d.ts types every route id; optional segments make params optional", () => {
  const types = generate(table, { routesDir: "src/routes" }).files["routes.d.ts"]!;
  assert.match(types, /declare module "@rivetjs\/router" \{\n {2}interface RouteParams \{/);
  assert.match(types, /"docs\/\[\[lang\]\]\/\[\.\.\.path\]": \{ lang\?: string; path: string \};/);
  assert.match(types, /"users\/\[id\]": \{ id: string \};/);
  assert.match(types, /"index": \{\};/);
  assert.match(types, /"api\/health": \{\};/);
});

test("app.tsx: lazy pages, static layouts, nearest 404 by static folder (groups add no segment)", () => {
  const { files, resumeModules } = generate(table, { routesDir: "src/routes", document: "src/document.ts" });
  const app = files["app.tsx"]!;
  // Page chunks load on intent or render, not when the page resumes. Z5: one import per page file in a
  // table; lazy components are created on first use (no per-route declarations).
  const pageFiles = [.../const PAGES = \[(.*)\];/.exec(app)![1]!.matchAll(/import\("([^"]+)"\)/g)].map((m) => m[1]!);
  const userPage = pageFiles.indexOf("../src/routes/users/[id].tsx");
  assert.ok(userPage >= 0, pageFiles.join());
  assert.match(app, /const page = \(i: number\): [^\n]* => \(views\[i\] \?\?= lazyComponent<PageProps>\(PAGES\[i\]!, undefined, \{ warm: false \}\)\);/);
  assert.doesNotMatch(app, /const (loadPage|Page)\d+ =|LOADERS/);
  // Data-driven route table (RA1/RA2): one row per route (page = PAGES index), modules derived from both.
  const paths = JSON.parse(/const PATHS: readonly string\[\] = (\[[^\n]*\]);/.exec(app)![1]!) as string[];
  const rows = /const ROUTES: readonly Row\[\] = \[(.*)\];/.exec(app)![1]!.match(/\[[^[\]]*\]/g)!;
  assert.match(rows[paths.indexOf("/users/:id")]!, new RegExp(`^\\[${paths.indexOf("/users/:id")}, 1, ${userPage}, -1, \\d+\\]$`));
  assert.match(
    app,
    /const modules: [^\n]* = PATHS\.map\(\(path, n\) => \[path, \(\) => preloadPage\(page\(ROUTES\[n\]!\[2\]\), PAGES\[ROUTES\[n\]!\[2\]\]!\)\]\);/,
  );
  assert.match(app, /const Page = page\(row\[2\]\), depth = row\[1\];/);
  assert.ok(!paths.includes("/api/health"));
  // The table has a layout loader: data requests name the layouts the client keeps.
  assert.match(app, /prefetchModule\(url, modules\);\n {4}prefetchData\(url, "server", _keepIds\(nest, NEST, url\)\);/);
  assert.match(app, /import (Layout\d+)\$ from "\.\.\/src\/routes\/_layout\.tsx";\nconst \1: \(props: LayoutProps\) => unknown = \1\$;/);
  // `docs/_404` covers /docs/…; `(shop)/_404` sits at the root URL (groups add no segment) and
  // `users/[id]/_404` under a param: neither is a prefix entry for unmatched URLs.
  assert.match(app, /url\.pathname === "\/docs" \|\| url\.pathname\.startsWith\("\/docs\/"\) \? <Special\d+ url=\{url\} \/> :/);
  assert.doesNotMatch(app, /startsWith\("\/users/);
  assert.match(app, /routeData\(work, match, router, "server", _keepIds\(nest, NEST, match\.url\)\)/);
  // The root layout has a loader: server error renders skip it unless its data came along.
  assert.match(app, /return server\?\.error && !server\.data\.length \? view : <Layout\d+ data=\{layoutData\}/);
  // Endpoint-only routes have no client route.
  assert.doesNotMatch(app, /defineRoute\("\/api\/health"/);
  assert.match(
    files["routes.ts"]!,
    /\{ id: "api\/health", pattern: "\/api\/health", page: false, layouts: \[once\(async \(\) => serverExports\(await import\("\.\.\/src\/routes\/_layout\.server\.ts"\), "src\/routes\/_layout\.server\.ts", true\)\)\], server: /,
  );
  // Server modules and universal head modules load once per process in builds; dev re-imports each request.
  assert.match(files["routes.ts"]!, /const once = <T>\(load: \(\) => Promise<T>\): \(\(\) => Promise<T>\) => \{\n  if \(import\.meta\.env\.DEV\) return load;/);
  assert.match(files["routes.ts"]!, /: once\(\(\) => Promise\.all\(\[/);
  assert.doesNotMatch(files["routes.ts"]!, /[^(]\(\) => import\(/);
  assert.match(files["entry.server.tsx"]!, /export \{ default as document \} from "\.\.\/src\/document\.ts";/);
  assert.match(files["entry.server.tsx"]!, /export \{ createApp \} from "@rivetjs\/router\/server";/);
  // Dev: client mount over the server HTML with hot re-mounts.
  assert.match(files["dev-mount.tsx"]!, /await module\.loadPage\(url\);/);
  assert.match(files["dev-mount.tsx"]!, /import\.meta\.hot\.accept\("\.\/app\.tsx"/);
  // Client-rendered dev pages load dev-mount.tsx (it mounts itself); resumed ones load the dev entry,
  // which switches to client rendering on their first JS hot update.
  assert.match(files["dev-mount.tsx"]!, /querySelector\('\[data-rivet-dev=""\]'\)/);
  assert.match(files["entry.dev.tsx"]!, /querySelector\('\[data-rivet-dev="resume"\]'\)/);
  assert.match(files["entry.dev.tsx"]!, /hot\.on\("vite:beforeUpdate"/);
  // DevTools inspection asks for the same client-render fallback, and the switch is announced.
  assert.match(files["entry.dev.tsx"]!, /addEventListener\("rivet:devtools-inspect"/);
  assert.match(files["entry.dev.tsx"]!, /"rivet:dev-client-render", \{ detail: \{ phase: "done" \} \}/);
  assert.doesNotMatch(files["entry.dev.tsx"]!, /^import /m);
  assert.match(app, /export const loadPage = \(url: URL\)/);
  assert.ok(resumeModules.includes(".rivet/app.tsx"));
  assert.ok(resumeModules.includes("src/routes/users/[id].tsx"));
  assert.ok(!resumeModules.some((file) => file.includes(".server.")));
});

test("static mode reads _data.json; CSR mode emits a client entry and resumes nothing", () => {
  assert.match(generate(table, { routesDir: "src/routes", mode: "static" }).files["app.tsx"]!, /routeData\(work, match, router, "static"\)/);
  const csr = generate(routeTable(["index.tsx", "about.tsx"]), { routesDir: "src/routes", mode: "csr" });
  assert.deepEqual(Object.keys(csr.files).sort(), ["app.tsx", "entry.client.tsx", "routes.d.ts"]);
  assert.match(csr.files["entry.client.tsx"]!, /import.meta.hot.accept\("\.\/app\.tsx"/);
  assert.match(csr.files["entry.client.tsx"]!, /mount\(guarded\(\(\) => <App router=\{createRouter\(\)\} \/>\), container\);/);
  // Dev only: unhandled render errors reach Vite's overlay (`import.meta.hot` branch, dropped by builds).
  assert.match(
    csr.files["entry.client.tsx"]!,
    /import\.meta\.hot\n\s+\? \(\) =>\n\s+catchError\(view, \(error\) => \{\n\s+_devError\(error\);\n\s+throw error;/,
  );
  assert.match(csr.files["app.tsx"]!, /routeData\(work, match, router, "none"\)/);
  assert.doesNotMatch(csr.files["app.tsx"]!, /prefetchData\(/);
  assert.match(csr.files["app.tsx"]!, /prefetchModule\(url, modules\);/);
  assert.deepEqual(csr.resumeModules, []);
  // A root layout without a loader always renders, error views included.
  const plain = generate(routeTable(["_layout.tsx", "index.tsx"]), { routesDir: "src/routes" }).files["app.tsx"]!;
  assert.match(plain, /\n  return <Layout\d+ data=\{layoutData\} params=\{noParams\} url=\{layoutURL\}>\{view\}<\/Layout\d+>;/);
});

test("mergeHeads: inner title wins; meta by name/property and links by rel+href, canonical once", () => {
  const head = mergeHeads([
    {
      title: "Site",
      meta: [{ name: "description", content: "outer" }],
      links: [
        { rel: "canonical", href: "/a" },
        { rel: "icon", href: "/i.svg" },
      ],
    },
    undefined,
    {
      title: "Page",
      meta: [
        { name: "description", content: "inner" },
        { property: "og:title", content: "P" },
      ],
      links: [{ rel: "canonical", href: "/b" }],
    },
  ]);
  assert.deepEqual(head, {
    title: "Page",
    meta: [
      { name: "description", content: "inner" },
      { property: "og:title", content: "P" },
    ],
    links: [
      { rel: "canonical", href: "/b" },
      { rel: "icon", href: "/i.svg" },
    ],
  });
  assert.equal(mergeHeads([undefined]), undefined);
});

test("headTags escapes text and attributes", () => {
  assert.equal(
    headTags({ title: "<b>&", meta: [{ name: 'x"y', content: "<>" }], links: [{ rel: "alternate", href: '/a?b="c"', hreflang: "de" }] }),
    '<title>&lt;b&gt;&amp;</title><meta name="x&quot;y" content="&lt;&gt;"><link rel="alternate" href="/a?b=&quot;c&quot;" hreflang="de">',
  );
});

test("browser graphs cannot import x.server.ts", () => {
  const [plugin] = rivetRouter();
  const resolveId = plugin!.resolveId as (this: unknown, id: string, importer: string | undefined, options: { ssr?: boolean }) => unknown;
  const context = (consumer: string) => ({
    environment: { config: { consumer } },
    error(error: string | { message: string }): never {
      throw new Error(typeof error === "string" ? error : error.message);
    },
  });
  assert.throws(() => resolveId.call(context("client"), "./users/[id].server.ts", "/app/src/routes/users/[id].tsx", {}), /server-only.*users\/\[id\]\.tsx/);
  assert.throws(() => resolveId.call(context("client"), "./secrets.server", "/app/src/a.ts", {}), /server-only/);
  // The error names the remedy and the docs page.
  assert.throws(
    () => resolveId.call(context("client"), "./secrets.server", "/app/src/a.ts", {}),
    /\n  fix: read it in a server export.*\n  docs: https:\/\/\S+server-only-code/s,
  );
  assert.equal(resolveId.call(context("server"), "./users/[id].server.ts", "/app/src/routes/users/[id].tsx", {}), null);
  assert.equal(resolveId.call(context("client"), "@rivetjs/router/server", "/app/src/document.ts", {}), null);
});

test("client/ and shared/ import only each other and the runtime (no Node or server code)", async () => {
  const { readFile } = await import("node:fs/promises");
  const { stripTypeScriptTypes } = await import("node:module");
  for (const file of [
    "../client/index.ts",
    "../client/navigation.ts",
    "../client/transitions.ts",
    "../client/transition-helpers.ts",
    "../client/route-context.ts",
    "../client/layouts.ts",
    "../shared/data.ts",
    "../shared/errors.ts",
  ]) {
    const source = stripTypeScriptTypes(await readFile(new URL(file, import.meta.url), "utf8"));
    for (const [, spec] of source.matchAll(/(?:import|export)[^"']*?from\s*["']([^"']+)["']/g))
      assert.ok(
        /^@rivetjs\/(runtime|reactivity)\//.test(spec!) ||
          spec === "@rivetjs/reactivity" ||
          (/^\.\.?\/(?:\.\.\/shared\/|shared\/)?[\w-]+\.tsx?$/.test(spec!) && !/server|adapters|build/.test(spec!)),
        `${file} imports ${spec}`,
      );
  }
});

test("head: components wraps levels and hands the sink over; off leaves the output without kit", () => {
  const off = generate(table, { routesDir: "src/routes" }).files;
  const on = generate(table, { routesDir: "src/routes", head: "components" }).files;
  for (const file of Object.values(off)) assert.doesNotMatch(file, /HeadLevel|@rivetjs\/kit|headSink|headComponents/);
  assert.match(on["app.tsx"]!, /import \{ HeadLevel, applyRouteHead \} from "@rivetjs\/kit";/);
  assert.match(on["app.tsx"]!, /<Provider token=\{HeadLevel\} value=\{0\}>/);
  assert.match(on["app.tsx"]!, /\.then\(\(result\) => applyRouteHead\(result, ROUTES\[n\]!\[1\]\)\)/);
  assert.match(on["app.tsx"]!, /<Provider token=\{HeadLevel\} value=\{depth\}><Page data=\{result\.data\[depth\]\}/);
  assert.match(on["entry.server.tsx"]!, /export const headComponents = true;/);
  assert.match(on["entry.server.tsx"]!, /headSink: input\.headSink/);
});

test("routes.d.ts: RouteRegistry path union of page URL shapes (RoutePath / <Link to>)", () => {
  const types = generate(table, { routesDir: "src/routes" }).files["routes.d.ts"]!;
  const path = /interface RouteRegistry \{\n {4}path: ([^;]+);/.exec(types)![1]!;
  assert.deepEqual(path.split(" | ").sort(), ["`/`", "`/cart`", "`/docs/${string}/${string}`", "`/docs/${string}`", "`/users/${string}`"].sort());
  // Literal segments escape template syntax.
  const odd = generate(routeTable(["a`b.tsx", "$x.tsx"]), { routesDir: "src/routes" }).files["routes.d.ts"]!;
  assert.match(odd, /path: (`\/a\\`b` \| `\/\$x`|`\/\$x` \| `\/a\\`b`);/);
});

test("app.tsx: one commit per navigation (data + page chunk), swap/hold, prefetch opt-out", () => {
  const app = generate(table, { routesDir: "src/routes" }).files["app.tsx"]!;
  assert.match(
    app,
    /load: \(work, match\) => _ssrLevel\(work, \(data\) => loaded\(data\), failed, \(result\) => _landed\(nest, NEST, 0, ROUTES\[n\]!\[0\], result, match\)\) \?\? Promise\.all\(\[routeData\(work, match, router, "server", _keepIds\(nest, NEST, match\.url\)\), loadPage\(match\.url\)\]\)\.then\(\(\[data\]\) => data\)\.then\(loaded, failed\)\.then\(\(result\) => _landed\(nest, NEST, 0, ROUTES\[n\]!\[0\], result, match\)\)/,
  );
  // Without layouts: the load chain as before (no layout state).
  const bare = generate(routeTable(["index.tsx", "about.tsx"]), { routesDir: "src/routes" }).files["app.tsx"]!;
  assert.match(
    bare,
    /load: \(work, match\) => _ssrLevel\(work, \(data\) => loaded\(data\), failed, \(result\) => result\) \?\? Promise\.all\(\[routeData\(work, match, router, "server"\), loadPage\(match\.url\)\]\)\.then\(\(\[data\]\) => data\)\.then\(loaded, failed\),\n/,
  );
  assert.doesNotMatch(bare, /_layouts|_landed|_keepIds|NEST/);
  assert.doesNotMatch(app, /settle\(/);
  assert.match(app, /<Router router=\{router\} routes=\{routes\} swap=\{swapRoute\} hold=\{heldRoutes\} notFound=/);
  assert.match(app, /if \(!anchor \|\| anchor\.getAttribute\("data-rivet-prefetch"\) === "none"\) return;/);
  // Z1: router listeners load on interaction (no eager chunk, no boot at idle); the nested App arms its
  // level sync from the first navigation entry point instead of a load effect.
  assert.match(app, /clientEvent\(window, "popstate", \(event: PopStateEvent\) => notePopstate\(event\), \{ preload: "intent" \}\);/);
  assert.match(
    app,
    /clientEvent\(document, "click", \(event: MouseEvent\) => interceptClick\(event, router, modules\), \{ preload: "intent", match: "a" \}\);/,
  );
  assert.doesNotMatch(app, /clientEffect|preload: "eager"|\barm\b/);
  const deep = generate(routeTable(["_layout.tsx", "index.tsx", "shop/_layout.tsx", "shop/a.tsx", "shop/b.tsx"]), { routesDir: "src/routes" }).files[
    "app.tsx"
  ]!;
  assert.match(deep, /const arm = \(\) => _arm\(router, \(\) => _sync\(router, nest, NEST\)\);/);
  assert.match(
    deep,
    /clientEvent\(document, "click", \(event: MouseEvent\) => \(arm\(\), interceptClick\(event, router, modules\)\), \{ preload: "intent", match: "a" \}\);/,
  );
  assert.match(deep, /clientEvent\(window, "popstate", \(event: PopStateEvent\) => \(arm\(\), notePopstate\(event\)\), \{ preload: "intent" \}\);/);
  assert.doesNotMatch(deep, /clientEffect|preload: "eager"/);
  assert.match(bare, /clientEvent\(window, "popstate", \(event: PopStateEvent\) => notePopstate\(event\), \{ preload: "intent" \}\);/);
  assert.match(bare, /clientEvent\(document, "pointerover", intent, \{ passive: true, preload: "intent", match: "a" \}\);/);
  // ROUTER-LAZY: only link targets reach the router's listeners (a click / hover elsewhere loads no router chunk).
  assert.match(bare, /clientEvent\(document, "focusin", intent, \{ preload: "intent", match: "a" \}\);/);
  assert.doesNotMatch(bare, /\barm\b|_arm/);
});

test("transitions off: no transitions module or navigation context; on: lazy module, context, resume entry", () => {
  const off = generate(table, { routesDir: "src/routes" });
  assert.doesNotMatch(Object.values(off.files).join("\n"), /transitions|Navigation\b/);
  // No transitions, no search params: no router contexts, so no generated resume entry.
  assert.equal(off.files["entry.resume.ts"], undefined);
  const on = generate(table, { routesDir: "src/routes", transitions: { pending: { delay: 100 } } });
  const app = on.files["app.tsx"]!;
  assert.match(
    app,
    /const transitions = \(\) => \(typeof document === "undefined" \? undefined : import\("@rivetjs\/router\/transitions"\)\.then\(\(m\) => m\.install\(\{"pending":\{"delay":100\}\}\)\)\);/,
  );
  assert.match(app, /const anchor = routableAnchor\(event, modules\);\n {4}if \(anchor\) transitions\(\);/);
  assert.match(app, /loadPage\(match\.url\), transitions\(\)\]\)\.then\(\(\[data, page\]\) => \(_routeModule\(page\), data\)\)/);
  assert.match(on.files["entry.server.tsx"]!, /<Provider token=\{Navigation\} value=\{navigation\}>\n {8}<App router=\{createRouter\(input\.url\)\} \/>/);
  assert.match(on.files["entry.resume.ts"]!, /export default createResume\(\{ contexts: \[\[Navigation, navigation\]\] \}\);/);
  const both = generate(table, { routesDir: "src/routes", transitions: true, searchParams: true });
  assert.match(
    both.files["entry.resume.ts"]!,
    /export default createResume\(\{ contexts: \[\[Navigation, navigation\], \[SearchParams, searchParams\]\] \}\);/,
  );
  // CSR: nothing resumes, no resume entry.
  const csr = generate(routeTable(["index.tsx"]), { routesDir: "src/routes", mode: "csr", transitions: true, searchParams: true });
  assert.equal(csr.files["entry.resume.ts"], undefined);
  assert.match(csr.files["app.tsx"]!, /m\.install\(\{\}\)/);
});

test("app.tsx: route tables — paths compiled once, one definition per match, shared failure / level views (RA1, Z4)", () => {
  const app = generate(table, { routesDir: "src/routes" }).files["app.tsx"]!;
  // One lazy table per Router level, no per-route defineRoute call.
  assert.equal(app.match(/defineRoute\(/g)!.length, 1);
  assert.match(app, /const routes = \{\n {4}paths: PATHS,\n {4}route: \(n: number\) =>\n {6}defineRoute\(PATHS\[n\]!, \{/);
  // Failure UI once per distinct (_404, _error) pair, not per route.
  const pairs = new Set(table.routes.filter((route) => route.page).map((route) => `${route.notFound}|${route.error}`));
  assert.equal(app.match(/const fail\d+ = /g)!.length, pairs.size);
  assert.ok(app.match(/Something went wrong/g)!.length <= pairs.size);
  // A table with 200 routes grows by a row (and a lazy page import) per route, not by route code.
  const many = routeTable(Array.from({ length: 200 }, (_, i) => `p${i}.tsx`));
  const big = generate(many, { routesDir: "src/routes" }).files["app.tsx"]!;
  assert.equal(big.match(/defineRoute\(/g)!.length, 1);
  assert.equal(big.match(/const fail\d+ = /g)!.length, 1);
});

test("app.tsx: a single static page route registers no client router events (Z1: the page boots no runtime)", () => {
  const one = generate(routeTable(["index.tsx"]), { routesDir: "src/routes" }).files["app.tsx"]!;
  assert.doesNotMatch(one, /clientEvent|interceptClick|notePopstate|prefetchData|routableAnchor/);
  assert.match(one, /<Router router=\{router\} routes=\{routes\}/);
  // A param route, a second route, navigate() or search params keep the client router.
  for (const [files, options] of [
    [["[id].tsx"], {}],
    [["index.tsx", "about.tsx"], {}],
    [["index.tsx"], { navigate: true }],
    [["index.tsx"], { searchParams: true }],
  ] as const)
    assert.match(generate(routeTable([...files]), { routesDir: "src/routes", ...options }).files["app.tsx"]!, /clientEvent\(document, "click"/);
});

test("routePathRegExp: one factored RegExp over every route path (optional slash, params, splats, base, encoding)", () => {
  const check = (patterns: string[], yes: string[], no: string[]) => {
    const source = routePathRegExp(patterns);
    // Same source as a `v`-mode RegExp (the fallback) and a URLPattern regexp group (the rules).
    const re = new RegExp("^/(?:" + source + ")$", "v");
    const pattern = new URLPattern(source ? "/(" + source + ")" : "/", "http://x/");
    for (const path of yes) assert.ok(re.test(path) && pattern.test("http://x" + path + "?q#h"), `${source} should match ${path}`);
    for (const path of no) assert.ok(!re.test(path) && !pattern.test("http://x" + path), `${source} should not match ${path}`);
    return source;
  };
  assert.equal(
    check(
      ["/", "/about", "/blog", "/blog/:slug"],
      ["/", "/about", "/about/", "/blog", "/blog/", "/blog/a", "/blog/a/"],
      ["/abou", "/about/x", "/blog/a/b", "/x"],
    ),
    "about\\/?|blog(?:\\/[^\\/]+\\/?|\\/?)|",
  );
  // Base path, dots, non-ASCII (as `URL.pathname` serializes it), decoded or encoded in the pattern.
  check(
    ["/app", "/app/items/:id", "/app/café", "/app/sitemap.xml", "/app/100%25"],
    ["/app", "/app/", "/app/items/1", "/app/caf%C3%A9", "/app/sitemap.xml", "/app/100%25"],
    ["/", "/apps", "/app/items", "/app/sitemapXxml"],
  );
  check(["/", "/docs/*rest"], ["/", "/docs", "/docs/", "/docs/a/b"], ["/doc", "/x"]);
  // A root catch-all: every path is a route (no document links by path).
  assert.equal(check(["/*all", "/about"], ["/", "/anything/at/all"], []), ".*");
  assert.equal(check(["/"], ["/"], ["/a"]), "");
});

test("document links: endpoints a later dynamic page pattern fits are rows of the client's match table", () => {
  const app = (files: string[]) => generate(routeTable(files), { routesDir: "src/routes" }).files["app.tsx"]!;
  // `items/export` (static) is matched by the server before `items/[id]`: the client must not route it.
  const shadowed = app(["index.tsx", "items/[id].tsx", "items/export.server.ts", "api/ping.server.ts"]);
  const paths = JSON.parse(/const PATHS: readonly string\[\] = (\[[^\n]*\]);/.exec(shadowed)![1]!) as string[];
  const [, rows] = /for \(const \[at, path\] of (\[.*\]) as const\) modules\.splice\(at, 0, \[path, _endpoint\]\);/.exec(shadowed)!;
  const order = [...paths];
  for (const [at, path] of JSON.parse(rows!) as [number, string][]) order.splice(at, 0, path);
  assert.ok(order.indexOf("/items/export") < order.indexOf("/items/:id"), order.join());
  // `/api/ping` overlaps no page pattern: the page table already leaves it to the browser.
  assert.ok(!order.includes("/api/ping"));
  // No endpoint a page pattern fits: the modules table is unchanged (byte-identical app.tsx).
  assert.match(app(["index.tsx", "items/[id].tsx", "api/ping.server.ts"]), /const modules: readonly \(readonly \[string, \(\) => unknown\]\)\[\] = PATHS\.map/);
  assert.equal(
    app(["index.tsx", "items/[id].tsx", "api/ping.server.ts"]),
    app(["index.tsx", "items/[id].tsx", "api/x.server.ts"]).replace('"/api/x"', '"/api/ping"'),
  );
  // A root catch-all page fits every endpoint after it.
  assert.match(app(["index.tsx", "[...rest].tsx", "api/ping.server.ts"]), /\[\[\d+,"\/api\/ping"\]\]/);
});

test("dev error forwarder: overlay text for an ErrorEvent without error and for non-Error values", async () => {
  const { stripTypeScriptTypes } = await import("node:module");
  const files = generate(table, { routesDir: "src/routes" }).files;
  assert.match(files["entry.dev.tsx"]!, /send\("error" in event \? \(event\.error \?\? event\) : event\.reason\)/);
  // The helper `app.tsx` exports (the dev entry inlines the same lines as `describe`).
  const app = files["app.tsx"]!;
  const start = app.indexOf("export const _devDescribe = ");
  const expression = app.slice(start + "export const _devDescribe = ".length, app.indexOf("\n};\n", start) + 2);
  const describe = new Function("return " + stripTypeScriptTypes(`(${expression})`))() as (error: unknown) => { message: string; stack?: string };
  const error = new Error("boom");
  assert.deepEqual(describe(error), { message: "boom", stack: error.stack });
  const nil = describe(null);
  assert.equal(nil.message, "Non-Error value thrown (null): null");
  assert.match(nil.stack!, /reported here/);
  assert.equal(describe({ code: 7 }).message, 'Non-Error value thrown (object): {"code":7}');
  // A ResizeObserver loop: the window error event carries no Error (`error` null). Node 24 (CI, `engines` minimum) has
  // no global `ErrorEvent` (Node 25+ does): a stand-in with the browser's fields for the rest of this test.
  const globals = globalThis as { ErrorEvent?: unknown };
  globals.ErrorEvent ??= class ErrorEvent extends Event {
    readonly message: string;
    readonly filename: string;
    readonly lineno: number;
    readonly colno: number;
    readonly error: unknown;
    constructor(type: string, init: { message?: string; filename?: string; lineno?: number; colno?: number; error?: unknown } = {}) {
      super(type);
      this.message = init.message ?? "";
      this.filename = init.filename ?? "";
      this.lineno = init.lineno ?? 0;
      this.colno = init.colno ?? 0;
      this.error = init.error ?? null;
    }
  };
  const event = new ErrorEvent("error", { message: "ResizeObserver loop completed with undelivered notifications.", filename: "http://x/a.js", error: null });
  assert.equal(event.error, null);
  assert.match(describe(event).message, /^ResizeObserver loop completed .* \(http:\/\/x\/a\.js:0:0; the error event carries no Error\)$/);
  // ...which is a benign notice: the dev entry and `_devError` drop it (Chrome + Firefox/Safari texts), anything else is forwarded.
  const benignStart = app.indexOf("export const _devBenign = ");
  const benignSource = app.slice(benignStart + "export const _devBenign = ".length, app.indexOf("\n};\n", benignStart) + 2);
  const benign = new Function("const console = { debug() {} };let benignLogged = false;return " + stripTypeScriptTypes(`(${benignSource})`))() as (
    message: string,
  ) => boolean;
  assert.equal(benign(describe(event).message), true);
  assert.equal(benign("ResizeObserver loop limit exceeded"), true);
  assert.equal(benign("ResizeObserver is not defined"), false);
  assert.equal(benign(describe(new Error("boom")).message), false);
  assert.match(files["entry.dev.tsx"]!, /if \(benign\(report\.message\)\) return;/);
  assert.match(app, /if \(!_devBenign\(report\.message\)\) import\.meta\.hot\.send/);
});

test("codegen forms: router handlers install the router brand first; apps without forms carry no brand", () => {
  const table = routeTable(["index.tsx", "items/[id].tsx"]);
  const forms = generate(table, { routesDir: "src/routes", forms: true }).files["app.tsx"]!;
  assert.match(forms, /, _brand, _go \} from "@rivetjs\/router\/client";/);
  assert.match(forms, /clientEvent\(document, "click", \(event: MouseEvent\) => \(_brand\(_go\), interceptClick\(event, router, modules\)\)/);
  assert.match(forms, /const intent = \(event: Event\) => \{\n    _brand\(_go\);/);
  assert.match(forms, /clientEvent\(window, "popstate", \(event: PopStateEvent\) => \(_brand\(_go\), notePopstate\(event\)\)/);
  assert.match(forms, /clientEvent\(document, "rivet:go", \(\) => \(_brand\(_go\), _serve\(router\)\)/, "forms imply navigate");
  assert.match(forms, /data-rivet-go/);
  for (const options of [{}, { navigate: true }, { navigate: true, activeLinks: true }]) {
    const app = generate(table, { routesDir: "src/routes", ...options }).files["app.tsx"]!;
    assert.doesNotMatch(app, /_brand|_go\b/);
  }
});

test("derived resume model: app.tsx default-exports Root (payload as data), levels answer their first load from it", () => {
  const plain = generate(table, { routesDir: "src/routes" });
  const { files } = generate(table, { routesDir: "src/routes", derived: true });
  const app = files["app.tsx"]!,
    entry = files["entry.server.tsx"]!;
  assert.doesNotMatch(plain.files["app.tsx"]!, /export default function Root|revived\(/);
  assert.match(plain.files["entry.server.tsx"]!, /<App router=\{createRouter\(input\.url\)\} \/>/);
  // Root: the server renders the request's router; the browser rebuilds the router and provides the payload as `Revived`.
  assert.match(
    app,
    /export default function Root\(props: \{ s: RootData \| EncodedRoot \}\) \{\n {2}if \(import\.meta\.env\.SSR\) return <App router=\{serverRouter\(useContext\(ServerData\)!\.url\)\} \/>;/,
  );
  assert.match(app, /<Provider token=\{Revived\} value=\{server\}>/);
  // A payload that is not JSON data arrives as its resume table (server `_rData`): decoded here, its built-in decoders first.
  assert.match(app, /const s = rootPayload\(props\.s\),/);
  assert.match(app, /import \{ createDecoder \} from "@rivetjs\/runtime\/resume-format";/);
  assert.match(
    app,
    /Root\.ready = \(props: \{ s\?: RootData \| EncodedRoot \}\): Promise<unknown> \| undefined => \{\n {2}const page = loadPage\(new URL\(globalThis\.location\.href\)\);/,
  );
  assert.match(app, /const src = props\.s && "t" in props\.s \? props\.s\.x : undefined;/);
  assert.match(
    app,
    /return src \? Promise\.all\(\[page, new Promise\(\(onload\) => globalThis\.document\.head\.append\(Object\.assign\(globalThis\.document\.createElement\("script"\), \{ type: "module", src, onload, onerror: onload \}\)\)\)\]\) : page;/,
  );
  assert.match(app, /_ssrLevel\(work, [^\n]*\) \?\? revived\(work, [^\n]*\) \?\? /);
  assert.match(app, /const server = useContext\(ServerData\) \?\? useContext\(Revived\);/);
  // The routes view is built where it renders (inside the root layout's adopt run).
  assert.match(app, /const view = \(\) => <div data-rivet-routes=""/);
  // The adopt task's route renders swap without scroll / focus / announce (the page load, not a navigation).
  assert.match(app, /const adoptSwap = \(apply: \(\) => void, next: ParentNode\): void => \(adopting \? apply\(\) : swapRoute\(apply, next\)\);/);
  assert.match(app, /swap=\{adoptSwap\}/);
  assert.doesNotMatch(app, /swap=\{swapRoute\}/);
  assert.match(app, /\{view\(\)\}/);
  assert.match(entry, /import Root from "\.\/app\.tsx";/);
  assert.match(entry, /<Root s=\{rootData\(input\)\} \/>/);
  // The payload's `byURL` is a copy: the handler's shared empty one is frozen, which sends the tail's JSON.stringify off V8's
  // fast path (DERIVED-S).
  assert.match(entry, /x: \[\.\.\.input\.byURL\]/);
  // Link clicks outside every boundary (document shell, content outside the app's markup) are Root's: tail `g`.
  assert.match(entry, /import \{ _rData, _rListen \} from "@rivetjs\/runtime\/server-derived";/);
  assert.match(entry, /return _rData\(\{ d, /);
  assert.match(entry, /<Links \/>\n\s*<Root s=/);
  assert.doesNotMatch(entry, /createRouter/);
  // CSR mode has no server payload: the option is ignored.
  const csr = generate(routeTable(["_layout.tsx", "index.tsx", "about.tsx"]), { routesDir: "src/routes", mode: "csr", derived: true }).files["app.tsx"]!;
  assert.doesNotMatch(csr, /export default function Root|revived\(/);
});
