// File-routed fixture app end to end: Vite dev middleware, then a production build served by the
// node adapter and driven in Chromium (client navigation over the data endpoint).
import { test } from "vitest";
import { steps } from "@rivetjs/testing/steps";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build, createServer } from "vite";
import { chromium } from "playwright";
import { start } from "../adapters/node.ts";
import { nodeEnv, withNodeEnv } from "./vite-env.ts";
import { strictCSP } from "../server/strict-csp.ts";

const root = new URL("./fixture/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";

/** A private copy of the fixture for tests that edit its files (`root` + "/"). */
async function copyFixture(): Promise<string> {
  await mkdir(".artifacts", { recursive: true });
  const copy = (await mkdtemp(resolve(".artifacts/router-hmr-"))) + "/";
  await cp(root, copy, { recursive: true, filter: (path) => !/[/\\](\.rivet|dist)$/.test(path) });
  return copy;
}

test("dev middleware renders pages, data, guards, nearest 404 and errors", async () => {
  const restoreEnv = nodeEnv("development");
  const server = await createServer({ root, configFile, logLevel: "silent", server: { port: 0 } });
  await server.listen();
  const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  try {
    const get = (path: string) => fetch(origin + path, { redirect: "manual" });
    const home = await get("/");
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /<title>Home<\/title>/);
    assert.match(html, /<link rel="stylesheet" href="\/src\/styles.css">/);
    // Rendered through the resume recorder, like production: text and region markers.
    assert.match(html, /<p id="site"><!--r1-->Fixture<!--\/--><\/p>/);
    assert.match(html, /<main><div data-rivet-routes=""><!--r0\[--><section><h1>Home<\/h1>/);

    const item = await (await get("/items/2")).text();
    assert.match(item, /<title>Second item<\/title><meta name="description" content="Item 2">/);
    assert.match(item, /<p id="item-id">2<\/p>/);

    const data = await get("/items/2?_rivet=data");
    assert.equal(data.headers.get("cache-control"), "private, no-store");
    assert.match(await data.text(), /"Second item"/);

    const guarded = await get("/private");
    assert.equal(guarded.status, 302);
    assert.equal(guarded.headers.get("location"), "/login?next=/private");

    const missing = await get("/missing");
    assert.equal(missing.status, 404);
    assert.match(await missing.text(), /<h1 id="not-found">Nothing at \/missing<\/h1>/);
    // Nearest `_404`: the items folder has its own, for unknown ids and unmatched URLs below it.
    assert.match(await (await get("/items/9")).text(), /<h1 id="no-item">No item at \/items\/9<\/h1>/);
    assert.match(await (await get("/items/1/extra")).text(), /<h1 id="no-item">No item at \/items\/1\/extra<\/h1>/);

    const broken = await get("/broken");
    assert.equal(broken.status, 500);
    assert.match(await broken.text(), /<h1 id="failure">Something failed<\/h1>/);
  } finally {
    await server.close();
    restoreEnv();
  }
});

test("dev: a source that starts using navigate() / useParams() regenerates the App with them", async () => {
  const restoreEnv = nodeEnv("development");
  const root = await copyFixture();
  const server = await createServer({ root, configFile: root + "vite.config.ts", logLevel: "silent", server: { port: 0 } });
  await server.listen();
  const app = () => readFile(root + ".rivet/app.tsx", "utf8");
  const until = async (check: (source: string) => boolean) => {
    for (const started = Date.now(); Date.now() - started < 10_000; await new Promise((done) => setTimeout(done, 50))) if (check(await app())) return;
    assert.fail("app.tsx not regenerated:\n" + (await app()));
  };
  try {
    assert.doesNotMatch(await app(), /rivet:go|RouteParamsContext/);
    await writeFile(
      root + "src/go.ts",
      'import { navigate, useParams } from "@rivetjs/router/client";\nexport const go = () => navigate("/");\nexport const p = useParams;\n',
    );
    await until((source) => source.includes('"rivet:go"') && source.includes("RouteParamsContext"));
    // Resumed dev pages (the default) boot the resume entry the dev manifest names: the compiler's
    // default one until a source reads search params, then the generated one with their context.
    const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
    const runtime = async () =>
      (JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/.exec(await (await fetch(origin + "/items/1")).text())![1]!) as { rt: string }).rt;
    assert.equal(await runtime(), "/@id/__x00__rivet-resume-entry");
    await writeFile(root + "src/q.ts", 'import { useSearchParams } from "@rivetjs/router/client";\nexport const q = useSearchParams;\n');
    for (const started = Date.now(); (await runtime()) !== "/.rivet/entry.resume.ts" && Date.now() - started < 10_000;)
      await new Promise((done) => setTimeout(done, 50));
    assert.equal(await runtime(), "/.rivet/entry.resume.ts");
    assert.match(await readFile(root + ".rivet/entry.resume.ts", "utf8"), /\[SearchParams, searchParams\]/);
  } finally {
    // Closing waits for a running regeneration (nothing writes `.rivet/` afterwards).
    await server.close();
    await rm(root, { recursive: true, force: true });
    restoreEnv();
  }
});

test("dev, `dev: { resume: false }`: the browser client-renders pages, navigates, and hot-updates in place keeping component state", async () => {
  const restoreEnv = nodeEnv("development");
  // Edited below: a copy, so suites reading the fixture concurrently (other processes) keep theirs.
  const root = await copyFixture();
  // Opted out of dev resume (resumed dev pages: dev-resume.test.ts).
  const config = await readFile(root + "vite.config.ts", "utf8");
  await writeFile(
    root + "vite.config.ts",
    config.replace('rivetRouter({ styles: ["src/styles.css"] })', 'rivetRouter({ styles: ["src/styles.css"], dev: { resume: false } })'),
  );
  const server = await createServer({ root, configFile: root + "vite.config.ts", logLevel: "silent", server: { port: 0 } });
  await server.listen();
  const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  const pageFile = root + "src/routes/items/[id].tsx",
    loaderFile = root + "src/routes/items/[id].server.ts";
  const layoutFile = root + "src/routes/_layout.tsx";
  const [pageSource, loaderSource, layoutSource] = await Promise.all([readFile(pageFile, "utf8"), readFile(loaderFile, "utf8"), readFile(layoutFile, "utf8")]);
  try {
    const html = await (await fetch(origin + "/items/1")).text();
    assert.match(html, /<div data-rivet-dev="" style="display:contents"><div id="shell">/);
    assert.match(html, /<script type="application\/json" id="rivet-dev-data">/);
    // The recorder ran (markers), its state and loader stay out.
    assert.match(html, /<button type="button" id="likes" data-r="\d+">Likes <!--r\d*-->0<!--\/--><\/button>/);
    assert.ok(!html.includes('type="rivet/state"'), "no resume state");
    assert.match(
      html,
      /<script type="module" src="\/@vite\/client" nonce="[^"]+"><\/script><script type="module" src="\/\.rivet\/dev-mount\.tsx" nonce="[^"]+"><\/script>/,
    );

    const page = await browser.newPage();
    const errors: string[] = [],
      documents: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.text().startsWith("CSP ") && errors.push(message.text()));
    await page.addInitScript(() =>
      document.addEventListener("securitypolicyviolation", (event) => console.error("CSP " + event.violatedDirective + " " + event.blockedURI)),
    );
    page.on("request", (request) => request.resourceType() === "document" && documents.push(new URL(request.url()).pathname));
    await page.goto(origin + "/items/1");
    // Mounted: the embedded data rendered the same page, and it is interactive.
    await page.getByRole("button", { name: "Layout clicks 0" }).click();
    await page.getByRole("button", { name: "Layout clicks 1" }).waitFor();
    assert.equal(await page.textContent("#site"), "Fixture");
    assert.equal(await page.textContent("#item-id"), "1");
    await page.locator("nav").getByRole("link", { name: "Second", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#item-id")?.textContent === "2");
    assert.equal(await page.title(), "Second item");

    // Editing a page hot-replaces it in place: new markup, same document, state kept (its own and the layout's).
    await page.getByRole("button", { name: "Likes 0" }).click();
    await page.getByRole("button", { name: "Likes 1" }).waitFor();
    await writeFile(pageFile, pageSource.replace('<p id="item-id">', '<p id="edited">edited</p>\n      <p id="item-id">'));
    await page.waitForSelector("#edited", { timeout: 10_000 });
    assert.equal(await page.textContent("#item-id"), "2");
    assert.equal(await page.textContent("#likes"), "Likes 1");
    assert.equal(await page.textContent("#layout-clicks"), "Layout clicks 1");
    // Editing the layout keeps its state and the page's.
    await writeFile(layoutFile, layoutSource.replace("Layout clicks {clicks()}", "Layout taps {clicks()}"));
    await page.waitForFunction(() => document.querySelector("#layout-clicks")?.textContent === "Layout taps 1", undefined, { timeout: 10_000 });
    assert.equal(await page.textContent("#likes"), "Likes 1");
    // A different set of signals starts the component fresh.
    const extraSource = pageSource
      .replace("const likes = signal(0);", "const likes = signal(0);\n  const extra = signal(5);")
      .replace("Likes {likes()}", "Likes {likes()} {extra()}");
    await writeFile(pageFile, extraSource);
    await page.waitForFunction(() => document.querySelector("#likes")?.textContent === "Likes 0 5", undefined, { timeout: 10_000 });
    assert.equal(await page.textContent("#layout-clicks"), "Layout taps 1");
    await page.getByRole("button", { name: "Likes 0 5" }).click();
    await page.getByRole("button", { name: "Likes 1 5" }).waitFor();
    // A changed non-component export (head) updates the importer instead: the generated app module
    // hot-replaces in place and its routes load the (lazy) page again; the page keeps its state too.
    const updates: string[] = [];
    page.on("console", (message) => message.text().includes("hot updated") && updates.push(message.text()));
    await writeFile(pageFile, extraSource.replace("title: data.title,", 'title: data.title + "!",'));
    for (let i = 0; i < 200 && !updates.some((text) => text.includes("app.tsx")); i++) await page.waitForTimeout(50);
    assert.ok(
      updates.some((text) => text.includes("/.rivet/app.tsx")),
      updates.join(),
    );
    // The routes reloaded: the new head is in.
    await page.waitForFunction(() => document.title === "Second item!", undefined, { timeout: 10_000 });
    assert.equal(await page.textContent("#layout-clicks"), "Layout taps 1");
    assert.equal(await page.textContent("#likes"), "Likes 1 5");
    // Server modules run per request: an edited loader shows on the next navigation.
    await writeFile(loaderFile, loaderSource.replace('"First item"', '"Edited first"'));
    await new Promise((done) => setTimeout(done, 300));
    await page.locator("nav").getByRole("link", { name: "First", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Edited first", undefined, { timeout: 10_000 });
    assert.deepEqual(documents, ["/items/1"]);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await server.close();
    await rm(root, { recursive: true, force: true });
    restoreEnv();
  }
});

test(
  "production build: resumed client navigation over the data endpoint",
  steps(async (t) => {
    await rm(root + "dist", { recursive: true, force: true });
    await withNodeEnv("production", () => build({ root, configFile, logLevel: "silent" }));
    await withNodeEnv("production", () => build({ root, configFile, logLevel: "silent", build: { ssr: true } }));
    const app = await start({ dist: root + "dist", port: 0, onError: () => {} });
    const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
    try {
      const first = await fetch(app.url + "/items/1");
      const html = await first.text();
      assert.match(html, /<link rel="stylesheet" href="\/assets\/[^"]+\.css">/);
      // Strict nonce CSP: inline scripts carry the response's nonce; everything else loads through them.
      const csp = first.headers.get("content-security-policy")!;
      const nonce = /'nonce-([^']+)'/.exec(csp)![1]!;
      assert.equal(csp, `script-src 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none'`);
      for (const tag of html.match(/<script\b[^>]*>/g)!) assert.ok(tag.includes(`nonce="${nonce}"`) || /type="rivet\/state"/.test(tag), tag);
      assert.equal((await fetch(app.url + "/items/1?_rivet=data")).headers.get("content-security-policy"), null);
      assert.match(html, /<script type="rivet\/state"/);

      const page = await browser.newPage();
      const errors: string[] = [],
        documents: string[] = [],
        data: string[] = [],
        scripts: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => message.text().startsWith("CSP ") && errors.push(message.text()));
      await page.addInitScript(() =>
        document.addEventListener("securitypolicyviolation", (event) => console.error("CSP " + event.violatedDirective + " " + event.blockedURI)),
      );
      // The browser gets the policy with Trusted Types enforced (`strictCSP(nonce, { trustedTypes: true })`).
      await page.route(app.url + "/**", async (route) => {
        if (route.request().resourceType() !== "document") return route.continue();
        const response = await route.fetch();
        const policy = /'nonce-([^']+)'/.exec(response.headers()["content-security-policy"] ?? "");
        const headers = { ...response.headers(), ...(policy ? { "content-security-policy": strictCSP(policy[1]!, { trustedTypes: true }) } : {}) };
        await route.fulfill({ response, headers });
      });
      page.on("request", (request) => {
        if (request.resourceType() === "document") documents.push(new URL(request.url()).pathname);
        if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
        const url = new URL(request.url());
        if (url.searchParams.get("_rivet") === "data") data.push(url.pathname);
      });
      await page.goto(app.url + "/");
      // Resumed runtime started and its idle-time listeners attached (before that, links navigate natively).
      const ready = async () => {
        await page.waitForFunction(() => (document as unknown as { $r?: { r(): unknown } }).$r?.r());
        await page.evaluate(() => new Promise((done) => requestIdleCallback(() => setTimeout(done, 50))));
        // The eager click handler's chunk must be in, or a click under load navigates natively.
        await page.waitForLoadState("networkidle");
      };
      const nav = (name: string) => page.locator("nav").getByRole("link", { name, exact: true });

      await t.test("link click renders the route from the data endpoint, sets title and focus", async () => {
        await page.getByRole("button", { name: "Layout clicks 0" }).click();
        await page.getByRole("button", { name: "Layout clicks 1" }).waitFor();
        await ready();
        // Page chunks wait for navigation intent: resuming loads none of them.
        assert.ok(!scripts.some((path) => /\/_id_-/.test(path)), scripts.join());
        await nav("Second").hover();
        for (let i = 0; i < 100 && !scripts.some((path) => /\/_id_-/.test(path)); i++) await page.waitForTimeout(20);
        assert.ok(
          scripts.some((path) => /\/_id_-/.test(path)),
          "hover loads the page chunk",
        );
        await nav("Second").click();
        await page.waitForSelector("#item");
        assert.equal(new URL(page.url()).pathname, "/items/2");
        assert.equal(await page.textContent("#item-id"), "2");
        assert.equal(await page.title(), "Second item");
        await page.waitForFunction(() => document.activeElement?.textContent === "Second item");
        assert.deepEqual(documents, ["/"]);
        assert.deepEqual(data, ["/items/2"]);
        assert.equal(scripts.filter((path) => /\/_id_-/.test(path)).length, 1);
        // The root layout stayed mounted: its state survived, its data came from the navigation.
        assert.equal(await page.textContent("#layout-clicks"), "Layout clicks 1");
        assert.equal(await page.textContent("#site"), "Fixture");
        assert.equal(await page.textContent("#layout-path"), "/items/2");
      });

      await t.test("hover prefetches; the click reuses the prefetched response", async () => {
        await nav("First").hover();
        for (let i = 0; i < 100 && !data.includes("/items/1"); i++) await page.waitForTimeout(20);
        assert.deepEqual(data, ["/items/2", "/items/1"]);
        await nav("First").click();
        await page.waitForFunction(() => document.querySelector("#item-id")?.textContent === "1");
        assert.deepEqual(data, ["/items/2", "/items/1"]);
      });

      await t.test("guards run on the server during client navigation: redirect replaces the entry", async () => {
        await nav("Private").click();
        await page.waitForURL(/\/login\?next=\/private$/);
        await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Sign in");
        assert.ok(data.includes("/private") && data.includes("/login"));
        assert.equal(await page.title(), "Sign in");
        await page.goBack();
        await page.waitForFunction(() => document.querySelector("#item-id")?.textContent === "1");
      });

      await t.test("a link to an unmatched URL loads its document (server 404 view); failed loads render the error view", async () => {
        // No page route matches `/missing`: the router leaves the link to the browser (no data request).
        await nav("Missing").click();
        await page.waitForURL(app.url + "/missing");
        await page.waitForSelector("#not-found");
        assert.deepEqual(documents, ["/", "/missing"]);
        assert.ok(!data.includes("/missing"), data.join());
        await nav("Broken").click();
        await page.waitForSelector("#failure");
        assert.deepEqual(documents, ["/", "/missing"]);
      });

      await t.test("scroll: new routes start at the top, back restores the position", async () => {
        await nav("Long").click();
        await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Long");
        await page.evaluate(() => scrollTo(0, 2000));
        await page.waitForFunction(() => scrollY >= 1900);
        await page.getByRole("link", { name: "Back home" }).click();
        await page.waitForSelector("#items");
        await page.waitForFunction(() => scrollY === 0);
        await page.goBack();
        await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Long");
        await page.waitForFunction(() => scrollY >= 1900);
      });

      assert.deepEqual(errors, []);
      // Client-rendered templates went through the "rivet" policy; plain strings are refused.
      assert.equal(
        await page.evaluate(() => {
          try {
            document.body.insertAdjacentHTML("beforeend", "<b>x</b>");
            return false;
          } catch {
            return true;
          }
        }),
        true,
      );
    } finally {
      await browser.close();
      await app.close();
    }
  }),
);

test("CSR mode: index.html shell mounts the app; client navigation needs no server", async () => {
  const csrRoot = new URL("./fixture-csr/", import.meta.url).pathname;
  await rm(csrRoot + "dist", { recursive: true, force: true });
  await withNodeEnv("production", () => build({ root: csrRoot, configFile: csrRoot + "vite.config.ts", logLevel: "silent" }));
  const { readFile } = await import("node:fs/promises");
  const { serve } = await import("../adapters/node.ts");
  const shell = await readFile(csrRoot + "dist/client/index.html", "utf8");
  assert.match(shell, /<script type="module" src="\/assets\/app-[^"]+\.js"><\/script><\/head>/);
  assert.match(shell, /<div id="app"><\/div>/);
  // SPA fallback: every unknown path gets the shell.
  const app = await serve({
    client: csrRoot + "dist/client",
    port: 0,
    handler: () => new Response(shell, { headers: { "content-type": "text/html; charset=utf-8" } }),
  });
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  try {
    const page = await browser.newPage();
    const errors: string[] = [],
      documents: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => request.resourceType() === "document" && documents.push(new URL(request.url()).pathname));
    await page.goto(app.url + "/");
    // The route head applies in the browser (alpha.1 report: the shell's title never changed): first render + navigations.
    const titled = (title: string) => page.waitForFunction((title) => document.title === title, title);
    await titled("CSR home");
    await page.getByRole("button", { name: "Count 0" }).click();
    await page.getByRole("button", { name: "Count 1" }).waitFor();
    await page.getByRole("link", { name: "About" }).click();
    await page.waitForSelector("#about");
    assert.equal(await page.textContent("#about"), "About /about");
    await titled("About /about");
    // No page route matches `/nowhere`: a document load (the SPA fallback shell renders the 404 view).
    await page.getByRole("link", { name: "Nowhere" }).click();
    await page.waitForURL(app.url + "/nowhere");
    await page.waitForSelector("#not-found");
    await page.goBack();
    await page.waitForSelector("#about");
    // Nested layout: kept (state, typed value, url() follows) between siblings; leaving disposes it.
    const shopHeading = (name: string) => page.waitForFunction((name) => document.querySelector("h1")?.textContent === name, name);
    await page.evaluate(() => history.pushState(null, "", "/shop/a"));
    await page.goBack();
    await page.goForward();
    await shopHeading("Shop page a");
    await titled("A · Shop");
    await page.click("#shop-count");
    await page.fill("#shop-input", "typed");
    await page.click('#shop a[href="/shop/b"]');
    await shopHeading("Shop page b");
    await titled("B · Shop");
    assert.equal(await page.textContent("#shop-count"), "Shop 1");
    assert.equal(await page.inputValue("#shop-input"), "typed");
    assert.equal(await page.textContent("#shop-url"), "/shop/b");
    await page.click('#shop a[href="/about"]');
    await page.waitForSelector("#about");
    assert.equal(await page.$("#shop"), null);
    // Back from `/nowhere` may load `/about` again (no back/forward cache); everything else stayed in the client.
    assert.deepEqual(
      documents.filter((path) => path !== "/about"),
      ["/", "/nowhere"],
    );
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await app.close();
  }
});

test("CSR mode rejects server modules; browser code cannot import x.server.ts", async () => {
  const { generate } = await import("../build/codegen.ts");
  const { routeTable } = await import("../build/routes.ts");
  assert.throws(
    () => generate(routeTable(["index.tsx", "index.server.ts"]), { routesDir: "src/routes", mode: "csr" }),
    /CSR apps have no server.*index\.server\.ts/,
  );
});

test("static build: prerendered pages carry a hash CSP (Trusted Types on) and resume and navigate under it", async () => {
  const staticRoot = new URL("./fixture-static/", import.meta.url).pathname;
  const config = { root: staticRoot, configFile: staticRoot + "vite.config.ts", logLevel: "silent" as const };
  await rm(staticRoot + "dist", { recursive: true, force: true });
  await withNodeEnv("production", () => build(config));
  await withNodeEnv("production", () => build({ ...config, build: { ssr: true } }));
  const { prerenderBuild } = await import("../adapters/static.ts");
  const report = await prerenderBuild({ dist: staticRoot + "dist", csp: { trustedTypes: true } });
  assert.deepEqual(report.pages.sort(), ["/", "/about"]);
  const client = staticRoot + "dist/client";
  // A production build whatever ran before in this process (dev servers set NODE_ENV for the process).
  for (const file of await readdir(client + "/assets"))
    if (file.endsWith(".js")) assert.doesNotMatch(await readFile(client + "/assets/" + file, "utf8"), /rivet\.devtools/, file);
  const html = await readFile(client + "/index.html", "utf8");
  assert.match(
    html,
    // After the leading charset (and viewport) meta: the charset stays first.
    /<head><meta charset=[^>]*>(?:\s*<meta name="viewport"[^>]*>)?<meta http-equiv="Content-Security-Policy" content="script-src 'sha256-[^']+' 'self'; object-src 'none'; base-uri 'none'; require-trusted-types-for 'script'; trusted-types rivet">/,
  );
  const { serve } = await import("../adapters/node.ts");
  // A plain static host: `<path>/index.html`, no headers of its own.
  const app = await serve({
    client,
    port: 0,
    handler: async (request) => {
      const path = new URL(request.url).pathname.replace(/\/$/, "");
      const body = await readFile(client + path + "/index.html").catch(() => null);
      return body ? new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } }) : new Response("missing", { status: 404 });
    },
  });
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  try {
    const page = await browser.newPage();
    const errors: string[] = [],
      documents: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.text().startsWith("CSP ") && errors.push(message.text()));
    await page.addInitScript(() =>
      document.addEventListener("securitypolicyviolation", (event) => console.error("CSP " + event.violatedDirective + " " + event.blockedURI)),
    );
    page.on("request", (request) => request.resourceType() === "document" && documents.push(new URL(request.url()).pathname));
    await page.goto(app.url + "/");
    await page.getByRole("button", { name: "Clicks 0" }).click();
    await page.getByRole("button", { name: "Clicks 1" }).waitFor();
    await page.waitForFunction(() => (document as unknown as { $r?: { r(): unknown } }).$r?.r());
    await page.evaluate(() => new Promise((done) => requestIdleCallback(() => setTimeout(done, 50))));
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "About" }).click();
    await page.waitForSelector("#about");
    assert.equal(await page.textContent("#about"), "About at build time");
    assert.equal(await page.title(), "About");
    assert.deepEqual(documents, ["/"]);
    assert.deepEqual(errors, []);
    assert.equal(
      await page.evaluate(() => {
        try {
          document.body.insertAdjacentHTML("beforeend", "<b>x</b>");
          return false;
        } catch {
          return true;
        }
      }),
      true,
    );
  } finally {
    await browser.close();
    await app.close();
  }
});
