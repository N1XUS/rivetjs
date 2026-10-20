import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHandler, type AppRoute, type ServerModule } from "../server/handler.ts";
import { fillPattern, prerender } from "../adapters/static.ts";

const mod = (module: ServerModule) => () => Promise.resolve(module);
const handler = (routes: AppRoute[]) =>
  createHandler({
    routes,
    render: (input) => new Response(`<p>${input.url.pathname} ${JSON.stringify(input.data)}</p>`, { headers: { "content-type": "text/html" } }),
    renderError: ({ status }) => new Response(`<p>error ${status}</p>`, { status }),
  });

test("fillPattern encodes params and splats per segment", () => {
  assert.equal(fillPattern("/blog/:slug", { slug: "a b" }), "/blog/a%20b");
  assert.equal(fillPattern("/docs/*path", { path: "x/y z" }), "/docs/x/y%20z");
  assert.equal(fillPattern("/", {}), "/");
  assert.throws(() => fillPattern("/blog/:slug", {}), /Missing param "slug"/);
});

test("prerenders static routes and entries with data files, 404 page and CSR shell", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rivet-static-"));
  try {
    const routes: AppRoute[] = [
      { id: "index", pattern: "/", page: true, layouts: [], server: mod({ load: () => "home" }) },
      {
        id: "blog/[slug]",
        pattern: "/blog/:slug",
        page: true,
        layouts: [],
        server: mod({ entries: () => [{ slug: "one" }, { slug: "two" }], load: (e) => e.params.slug }),
      },
      { id: "app/[id]", pattern: "/app/:id", page: true, layouts: [] },
      { id: "api/x", pattern: "/api/x", page: false, layouts: [], server: mod({ onGet: () => new Response("x") }) },
    ];
    const report = await prerender({ handler: handler(routes), routes, outDir: dir, shell: () => "<div id=app></div>" });
    assert.deepEqual(report, { pages: ["/", "/blog/one", "/blog/two"], fallback: ["app/[id]"], resumes: false });
    assert.equal(await readFile(join(dir, "index.html"), "utf8"), '<p>/ ["home"]</p>');
    assert.equal(await readFile(join(dir, "blog/two/index.html"), "utf8"), '<p>/blog/two ["two"]</p>');
    assert.match(await readFile(join(dir, "blog/one/_data.json"), "utf8"), /"one"/);
    assert.equal(await readFile(join(dir, "404.html"), "utf8"), "<p>error 404</p>");
    assert.equal(await readFile(join(dir, "200.html"), "utf8"), "<div id=app></div>");
    assert.deepEqual((await readdir(dir)).sort(), ["200.html", "404.html", "_data.json", "blog", "index.html"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("zero-JS sites: no _data.json when no page resumes and no CSR shell route navigates; one resumed page brings them all", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rivet-static-"));
  try {
    const routes: AppRoute[] = [
      { id: "index", pattern: "/", page: true, layouts: [], server: mod({ load: () => "home" }) },
      { id: "about", pattern: "/about", page: true, layouts: [] },
    ];
    await prerender({ handler: handler(routes), routes, outDir: dir });
    assert.deepEqual((await readdir(dir)).sort(), ["404.html", "about", "index.html"]);
    assert.deepEqual(await readdir(join(dir, "about")), ["index.html"]);
    // A page with resume state: its router may navigate anywhere, so every page gets its data file.
    const state = (path: string) => (path === "/about" ? '<script type="rivet/state" data-region="0">{}</script>' : "");
    const resumed = createHandler({
      routes,
      render: (input) => new Response(`<p>${input.url.pathname}</p>${state(input.url.pathname)}`, { headers: { "content-type": "text/html" } }),
      renderError: ({ status }) => new Response(`<p>error ${status}</p>`, { status }),
    });
    await prerender({ handler: resumed, routes, outDir: dir });
    assert.match(await readFile(join(dir, "_data.json"), "utf8"), /"home"/);
    assert.deepEqual((await readdir(join(dir, "about"))).sort(), ["_data.json", "index.html"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("prune: a zero-JS site keeps only the referenced scripts' import closure; deps modules go; a resumed site keeps all", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rivet-static-"));
  try {
    const routes: AppRoute[] = [{ id: "index", pattern: "/", page: true, layouts: [] }];
    const page = (state: boolean) =>
      createHandler({
        routes,
        render: () =>
          new Response(`<script type="module" src="/assets/a.js"></script>${state ? '<script type="rivet/state" data-region="0">{}</script>' : ""}`, {
            headers: { "content-type": "text/html" },
          }),
        renderError: ({ status }) => new Response(`<p>error ${status}</p>`, { status }),
      });
    const files = ["assets/a.js", "assets/b.js", "assets/lazy.js", "assets/c.js", "assets/c.deps.js", "assets/a.deps.js"];
    const setup = async () => {
      await mkdir(join(dir, ".vite"), { recursive: true });
      await mkdir(join(dir, "assets"), { recursive: true });
      const manifest = {
        "a.ts": { file: "assets/a.js", imports: ["_b.js"], dynamicImports: ["lazy.ts"] },
        "_b.js": { file: "assets/b.js" },
        "lazy.ts": { file: "assets/lazy.js" },
        "c.ts": { file: "assets/c.js" },
      };
      await writeFile(join(dir, ".vite/manifest.json"), JSON.stringify(manifest));
      for (const file of files) await writeFile(join(dir, file), "");
    };
    await setup();
    const report = await prerender({ handler: page(false), routes, outDir: dir, prune: true });
    assert.deepEqual(report.pruned, ["assets/a.deps.js", "assets/c.deps.js", "assets/c.js"]);
    assert.deepEqual((await readdir(join(dir, "assets"))).sort(), ["a.js", "b.js", "lazy.js"]);
    await setup();
    const resumed = await prerender({ handler: page(true), routes, outDir: dir, prune: true });
    assert.equal(resumed.pruned, undefined);
    assert.deepEqual((await readdir(join(dir, "assets"))).sort(), files.map((file) => file.slice(7)).sort());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("origin: unset, state or data holding the placeholder http://localhost is an error; a configured origin is used", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rivet-static-"));
  try {
    const routes: AppRoute[] = [{ id: "index", pattern: "/", page: true, layouts: [], server: mod({ load: (e) => e.url.href }) }];
    const baked = createHandler({
      routes,
      render: (input) =>
        new Response(`<link rel="canonical" href="${input.url.href}"><script type="rivet/state" data-region="0">${JSON.stringify(input.data)}</script>`, {
          headers: { "content-type": "text/html" },
        }),
      renderError: ({ status }) => new Response(`<p>error ${status}</p>`, { status }),
    });
    await assert.rejects(prerender({ handler: baked, routes, outDir: dir }), /Prerender \/: the resume state holds the placeholder origin http:\/\/localhost/);
    await prerender({ handler: baked, routes, outDir: dir, origin: "https://site.test" });
    assert.match(await readFile(join(dir, "index.html"), "utf8"), /href="https:\/\/site\.test\/"/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("server-only dynamic routes and failing pages are build errors", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rivet-static-"));
  try {
    const guarded: AppRoute[] = [{ id: "me", pattern: "/me/:id", page: true, layouts: [], server: mod({ load: () => 1 }) }];
    await assert.rejects(prerender({ handler: handler(guarded), routes: guarded, outDir: dir }), /Route me needs a server/);
    // A layout's loader or guard needs a server too (a CSR-shell fallback would never run it).
    const layoutLoad: AppRoute[] = [{ id: "u", pattern: "/u/:id", page: true, layouts: [mod({ load: () => 1 })] }];
    await assert.rejects(prerender({ handler: handler(layoutLoad), routes: layoutLoad, outDir: dir, shell: () => "" }), /Route u needs a server/);
    const layoutGuard: AppRoute[] = [{ id: "v", pattern: "/v/:id", page: true, layouts: [undefined, mod({ guard: () => undefined })], server: mod({}) }];
    await assert.rejects(prerender({ handler: handler(layoutGuard), routes: layoutGuard, outDir: dir, shell: () => "" }), /Route v needs a server/);
    const broken: AppRoute[] = [{ id: "x", pattern: "/x", page: true, layouts: [], server: mod({ guard: () => new Response("no", { status: 401 }) }) }];
    await assert.rejects(prerender({ handler: handler(broken), routes: broken, outDir: dir }), /Prerender \/x \(x\) returned 401/);
    const shellless: AppRoute[] = [{ id: "c", pattern: "/c/:id", page: true, layouts: [] }];
    await assert.rejects(prerender({ handler: handler(shellless), routes: shellless, outDir: dir }), /need a CSR shell/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("pages whose paths differ only in letter case are a build error before the second is written", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rivet-static-"));
  try {
    const routes: AppRoute[] = [
      { id: "about", pattern: "/about", page: true, layouts: [], server: mod({}) },
      {
        id: "api/[...symbol]",
        pattern: "/api/*symbol",
        page: true,
        layouts: [],
        server: mod({ entries: () => [{ symbol: "kit/jsonLd" }, { symbol: "kit/JsonLd" }] }),
      },
    ];
    await assert.rejects(
      prerender({ handler: handler(routes), routes, outDir: dir }),
      /Prerender paths \/api\/kit\/jsonLd and \/api\/kit\/JsonLd \(api\/\[\.\.\.symbol\]\) differ only in letter case/,
    );
    // The first page was written, the clashing one never was (on a case-sensitive file system: no `JsonLd` dir).
    assert.deepEqual(await readdir(join(dir, "api/kit")), ["jsonLd"]);
    // Across routes too.
    const across: AppRoute[] = [
      { id: "about", pattern: "/about", page: true, layouts: [], server: mod({}) },
      { id: "About", pattern: "/About", page: true, layouts: [], server: mod({}) },
    ];
    await assert.rejects(prerender({ handler: handler(across), routes: across, outDir: dir }), /\/about and \/About \(About\) differ only in letter case/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("hashCSP: inline scripts allowed by hash, data and module-src scripts left alone", async () => {
  const { hashCSP } = await import("../adapters/static.ts");
  const { createHash } = await import("node:crypto");
  const loader = "document.$r=1;";
  const html = `<!doctype html><html><head><title>x</title></head><body><script type="rivet/state">{"a":1}</script><script>${loader}</script><script type="module" src="/a.js"></script></body></html>`;
  const out = hashCSP(html);
  const hash = createHash("sha256").update(loader).digest("base64");
  assert.equal(
    out,
    html.replace(
      "<head>",
      `<head><meta http-equiv="Content-Security-Policy" content="script-src 'sha256-${hash}' 'self'; object-src 'none'; base-uri 'none'">`,
    ),
  );
  assert.equal(hashCSP("<p>no head</p><script>x()</script>"), "<p>no head</p><script>x()</script>");
  assert.equal(hashCSP("<head></head><p>no scripts</p>"), "<head></head><p>no scripts</p>");
});

test("hashCSP: kit head scripts (third-party origins, #rivet-scripts list, bootstrap hashed, JSON-LD not)", async () => {
  const { hashCSP } = await import("../adapters/static.ts");
  const { headTags } = await import("../shared/head.ts");
  const { createHash } = await import("node:crypto");
  const sha = (code: string) => `'sha256-${createHash("sha256").update(code).digest("base64")}'`;
  const head = headTags({
    scripts: [
      { src: "https://cdn.test/a.js", strategy: "eager" },
      { src: "/own.js" },
      { src: "https://analytics.test/t.js?x=1&y=2", strategy: "idle" },
      { jsonLd: { "@type": "Organization" } },
    ],
  });
  const out = hashCSP(`<!doctype html><html><head>${head}</head><body></body></html>`);
  const csp = /content="([^"]*)"/.exec(out)?.[1] ?? "";
  const bootstrap = /<script id="rivet-scripts">([\s\S]*?)<\/script>/.exec(head)![1]!;
  assert.equal(csp, `script-src ${sha(bootstrap)} 'self' https://cdn.test https://analytics.test; object-src 'none'; base-uri 'none'`);
  const { trustedTypesDirectives } = await import("../shared/csp.ts");
  assert.equal(trustedTypesDirectives({ trustedTypes: true }), "; require-trusted-types-for 'script'; trusted-types rivet");
  assert.equal(trustedTypesDirectives({ trustedTypes: ["rivet-script"] }), "; require-trusted-types-for 'script'; trusted-types rivet rivet-script");
});

test("hashCSP in Chromium: the page's own script and same-origin imports run; injected scripts do not", async () => {
  const { hashCSP } = await import("../adapters/static.ts");
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  try {
    const page = await browser.newPage();
    const violations: string[] = [];
    page.on("console", (message) => message.text().startsWith("CSP ") && violations.push(message.text()));
    await page.route("http://site.test/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/chunk.js") return route.fulfill({ contentType: "text/javascript", body: "window.chunk = true;" });
      return route.fulfill({
        contentType: "text/html",
        body: hashCSP(
          `<!doctype html><html><head></head><body><script>document.addEventListener("securitypolicyviolation", (e) => console.error("CSP " + e.violatedDirective)); window.own = true; import("/chunk.js");</script></body></html>`,
        ),
      });
    });
    await page.goto("http://site.test/");
    await page.waitForFunction(() => (window as unknown as { chunk?: boolean }).chunk === true);
    assert.equal(await page.evaluate(() => (window as unknown as { own?: boolean }).own), true);
    // Markup injected later (e.g. through an XSS) is not trusted.
    await page.evaluate(() => {
      document.body.insertAdjacentHTML("beforeend", '<img src=x onerror="window.injected = true">');
    });
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => (window as unknown as { injected?: boolean }).injected), undefined);
    assert.ok(
      violations.some((v) => v.startsWith("CSP script-src")),
      violations.join(),
    );
  } finally {
    await browser.close();
  }
});
