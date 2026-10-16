// trailingSlash (`rivetRouter({ trailingSlash })`): canonical paths (shared/slash.ts), 308 on page
// GET/HEAD (server/handler.ts), codegen's server entry export, static file layout, and the built app
// (Link hrefs, navigate(), plain links through the data endpoint) in Chromium.
import { afterAll, test } from "vitest";
import { steps } from "@rivetjs/testing/steps";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { chromium } from "playwright";
import { createDecoder } from "@rivetjs/runtime/resume-format";
import type { AppRoute, ServerModule } from "../server/handler.ts";
import { prerender } from "../adapters/static.ts";
import { generate } from "../build/codegen.ts";
import { routeTable } from "../build/routes.ts";
import { rivetRouter } from "../build/vite.ts";
import { slashHref, slashPath, type TrailingSlash } from "../shared/slash.ts";
import { start } from "../adapters/node.ts";

const mod = (module: ServerModule) => () => Promise.resolve(module);
const routes: AppRoute[] = [
  { id: "index", pattern: "/", page: true, layouts: [] },
  { id: "about", pattern: "/about", page: true, layouts: [], server: mod({ onPost: () => new Response("posted") }) },
  { id: "items/[id]", pattern: "/items/:id", page: true, layouts: [], server: mod({ load: (e) => e.params.id }) },
  { id: "api/ping", pattern: "/api/ping", page: false, layouts: [], server: mod({ onGet: () => new Response("pong") }) },
];
// The handler reads the policy from a build-time constant (the Vite plugin rewrites shared/slash.ts
// per app). Suites run on Node's native loader (no module mocks): a copy of server/ + shared/ per
// policy with the constant rewritten the same way, beside this file so package imports resolve.
const copies = new Map<TrailingSlash, Promise<typeof import("../server/handler.ts")>>();
const work = new URL("./.slash-copies/", import.meta.url).pathname;
afterAll(() => rm(work, { recursive: true, force: true }));
function handlerModule(policy: TrailingSlash) {
  let module = copies.get(policy);
  if (!module)
    copies.set(
      policy,
      (module = (async () => {
        const dir = join(work, policy);
        for (const sub of ["server", "shared"]) await cp(new URL("../" + sub, import.meta.url).pathname, join(dir, sub), { recursive: true });
        const file = join(dir, "shared/slash.ts");
        const source = await readFile(file, "utf8");
        assert.ok(source.includes('"ignore" as TrailingSlash'));
        await writeFile(file, source.replace('"ignore" as TrailingSlash', JSON.stringify(policy) + " as TrailingSlash"));
        return import(pathToFileURL(join(dir, "server/handler.ts")).href) as Promise<typeof import("../server/handler.ts")>;
      })()),
    );
  return module;
}
async function handler(trailingSlash: TrailingSlash = "ignore", list = routes) {
  const { createHandler } = await handlerModule(trailingSlash);
  return createHandler({
    routes: list,
    render: (input) => new Response(`<p>${input.url.pathname} ${JSON.stringify(input.data)}</p>`, { headers: { "content-type": "text/html" } }),
  });
}
const get = (h: Awaited<ReturnType<typeof handler>>, path: string, init?: RequestInit) => h(new Request("http://x.test" + path, init));

test("slashPath / slashHref: one canonical form; `/`, ignore and non-path hrefs unchanged", () => {
  assert.equal(slashPath("/a/", "never"), "/a");
  assert.equal(slashPath("/a", "never"), "/a");
  assert.equal(slashPath("/a", "always"), "/a/");
  assert.equal(slashPath("/a/", "always"), "/a/");
  assert.equal(slashPath("/", "never"), "/");
  assert.equal(slashPath("/a/", "ignore"), "/a/");
  // `always` never slashes a file path (last segment with an extension); dot-file segments are directories.
  assert.equal(slashPath("/sitemap.xml", "always"), "/sitemap.xml");
  assert.equal(slashPath("/feeds/blog.rss.xml", "always"), "/feeds/blog.rss.xml");
  assert.equal(slashPath("/v1.2/docs", "always"), "/v1.2/docs/");
  assert.equal(slashPath("/.well-known", "always"), "/.well-known/");
  assert.equal(slashHref("/robots.txt?x=1", "always"), "/robots.txt?x=1");
  assert.equal(slashPath("/sitemap.xml/", "never"), "/sitemap.xml");
  assert.equal(slashHref("/a?q=1#h", "always"), "/a/?q=1#h");
  assert.equal(slashHref("/a/#h", "never"), "/a#h");
  assert.equal(slashHref("/a/?x", "ignore"), "/a/?x");
  assert.equal(slashHref("//cdn.test/a", "always"), "//cdn.test/a");
  assert.equal(slashHref("https://x.test/a", "always"), "https://x.test/a");
  assert.equal(slashHref("a", "always"), "a");
  // The module's default (unset option): ignore.
  assert.equal(slashHref("/a/"), "/a/");
});

test("handler trailingSlash: 308 on page GET/HEAD only, query kept, data requests get { redirect }", async () => {
  // Default (ignore): both forms serve the page.
  for (const path of ["/about", "/about/"]) assert.equal((await get(await handler(), path)).status, 200, path);

  const never = await handler("never");
  const moved = await get(never, "/items/7/?q=1");
  assert.equal(moved.status, 308);
  assert.equal(moved.headers.get("location"), "/items/7?q=1");
  assert.equal((await get(never, "/items/7?q=1")).status, 200);
  assert.equal((await get(never, "/about/", { method: "HEAD" })).status, 308);
  assert.equal((await get(never, "/")).status, 200, "/ is never redirected");
  // Endpoints and unsafe methods are left alone (a 308 would repeat the POST, but forms post where they were rendered).
  assert.equal(await (await get(never, "/api/ping/")).text(), "pong");
  const post = await get(never, "/about/", { method: "POST", headers: { origin: "http://x.test", "content-type": "application/json" }, body: "{}" });
  assert.equal(await post.text(), "posted");
  // Unmatched stays 404.
  assert.equal((await get(never, "/nope/")).status, 404);
  // Data request (client navigation through a plain link): a redirect the client router follows.
  const data = await get(never, "/items/7/?q=1&_rivet=data&_rivet_keep=/", { headers: { accept: "application/json" } });
  assert.equal(data.status, 200);
  const { t, r } = (await data.json()) as { t: unknown[]; r: number };
  assert.deepEqual(createDecoder(t).get(r), { redirect: "/items/7?q=1", status: 308 });

  const always = await handler("always");
  const added = await get(always, "/about?x=1");
  assert.equal(added.status, 308);
  assert.equal(added.headers.get("location"), "/about/?x=1");
  assert.equal((await get(always, "/about/")).status, 200);
  assert.equal((await get(always, "/")).status, 200);
  assert.equal(await (await get(always, "/api/ping")).text(), "pong");

  // Base path: the root page under the base follows the policy like any other.
  const based: AppRoute[] = [{ id: "index", pattern: "/app/", page: true, layouts: [] }];
  const basedNever = await handler("never", based);
  assert.equal((await get(basedNever, "/app/")).headers.get("location"), "/app");
  assert.equal((await get(basedNever, "/app")).status, 200);
});

test("codegen: the server entry exports trailingSlash only when set", () => {
  const table = routeTable(["index.tsx"]);
  const entry = (trailingSlash?: TrailingSlash) =>
    generate(table, { routesDir: "src/routes", ...(trailingSlash ? { trailingSlash } : {}) }).files["entry.server.tsx"]!;
  assert.match(entry("always"), /export const trailingSlash = "always";/);
  assert.match(entry("never"), /export const trailingSlash = "never";/);
  assert.equal(entry("ignore"), entry());
  assert.doesNotMatch(entry(), /trailingSlash/);
  assert.throws(() => rivetRouter({ trailingSlash: "sometimes" as TrailingSlash }), /trailingSlash must be/);
});

test("static trailingSlash: `never` writes a.html, `always` / ignore a/index.html; _data.json beside the folder", async () => {
  const pages: AppRoute[] = [
    { id: "index", pattern: "/", page: true, layouts: [] },
    { id: "about", pattern: "/about", page: true, layouts: [] },
    { id: "blog/[slug]", pattern: "/blog/:slug", page: true, layouts: [], server: mod({ entries: () => [{ slug: "one" }], load: (e) => e.params.slug }) },
  ];
  for (const policy of ["never", "always", "ignore"] as const) {
    const dir = await mkdtemp(join(tmpdir(), "rivet-slash-"));
    try {
      // A resumed page (state script): client navigation may run, so every page gets its `_data.json`.
      const resumed = await handler(policy, pages);
      const state = async (request: Request) => {
        const response = await resumed(request);
        if (!response.headers.get("content-type")?.startsWith("text/html")) return response;
        return new Response((await response.text()) + '<script type="rivet/state" data-region="0">{}</script>', response);
      };
      const report = await prerender({ handler: state, routes: pages, outDir: dir, trailingSlash: policy });
      const files = (await readdir(dir, { recursive: true })).filter((f) => !f.endsWith("404.html")).sort();
      if (policy === "never") {
        assert.deepEqual(report.pages, ["/", "/about", "/blog/one"]);
        assert.deepEqual(files, [
          "_data.json",
          "about",
          "about.html",
          "about/_data.json",
          "blog",
          "blog/one",
          "blog/one.html",
          "blog/one/_data.json",
          "index.html",
        ]);
        assert.equal(await readFile(join(dir, "blog/one.html"), "utf8"), '<p>/blog/one ["one"]</p><script type="rivet/state" data-region="0">{}</script>');
      } else {
        assert.deepEqual(report.pages, policy === "always" ? ["/", "/about/", "/blog/one/"] : ["/", "/about", "/blog/one"]);
        assert.deepEqual(files, [
          "_data.json",
          "about",
          "about/_data.json",
          "about/index.html",
          "blog",
          "blog/one",
          "blog/one/_data.json",
          "blog/one/index.html",
          "index.html",
        ]);
        assert.equal(
          await readFile(join(dir, "blog/one/index.html"), "utf8"),
          `<p>/blog/one${policy === "always" ? "/" : ""} ["one"]</p><script type="rivet/state" data-region="0">{}</script>`,
        );
      }
      assert.match(await readFile(join(dir, "blog/one/_data.json"), "utf8"), /"one"/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

const root = new URL("./fixture-slash/", import.meta.url).pathname;

test(
  'built app with trailingSlash: "always" [browser]',
  steps(async (t) => {
    await rm(root + "dist", { recursive: true, force: true });
    await build({ root, configFile: root + "vite.config.ts", logLevel: "silent" });
    await build({ root, configFile: root + "vite.config.ts", logLevel: "silent", build: { ssr: true } });
    const app = await start({ dist: root + "dist", port: 0, onError: () => {} });
    const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
    try {
      await t.test("server: 308 to the slashed page; endpoint untouched", async () => {
        const moved = await fetch(app.url + "/about?x=1", { redirect: "manual" });
        assert.equal(moved.status, 308);
        assert.equal(moved.headers.get("location"), "/about/?x=1");
        assert.equal(await (await fetch(app.url + "/api/ping")).text(), "pong");
      });

      const page = await browser.newPage();
      const errors: string[] = [],
        documents: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => request.resourceType() === "document" && documents.push(new URL(request.url()).pathname));
      const heading = (value: string) => page.waitForFunction((value) => document.querySelector("h1")?.textContent === value, value);
      const click = (selector: string) => page.evaluate((s) => document.querySelector<HTMLElement>(s)!.click(), selector);
      await page.goto(app.url + "/");
      // Z1: a resumed router app boots nothing at idle; a press on a link starts the runtime + router (intent).
      await page.dispatchEvent("a[href^='/']", "pointerdown");
      await page.waitForFunction(() => (document as unknown as { $r?: { r(): unknown } }).$r?.r());

      await t.test("<Link> hrefs are canonical in the server render (query and hash kept)", async () => {
        assert.equal(await page.getAttribute("#about", "href"), "/about/");
        assert.equal(await page.getAttribute("#about-query", "href"), "/about/?tab=x#team");
      });

      await t.test("navigate() goes to the canonical URL (client navigation)", async () => {
        await click("#go");
        await heading("Item 3");
        assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, "/items/3/?q=1");
      });

      await t.test("a plain link to the other form: the data endpoint's redirect lands on the canonical URL", async () => {
        await page.goBack();
        await heading("Home");
        await click("#plain");
        await heading("Item 2");
        assert.equal(new URL(page.url()).pathname, "/items/2/");
      });

      await t.test("no document loads, no errors", async () => {
        assert.deepEqual(documents, ["/"]);
        assert.deepEqual(errors, []);
      });
    } finally {
      await browser.close();
      await app.close();
    }
  }),
);
