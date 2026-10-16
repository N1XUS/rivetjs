import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createPlaygroundServer } from "../server.ts";
import { createServerServices } from "../src/services/server.ts";

test("production playground: resumable file-routed pages, endpoints, legacy redirects, assets", async () => {
  const app = await createPlaygroundServer({ port: 0 });
  try {
    const home = await fetch(app.url + "/?q=kept");
    assert.equal(home.status, 200);
    assert.match(home.headers.get("content-type")!, /text\/html/);
    const html = await home.text();
    assert.match(html, /Owned rendering/);
    assert.match(html, /href="\/items\/1"/);
    // Shared-element transition: the list title and the item page heading carry the same name.
    assert.match(html, /<span data-vt-name="item-1">Owned rendering<\/span>/);
    // Resumable: state + one inline loader, no module script before interaction.
    assert.match(html, /<script type="rivet\/state"/);
    assert.equal(html.match(/<script\b[^>]*>/g)!.filter((tag) => !/type="rivet\/state"/.test(tag)).length, 1);
    assert.doesNotMatch(html, /<script type="module"/);
    assert.match(html, /<title>Rivet playground<\/title>/);
    assert.match(html, /<meta name="description" content="Rivet compiled JSX framework example">/);
    assert.equal(home.headers.get("cache-control"), "no-cache");
    assert.match(home.headers.get("content-security-policy")!, /^script-src 'nonce-[^']+' 'strict-dynamic'; object-src 'none'; base-uri 'none'$/);
    // Stylesheets (`inlineStylesheets` "auto"): the page's sheets add up to ≤ 6 KB brotli (Tailwind ~3.5 KB), so all of
    // them are inline with the request nonce, in link order: no render-blocking stylesheet request.
    assert.doesNotMatch(html, /<link rel="stylesheet"/);
    const styled = await fetch(app.url + "/styles");
    const styledHTML = await styled.text();
    const nonce = /'nonce-([^']+)'/.exec(styled.headers.get("content-security-policy")!)![1]!;
    assert.doesNotMatch(styledHTML, /<link rel="stylesheet"/);
    assert.equal(styledHTML.match(new RegExp(`<style nonce="${nonce.replace(/[+/]/g, "\\$&")}">[\\s\\S]+?</style>`, "g"))?.length, 2);
    assert.doesNotMatch(styledHTML, /\$vite\$/);
    const detail = await fetch(app.url + "/items/1?from=list");
    assert.equal(detail.status, 200);
    const body = await detail.text();
    assert.match(body, /<title>Owned rendering · Rivet playground<\/title>/);
    assert.match(body, /<meta name="description" content="Each request and mounted region owns its work and cleanup.">/);
    assert.match(body, /<script type="rivet\/state"/);
    assert.match(body, /<h1[^>]* data-vt-name="item-1"[^>]*>/);
    // Route data for client navigation (guards and loaders run on the server).
    const data = await fetch(app.url + "/items/2?_rivet=data");
    assert.equal(data.status, 200);
    assert.equal(data.headers.get("cache-control"), "private, no-store");
    assert.match(await data.text(), /Explicit async/);
    // The client-rendered demo was replaced by the resumed pages.
    for (const [path, location] of [
      ["/csr", "/"],
      ["/csr/items/2", "/items/2"],
      ["/csr/items/1?q=csr", "/items/1?q=csr"],
    ]) {
      const response = await fetch(app.url + path, { redirect: "manual" });
      assert.equal(response.status, 308, path);
      assert.equal(response.headers.get("location"), location, path);
    }
    for (const path of ["/", "/items/2", "/resume"]) {
      const page = await (await fetch(app.url + path)).text();
      assert.doesNotMatch(page, /<script type="module"/, path);
      // No modulepreload links: the lazy router's fetch-only hints (Z1) are `data-fo`, added by the loader module after load.
      assert.doesNotMatch(page, /<link rel="modulepreload"/, path);
    }
    const list = await fetch(app.url + "/api/items?x=1");
    assert.equal(list.status, 200);
    const items = (await list.json()) as { id: string }[];
    assert.equal(items.length, 3);
    assert.equal(items[0]!.id, "1");
    const item = await fetch(app.url + "/api/items/1");
    assert.equal(item.status, 200);
    assert.deepEqual(await item.json(), items[0]);
    assert.equal(item.headers.get("cache-control"), "no-store");
    for (const path of [
      "/missing",
      "/items/missing",
      "/api/items/missing",
      "/csr/missing",
      "/csr/items/2/extra",
      "/index.html",
      "/assets/../server/entry.server.js",
      "/assets/%2e%2e%2fserver.js",
      "/assets/%5c..%5cserver.js",
      "/.vite/manifest.json",
    ])
      assert.equal((await fetch(app.url + path)).status, 404, path);
    const missing = await (await fetch(app.url + "/items/missing")).text();
    assert.match(missing, /Page not found/);
    // The global stylesheet is inline on every page; its file is still served (client navigation, `inlineStylesheets: "never"`).
    const manifest = JSON.parse(await readFile(new URL("../dist/client/.vite/manifest.json", import.meta.url), "utf8")) as Record<string, { file: string }>;
    const cssPath = "/" + manifest["src/styles.css"]!.file;
    const css = await fetch(app.url + cssPath);
    assert.equal(css.status, 200);
    assert.match(css.headers.get("content-type")!, /text\/css/);
    assert.match(css.headers.get("cache-control")!, /immutable/);
    assert.match(await css.text(), /tailwindcss/);
    const head = await fetch(app.url + "/", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    const method = await fetch(app.url + "/api/items", { method: "POST" });
    assert.equal(method.status, 405);
    assert.equal(method.headers.get("allow"), "GET, HEAD");
    // The resume runtime (state `rt`; pages without scheduled prefetches carry no `data-preload`).
    const runtime = html.match(/"rt":"([^"]+\.js)"/)![1]!;
    const js = await fetch(app.url + runtime);
    assert.equal(js.status, 200);
    assert.match(js.headers.get("content-type")!, /javascript/);
    assert.match(js.headers.get("cache-control")!, /immutable/);
    assert.equal((await fetch(app.url + "/healthz")).status, 200);
  } finally {
    await app.close();
  }
});

test("server services clone uncached data and observe abort", async () => {
  const first = createServerServices(),
    second = createServerServices();
  const a = await first.list();
  a[0]!.title = "mutated";
  assert.equal((await second.list())[0]!.title, "Owned rendering");
  const controller = new AbortController();
  controller.abort(Error("stop service"));
  await assert.rejects(
    Promise.resolve().then(() => first.list(controller.signal)),
    /stop service/,
  );
  await assert.rejects(
    Promise.resolve().then(() => first.detail("1", controller.signal)),
    /stop service/,
  );
});

test("development server: Vite with the router middleware, styles and endpoints", async () => {
  const app = await createPlaygroundServer({ port: 0, dev: true });
  try {
    const home = await fetch(app.url + "/");
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /Owned rendering/);
    // Dev serves pages resumable, like production; the first hot update switches to client rendering.
    assert.match(html, /<div data-rivet-dev="resume" style="display:contents">/);
    assert.match(html, /type="rivet\/state"/);
    assert.match(html, /"rt":"\/\.rivet\/entry\.resume\.ts"/);
    assert.match(html, /src="\/\.rivet\/entry\.dev\.tsx"/);
    assert.match(html, /<script type="module" src="\/@vite\/client"/);
    assert.match(html, /<link rel="stylesheet" href="\/src\/styles.css">/);
    const legacy = await fetch(app.url + "/csr/items/2", { redirect: "manual" });
    assert.equal(legacy.status, 308);
    assert.equal(legacy.headers.get("location"), "/items/2");
    const css = await fetch(app.url + "/src/styles.css", { headers: { Accept: "text/css" } });
    assert.equal(css.status, 200);
    assert.match(css.headers.get("content-type")!, /text\/css/);
    assert.match(await css.text(), /tailwindcss/);
    assert.equal((await fetch(app.url + "/api/items/2")).status, 200);
    assert.equal((await fetch(app.url + "/missing")).status, 404);
  } finally {
    await app.close();
  }
});
