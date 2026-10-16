// Document prefetch end to end (`rivetRouter({ prefetch: "document" })`, `<Link prefetch>`): a static
// build of fixture-prefetch (resumed pages, hash CSP) driven in Chromium. Speculation Rules: the
// browser prefetches / prerenders marked links on hover and the navigation uses the prefetched
// document. Fallback (the rules stripped, `HTMLScriptElement.supports` false — as in Safari/Firefox):
// intent timing, cancel, dedupe, skip conditions, the `fetch()` path; resumed pages keep working.
// Note: Chromium never activates a prerender while DevTools / CDP is attached
// (`PrerenderingDisabledByDevTools`), so prerender links are checked up to the prerender request.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import { readFile, rm, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { build } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { prerenderBuild } from "../adapters/static.ts";
import { withNodeEnv } from "./vite-env.ts";

const root = new URL("./fixture-prefetch/", import.meta.url).pathname;
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

interface Hit {
  path: string;
  purpose: string | undefined;
  dest: string | undefined;
}
/** The prerendered site; `strip` drops the speculation rules from pages (a browser without them); `cache.value`: HTML `cache-control`. */
function serve(dir: string): Promise<{ origin: string; hits: Hit[]; strip: { on: boolean }; cache: { value: string }; close(): void }> {
  const hits: Hit[] = [],
    strip = { on: false },
    cache = { value: "max-age=60" };
  const server = createServer(async (req: IncomingMessage, res) => {
    const path = decodeURIComponent(new URL(req.url!, "http://x").pathname);
    hits.push({ path, purpose: req.headers["sec-purpose"] as string | undefined, dest: req.headers["sec-fetch-dest"] as string | undefined });
    let file = join(dir, path.endsWith("/") ? path + "index.html" : path);
    if (
      !(await stat(file).then(
        (s) => s.isFile(),
        () => false,
      ))
    )
      file = join(dir, path, "index.html");
    const found = await stat(file).then(
      (s) => s.isFile(),
      () => false,
    );
    let body: string | Buffer = await readFile(found ? file : join(dir, "404.html"));
    if (strip.on && extname(file) === ".html") body = body.toString().replace(/<script type="speculationrules"[^>]*>[\s\S]*?<\/script>/, "");
    res.writeHead(found ? 200 : 404, { "content-type": TYPES[extname(found ? file : ".html")] ?? "application/octet-stream", "cache-control": cache.value });
    res.end(body);
  });
  return new Promise((done) =>
    server.listen(0, () =>
      done({ origin: `http://localhost:${(server.address() as { port: number }).port}`, hits, strip, cache, close: () => server.close() }),
    ),
  );
}

let built: Promise<void> | undefined;
const buildOnce = () =>
  (built ??= (async () => {
    await rm(root + "dist", { recursive: true, force: true });
    await withNodeEnv("production", async () => {
      await build({ root, configFile: root + "vite.config.ts", logLevel: "silent" });
      await build({ root, configFile: root + "vite.config.ts", logLevel: "silent", build: { ssr: true } });
    });
    await prerenderBuild({ dist: root + "dist", csp: {} });
  })());

async function open(browser: Browser, url: string, init?: () => void) {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => console.error("CSP " + e.violatedDirective)));
  if (init) await page.addInitScript(init);
  await page.goto(url);
  return { page, errors };
}
// Document requests (not chunks, not the client router's own `_data.json` intent prefetch on `#routed`).
const documentsOf = (hits: Hit[]) => hits.filter((hit) => !hit.path.startsWith("/assets/") && !hit.path.endsWith("/_data.json"));
const prefetchHints = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"]')].map((l) => new URL(l.href).pathname));
const noRules = () => {
  // A browser without Speculation Rules (Safari, Firefox): the inline fallback takes over.
  HTMLScriptElement.supports = () => false;
};

test("SSR: rules + fallback in the head, link attributes, CSP hashes cover them", async () => {
  await buildOnce();
  const html = await readFile(root + "dist/client/index.html", "utf8");
  const rules = JSON.parse(/<script type="speculationrules">([\s\S]*?)<\/script>/.exec(html)![1]!);
  // Routed app (several routes): only links that load documents — reload / external links, or paths no route matches.
  assert.deepEqual(rules.prefetch[0].where.and.slice(0, 2), [{ href_matches: "/*" }, { not: { href_matches: "/" } }]);
  assert.equal(
    rules.prefetch[0].where.and[2].selector_matches,
    ":is(a[data-rivet-prefetch=document],a:not([data-rivet-prefetch]))[href]:not([download],[target]:not([target=_self]))",
  );
  assert.equal(rules.prerender[0].where.and[2].selector_matches, ":is(a[data-rivet-prefetch=prerender])[href]:not([download],[target]:not([target=_self]))");
  const documents = { or: [{ selector_matches: "[data-rivet-reload],[rel~=external]" }, { not: { href_matches: "/(a\\/?|b\\/?|c\\/?|)" } }] };
  assert.deepEqual(rules.prefetch[0].where.and[3], documents);
  assert.deepEqual(rules.prerender[0].where.and[3], documents);
  // The fallback gets the same route paths as a RegExp literal.
  assert.ok(
    html.includes(
      "})(" +
        JSON.stringify(
          ":is(a[data-rivet-prefetch=document],a[data-rivet-prefetch=prerender],a:not([data-rivet-prefetch]))[href]:not([download],[target]:not([target=_self]))",
        ) +
        ",/^\\/(?:a\\/?|b\\/?|c\\/?|)$/)</script>",
    ),
  );
  assert.equal(rules.prefetch[0].eagerness, "moderate");
  assert.match(html, /<script>\(function\(\w,\w\)\{const \w=document;if\(HTMLScriptElement\.supports/);
  assert.match(html, /<a id="pre" href="\/b" data-rivet-prefetch="prerender" data-rivet-reload="">/);
  assert.match(html, /<a id="doc" href="\/a" data-rivet-reload="">/);
  assert.match(html, /<a id="none" href="\/c\?none" data-rivet-prefetch="none" data-rivet-reload="">/);
  // The page's own path is excluded per page.
  const page = await readFile(root + "dist/client/a/index.html", "utf8");
  assert.match(page, /"not":\{"href_matches":"\/a\{\/\}\?"\}/);
  assert.match(page, /<a id="explicit" href="\/c" data-rivet-prefetch="document" data-rivet-reload="">/);
  // Hash CSP lists both inline scripts (rules + fallback).
  const csp = /<meta http-equiv="content-security-policy" content="([^"]*)"/i.exec(html)![1]!;
  assert.ok((csp.match(/'sha256-/g) ?? []).length >= 3, csp);
});

test("Speculation Rules: hover prefetches / prerenders marked links; the navigation uses the prefetched document", async () => {
  await buildOnce();
  const site = await serve(root + "dist/client");
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  try {
    const { page, errors } = await open(browser, site.origin + "/");
    assert.equal(await page.evaluate(() => HTMLScriptElement.supports?.("speculationrules")), true);
    site.hits.length = 0;
    for (const id of ["#routed", "#none", "#download", "#blank", "#self", "#doc"]) {
      await page.hover(id);
      await page.waitForTimeout(350);
    }
    await page.hover("#pre");
    await page.waitForTimeout(500);
    // A link to a path no route matches loads a document without a reload mark: the rules take it.
    await page.hover("#unknown");
    await page.waitForTimeout(350);
    const docs = documentsOf(site.hits);
    assert.deepEqual(
      docs.map((hit) => hit.path + " " + hit.purpose),
      ["/a prefetch", "/b prefetch;prerender", "/legacy/ prefetch"],
    );
    // The fallback stays idle where the rules apply.
    assert.deepEqual(await prefetchHints(page), []);
    await page.click("#doc");
    await page.waitForURL(site.origin + "/a");
    const nav = await page.evaluate(
      () => (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming & { deliveryType: string }).deliveryType,
    );
    assert.equal(nav, "navigational-prefetch");
    assert.equal(documentsOf(site.hits).length, 3, "no second request for /a");
    // The prefetched page resumes: its layout's counter works.
    await page.click("#count");
    await page.locator("#count", { hasText: "Clicks 1" }).waitFor({ timeout: 5000 });
    // A page below the root: its rules (own path `/a{/}?` excluded) are valid and apply.
    await page.hover("#explicit");
    await page.waitForTimeout(500);
    assert.ok(documentsOf(site.hits).some((hit) => hit.path === "/c" && hit.purpose === "prefetch"));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    site.close();
  }
});

test("fallback: intent after 65 ms (cancelled on leave), focus and pointer down; once per URL; skips", async () => {
  await buildOnce();
  const site = await serve(root + "dist/client");
  site.strip.on = true;
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  try {
    const { page, errors } = await open(browser, site.origin + "/", noRules);
    site.hits.length = 0;
    // Pass over a link quicker than the delay: nothing.
    await page.hover("#doc");
    await page.mouse.move(0, 0);
    await page.waitForTimeout(150);
    assert.deepEqual(await prefetchHints(page), []);
    // Rest on it: the first intent probes cacheability (a `no-store` fetch), then the hint; once.
    await page.hover("#doc");
    await page.waitForTimeout(150);
    await page.mouse.move(0, 0);
    await page.hover("#doc");
    await page.waitForTimeout(150);
    assert.deepEqual(await prefetchHints(page), ["/a"]);
    // Skipped: routed (client router), `none`, download, other tab, other origin, the page itself.
    for (const id of ["#routed", "#none", "#download", "#blank", "#external", "#self"]) {
      await page.hover(id);
      await page.waitForTimeout(120);
      await page.focus(id);
    }
    assert.deepEqual(await prefetchHints(page), ["/a"]);
    // Focus prefetches at once (prerender links fall back to a document prefetch); so does pointer down.
    await page.focus("#pre");
    await page.focus("#plain");
    // A path no route matches (no reload mark): a document load, so the fallback takes it like the rules.
    await page.focus("#unknown");
    assert.deepEqual(await prefetchHints(page), ["/a", "/b", "/c", "/legacy/"]);
    await page.waitForTimeout(300);
    assert.deepEqual(
      documentsOf(site.hits).map((hit) => hit.path + " " + hit.purpose),
      ["/a undefined", "/a prefetch", "/b prefetch", "/c prefetch", "/legacy/ prefetch"],
    );
    assert.equal(await page.evaluate(() => sessionStorage.getItem("rivet:prefetch")), "1");
    await page.click("#doc");
    await page.waitForURL(site.origin + "/a");
    assert.equal(documentsOf(site.hits).filter((hit) => hit.path === "/a").length, 2, "the navigation reused the prefetched document");
    await page.click("#count");
    await page.locator("#count", { hasText: "Clicks 1" }).waitFor({ timeout: 5000 });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    site.close();
  }
});

test("fallback: fetch() where rel=prefetch is unsupported; Save-Data turns it off", async () => {
  await buildOnce();
  const site = await serve(root + "dist/client");
  site.strip.on = true;
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  try {
    const { page, errors } = await open(browser, site.origin + "/", () => {
      HTMLScriptElement.supports = () => false;
      DOMTokenList.prototype.supports = () => false;
    });
    site.hits.length = 0;
    await page.focus("#doc");
    await page.focus("#doc");
    await page.waitForTimeout(300);
    assert.deepEqual(await prefetchHints(page), []);
    assert.deepEqual(
      documentsOf(site.hits).map((hit) => hit.path + " " + hit.dest),
      ["/a empty", "/a empty"],
    );
    await page.click("#doc");
    await page.waitForURL(site.origin + "/a");
    // `max-age=60`: the navigation is served from the HTTP cache the warm fetch filled (the probe stored nothing).
    assert.equal(documentsOf(site.hits).filter((hit) => hit.path === "/a").length, 2);
    assert.deepEqual(errors, []);

    const saver = await open(browser, site.origin + "/", () => {
      HTMLScriptElement.supports = () => false;
      Object.defineProperty(Navigator.prototype, "connection", { get: () => ({ saveData: true, effectiveType: "4g" }) });
    });
    site.hits.length = 0;
    await saver.page.focus("#doc");
    await saver.page.hover("#plain");
    await saver.page.waitForTimeout(200);
    assert.deepEqual(await prefetchHints(saver.page), []);
    assert.deepEqual(documentsOf(site.hits), []);
  } finally {
    await browser.close();
    site.close();
  }
});

test("fallback: uncacheable HTML turns prefetch off after one probe, remembered for the tab session", async () => {
  await buildOnce();
  const site = await serve(root + "dist/client");
  site.strip.on = true;
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  try {
    for (const [policy, verdict] of [
      ["no-cache", "0"],
      ["no-store", "0"],
      ["max-age=0", "0"],
      ["public, max-age=0, must-revalidate", "0"],
      ["max-age=0, stale-while-revalidate=60", "1"],
      ["public, max-age=600", "1"],
    ] as const) {
      site.cache.value = policy;
      const { page, errors } = await open(browser, site.origin + "/", noRules);
      site.hits.length = 0;
      await page.focus("#doc");
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => sessionStorage.getItem("rivet:prefetch")), verdict, policy);
      await page.focus("#plain");
      await page.hover("#pre");
      await page.waitForTimeout(200);
      const docs = documentsOf(site.hits).map((hit) => hit.path + " " + hit.purpose);
      if (verdict === "0") {
        assert.deepEqual(docs, ["/a undefined"], policy);
        assert.deepEqual(await prefetchHints(page), [], policy);
        // Later pages of the origin don't probe again.
        await page.goto(site.origin + "/a");
        site.hits.length = 0;
        await page.focus("#explicit");
        await page.waitForTimeout(200);
        assert.deepEqual(documentsOf(site.hits), [], policy);
      } else assert.deepEqual(docs, ["/a undefined", "/a prefetch", "/c prefetch", "/b prefetch"], policy);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser.close();
    site.close();
  }
});
