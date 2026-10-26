// Public navigation API end to end: a production build of fixture-nav-api (resumed pages) served by
// the node adapter and driven in Chromium. navigate() push / replace / state / cancel / cross-origin,
// a navigate() before the router listens (cold resumed page), invalidate() (fresh loaders, same
// scroll and entry), prefetch staleness after a submit, useParams() / useSearchParams() / setSearchParams().
import { test } from "vitest";
import { steps } from "@rivetjs/testing/steps";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { chromium, type Page } from "playwright";
import { start } from "../adapters/node.ts";
import { generate } from "../build/codegen.ts";
import { routeTable } from "../build/routes.ts";
import { routerUsage } from "../build/vite.ts";

const root = new URL("./fixture-nav-api/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";

test("codegen: the App serves navigate() requests; routes provide params; the server provides search params when used", () => {
  const table = routeTable(["index.tsx", "items/[id].tsx"]);
  const files = generate(table, { routesDir: "src/routes", searchParams: true, navigate: true, params: true }).files;
  const app = files["app.tsx"]!;
  assert.match(app, /clientEvent\(document, "rivet:go", \(\) => _serve\(router\), \{ preload: "intent", standalone: false \}\);/);
  assert.match(app, /prefetchModule\(url, modules\);\n {4}prefetchData\(url, "server"/);
  assert.match(app, /<Provider token=\{RouteParamsContext\} value=\{signal\(match\.params\)\}>/);
  assert.match(files["entry.server.tsx"]!, /<Provider token=\{SearchParams\} value=\{signal\(input\.url\.searchParams\)\}>/);
  // Server apps with layouts hand invalidate(key) their layout state; the entry passes depends() keys on.
  const nested = generate(routeTable(["_layout.tsx", "_layout.server.ts", "index.tsx"]), { routesDir: "src/routes", navigate: true }).files;
  assert.match(nested["app.tsx"]!, /clientEvent\(document, "rivet:go", \(\) => _serve\(router, nest, NEST\), \{ preload: "intent", standalone: false \}\);/);
  assert.match(nested["entry.server.tsx"]!, /\.\.\.\(input\.deps \? \{ deps: input\.deps \} : \{\}\)/);
  assert.match(nested["dev-mount.tsx"]!, /\.\.\.\(body\.deps \? \{ deps: body\.deps \} : \{\}\)/);
  const statics = generate(routeTable(["_layout.tsx", "_layout.server.ts", "index.tsx"]), { routesDir: "src/routes", mode: "static", navigate: true }).files;
  // The router's listeners never set the App's client trigger (`standalone: false`, TOAST-ACTIVE): `clientRouter: true`
  // keeps the page resumable through the App's record (no `_rWeak`), not through the listeners.
  assert.match(statics["app.tsx"]!, /_serve\(router\), \{ preload: "intent", standalone: false \}\);/);
  const routed = generate(table, { routesDir: "src/routes", navigate: true, clientRouter: true }).files["app.tsx"]!;
  assert.match(routed, /clientEvent\(document, "rivet:go", \(\) => _serve\(router\), \{ preload: "intent", standalone: false \}\);/);
  assert.doesNotMatch(routed, /_rWeak/);
  // Without navigate() use: no listener, but the server entry still passes depends() keys on.
  const nestedLean = generate(routeTable(["_layout.tsx", "_layout.server.ts", "index.tsx"]), { routesDir: "src/routes" }).files;
  assert.doesNotMatch(nestedLean["app.tsx"]!, /rivet:go|_serve|data-rivet-go/);
  assert.match(nestedLean["entry.server.tsx"]!, /\.\.\.\(input\.deps \? \{ deps: input\.deps \} : \{\}\)/);
  assert.match(app, /<div data-rivet-routes="" data-rivet-go="">/);
  // Unused (the default): no provider, no search module, no resume entry, no rivet:go listener or
  // marker, no params context.
  const lean = generate(table, { routesDir: "src/routes" }).files;
  assert.doesNotMatch(lean["entry.server.tsx"]!, /SearchParams|search/);
  assert.doesNotMatch(lean["app.tsx"]!, /rivet:go|_serve|data-rivet-go|RouteParamsContext|signal|_markActive|onNavigate/);
  // `<Link active>` used: the App re-marks active links after each navigation, armed by the first one (Z1).
  const activeApp = generate(table, { routesDir: "src/routes", activeLinks: true, navigate: true }).files["app.tsx"]!;
  assert.match(activeApp, /const arm = \(\) => _arm\(router, \(\) => onNavigate\(\(\) => _markActive\)\);/);
  assert.match(activeApp, /clientEvent\(document, "rivet:go", \(\) => \(arm\(\), _serve\(router\)\), \{ preload: "intent", standalone: false \}\);/);
  assert.doesNotMatch(activeApp, /clientEffect/);
  assert.match(lean["app.tsx"]!, /<div data-rivet-routes="">/);
});

test("routerUsage: features named in sources importing the router (or forms), linked packages included", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rivet-usage-"));
  const none = { searchParams: false, navigate: false, forms: false, params: false, activeLinks: false, prefetch: false };
  try {
    await mkdir(join(dir, "app/src/routes"), { recursive: true });
    await mkdir(join(dir, "app/node_modules/published"), { recursive: true });
    await mkdir(join(dir, "ui"), { recursive: true });
    const app = join(dir, "app");
    await writeFile(join(app, "src/routes/index.tsx"), 'import { Link } from "@rivetjs/router/link";\nconst q = new URLSearchParams("a=1");\n');
    // Published dependencies and build output are not scanned (`rivetRouter({ navigate: true })`…).
    await writeFile(join(app, "node_modules/published/x.ts"), 'import { navigate, useParams, useSearchParams } from "@rivetjs/router/client";\n');
    await writeFile(join(app, "package.json"), JSON.stringify({ dependencies: { published: "1", ui: "*" } }));
    assert.deepEqual(await routerUsage(app), none);
    // Names outside a router-importing file do not count.
    await writeFile(join(app, "src/other.ts"), "export const navigate = () => {}; export const useParams = 1;\n");
    assert.deepEqual(await routerUsage(app), none);
    await writeFile(join(app, "src/q.tsx"), 'import { useSearchParams } from "@rivetjs/router/client";\n');
    assert.deepEqual(await routerUsage(app), { ...none, searchParams: true });
    // A linked (workspace) package hoisted above the app: its sources count.
    await mkdir(join(dir, "node_modules"), { recursive: true });
    await writeFile(join(dir, "ui/menu.tsx"), 'import { navigate } from "@rivetjs/router/client";\n');
    await symlink(join(dir, "ui"), join(dir, "node_modules/ui"));
    assert.deepEqual(await routerUsage(app), { ...none, searchParams: true, navigate: true });
    await writeFile(join(app, "src/p.tsx"), 'import { useParams } from "@rivetjs/router/client";\n');
    assert.equal((await routerUsage(app)).params, true);
    assert.equal((await routerUsage(app)).activeLinks, false);
    await writeFile(
      join(app, "src/nav.tsx"),
      'import { Link } from "@rivetjs/router/link";\nexport const N = () => <Link to="/"\n  active="prefix">x</Link>;\n',
    );
    assert.equal((await routerUsage(app)).activeLinks, true);
    // @rivetjs/forms navigates (enhanced submits, redirects).
    await rm(join(dir, "node_modules/ui"));
    assert.equal((await routerUsage(app)).navigate, false);
    await writeFile(join(app, "src/form.tsx"), 'import { enhance } from "@rivetjs/forms/enhance";\n');
    assert.deepEqual(await routerUsage(app).then(({ navigate, forms }) => ({ navigate, forms })), { navigate: true, forms: true });
    // ui's Form is built on forms: an app using only it is a forms app too.
    await writeFile(join(app, "src/form.tsx"), 'import { Form, TextField } from "@rivetjs/ui";\nexport const F = () => <Form />;\n');
    assert.deepEqual(await routerUsage(app).then(({ navigate, forms }) => ({ navigate, forms })), { navigate: true, forms: true });
    await writeFile(join(app, "src/form.tsx"), 'import { Button } from "@rivetjs/ui";\n');
    assert.equal((await routerUsage(app)).forms, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test(
  "navigation API: navigate, invalidate, prefetch staleness, params and search params",
  steps(async (t) => {
    await rm(root + "dist", { recursive: true, force: true });
    await build({ root, configFile, logLevel: "silent" });
    await build({ root, configFile, logLevel: "silent", build: { ssr: true } });
    const app = await start({ dist: root + "dist", port: 0, onError: () => {} });
    const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
      const errors: string[] = [],
        documents: string[] = [],
        data: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (request.resourceType() === "document") documents.push(url.pathname + url.search);
        if (url.searchParams.get("_rivet") === "data") data.push(url.pathname + url.search.replace(/[?&]_rivet=data/, ""));
      });
      const ready = async (on: Page = page) => {
        // Z1: a resumed router app boots nothing at idle; a press on a link starts the runtime + router (intent).
        await on.dispatchEvent("a[href^='/']", "pointerdown");
        await on.waitForFunction(() => typeof (document as unknown as { $rdp?: unknown }).$rdp === "function");
        await on.evaluate(() => new Promise((done) => requestIdleCallback(() => setTimeout(done, 50))));
      };
      // Clicks through the DOM: Playwright's own click would scroll the target into view first.
      const click = (selector: string, on: Page = page) => on.evaluate((s) => document.querySelector<HTMLElement>(s)!.click(), selector);
      const text = (selector: string) => page.textContent(selector);
      const heading = (value: string, on: Page = page) => on.waitForFunction((value) => document.querySelector("h1")?.textContent === value, value);
      const done = () => page.evaluate(() => document.documentElement.dataset.done ?? null);
      const length = () => page.evaluate(() => history.length);
      const reset = () => page.evaluate(() => delete document.documentElement.dataset.done);

      await page.goto(app.url + "/?q=start");
      await ready();

      await t.test("the app reads search params: the client build carries the search module", async () => {
        const assets = await readdir(root + "dist/client/assets");
        const sources = await Promise.all(assets.filter((f) => f.endsWith(".js")).map((f) => readFile(root + "dist/client/assets/" + f, "utf8")));
        // `search.ts` installs the commit sync (`_searchSync.search = () => …`): minified, the property assignment stays.
        assert.ok(sources.some((source) => /\.search=\(\)=>/.test(source)));
      });

      await t.test("type-only imports from a .server.ts module build; nothing of it reaches the client", async () => {
        // routes/about.tsx: `import type { Secret }` and `import { type Other }` from ../shared.server.ts.
        for (const file of await readdir(root + "dist/client/assets"))
          assert.ok(!(await readFile(root + "dist/client/assets/" + file, "utf8")).includes("nav-api-server-secret"), file);
      });

      await t.test("server render: root layout search params and params", async () => {
        assert.equal(await text("#root-q"), "start");
        assert.equal(await text("#root-params"), "{}");
      });

      await t.test("rivet:navigate cancels a navigate(); the promise resolves, the page stays", async () => {
        await page.evaluate(() => document.addEventListener("rivet:navigate", (event) => event.preventDefault(), { once: true }));
        const before = await length();
        await click("#go-item");
        await page.waitForFunction(() => document.documentElement.dataset.done === "item");
        assert.equal(new URL(page.url()).pathname, "/");
        assert.equal(await length(), before);
        assert.equal(await text("h1"), "Home");
      });

      await t.test("beforeLeave cancels a navigate(); the promise resolves, the page stays", async () => {
        await reset();
        await click("#guard-once");
        const before = await length();
        await click("#go-item");
        await page.waitForFunction(() => document.documentElement.dataset.done === "item");
        assert.equal(await page.evaluate(() => document.documentElement.dataset.left), "link /items/7");
        assert.equal(new URL(page.url()).pathname, "/");
        assert.equal(await length(), before);
        assert.equal(await text("h1"), "Home");
      });

      await t.test("navigate(): push with state, resolves on commit; params and search params follow", async () => {
        await reset();
        const before = await length();
        const seen = page.evaluate(
          () =>
            new Promise<string>((resolve) =>
              document.addEventListener("rivet:navigate", (event) => resolve((event as CustomEvent).detail.trigger), { once: true }),
            ),
        );
        await click("#go-item");
        await heading("Item 7");
        assert.equal(await seen, "api");
        await page.waitForFunction(() => document.documentElement.dataset.done === "item");
        assert.equal(await length(), before + 1);
        const state = (await page.evaluate(() => history.state)) as Record<string, unknown>;
        assert.equal(state.from, "home");
        assert.equal(typeof state.i, "number");
        assert.equal(await text("#id"), "7");
        assert.equal(await text("#q"), "x");
        assert.equal(await text("#root-q"), "x", "resumed root layout binding follows the commit");
        await page.waitForFunction(() => document.activeElement?.tagName === "H1");
      });

      await t.test("useParams(): the next page's params; useSearchParams() follows a search change", async () => {
        await click("#next");
        await heading("Item 8");
        assert.equal(await text("#id"), "8");
        assert.equal(await text("#q"), "-");
        assert.equal(await text("#root-q"), "-");
        await reset();
        const before = await length();
        await page.evaluate(() => scrollTo(0, 0));
        await page.focus("#set-q");
        await click("#set-q");
        await page.waitForURL(/\/items\/8\?q=y$/);
        await page.waitForFunction(() => document.documentElement.dataset.done === "q");
        assert.equal(await text("#q"), "y");
        assert.equal(await text("#root-q"), "y");
        assert.equal(await length(), before + 1);
        // Back: the previous search params again.
        await page.goBack();
        await page.waitForURL(/\/items\/8$/);
        await page.waitForFunction(() => document.querySelector("#root-q")?.textContent === "-");
        assert.equal(await text("#q"), "-");
      });

      await t.test("navigate({ replace: true }) replaces the entry", async () => {
        await click('nav a[href="/"]');
        await heading("Home");
        const before = await length();
        await click("#go-replace");
        await heading("About");
        assert.equal(await length(), before);
        await page.goBack();
        await page.waitForURL(/\/items\/8$/);
        await heading("Item 8");
        await click('nav a[href="/"]');
        await heading("Home");
      });

      await t.test("invalidate(): reruns the loader, same entry, scroll and URL kept", async () => {
        await reset();
        const loads = Number(await text("#loads"));
        const fetched = data.length;
        const before = await length();
        await page.evaluate(() => scrollTo(0, 1500));
        await page.waitForFunction(() => Math.abs(scrollY - 1500) < 2);
        await click("#invalidate");
        await page.waitForFunction((n) => document.querySelector("#loads")?.textContent === String(n), loads + 1);
        await page.waitForFunction(() => document.documentElement.dataset.done === "fresh");
        assert.deepEqual(data.slice(fetched), ["/"]);
        assert.equal(await length(), before);
        assert.equal(new URL(page.url()).pathname, "/");
        assert.ok(Math.abs((await page.evaluate(() => scrollY)) - 1500) < 2, "scroll kept");
        await page.evaluate(() => scrollTo(0, 0));
      });

      await t.test("hover → submit → click: no stale prefetched data", async () => {
        assert.equal(await text("h1"), "Home");
        const fetched = data.length;
        await page.hover('nav a[href="/counter"]');
        for (let i = 0; i < 100 && data.length === fetched; i++) await page.waitForTimeout(20);
        assert.deepEqual(data.slice(fetched), ["/counter"]);
        await page.click("#inc-submit");
        await page.waitForFunction(() => document.querySelector("#posted")?.textContent === "posted");
        await click('nav a[href="/counter"]');
        await heading("Counter");
        assert.equal(await text("#count"), "1", "data from after the submit");
        assert.deepEqual(data.slice(fetched), ["/counter", "/counter"]);
      });

      await t.test("intent prefetch: unmatched URLs fetch no data", async () => {
        await click('nav a[href="/"]');
        await heading("Home");
        const fetched = data.length;
        await page.hover("#nowhere");
        await page.focus("#nowhere");
        await page.waitForTimeout(300);
        assert.deepEqual(data.slice(fetched), []);
        // A matched link still warms its data.
        await page.hover('nav a[href="/about"]');
        for (let i = 0; i < 100 && data.length === fetched; i++) await page.waitForTimeout(20);
        assert.deepEqual(data.slice(fetched), ["/about"]);
      });

      await t.test("beforeLeave guards back/forward: cancel restores URL and content, the router never moves", async () => {
        await click('nav a[href="/"]');
        await heading("Home");
        type Probe = { __pops: number; __mutations: number; __unguard(): void };
        // Every popstate, and every DOM change under the routes region (none while a guard cancels).
        await page.evaluate(() => {
          const w = window as unknown as Probe;
          w.__pops = w.__mutations = 0;
          addEventListener("popstate", () => w.__pops++);
          new MutationObserver((list) => (w.__mutations += list.length)).observe(document.querySelector("main")!, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
          });
        });
        await click("#guard-history");
        await click('nav a[href="/about"]');
        await heading("About");
        const left = () => page.evaluate(() => document.documentElement.dataset.left);
        const probe = () => page.evaluate(() => [(window as unknown as Probe).__pops, (window as unknown as Probe).__mutations]);
        const pops = (n: number) => page.waitForFunction((n) => (window as unknown as Probe).__pops === n, n);
        assert.equal(await left(), "link / /about", "link leaves still reach the guard");
        const entry = await page.evaluate(() => (history.state as { i: number }).i);
        const fetched = data.length;
        await page.evaluate(() => ((window as unknown as Probe).__mutations = 0));

        // Cancelled back: the guard walks history forward again; neither popstate moves the router.
        await page.evaluate(() => history.back());
        await pops(2);
        await page.waitForTimeout(100);
        assert.equal(await left(), "history /about /");
        assert.equal(new URL(page.url()).pathname, "/about");
        assert.equal(await page.evaluate(() => (history.state as { i: number }).i), entry);
        assert.equal(await text("h1"), "About");
        assert.deepEqual(await probe(), [2, 0], "routes region untouched");
        assert.equal(data.length, fetched, "no data request");

        // Allowed back works.
        await page.evaluate(() => (document.documentElement.dataset.allow = ""));
        await page.evaluate(() => history.back());
        await heading("Home");
        assert.equal(new URL(page.url()).pathname, "/");

        // Forward is guarded too.
        await page.evaluate(() => delete document.documentElement.dataset.allow);
        await page.evaluate(() => ((window as unknown as Probe).__mutations = 0));
        await page.evaluate(() => history.forward());
        await pops(5);
        await page.waitForTimeout(100);
        assert.equal(await left(), "history / /about");
        assert.equal(new URL(page.url()).pathname, "/");
        assert.equal(await text("h1"), "Home");
        assert.deepEqual(await probe(), [5, 0]);

        // Unregistered: the guard leaves no listener behind (popstate never had one; beforeunload removed).
        const listeners = async () => {
          const cdp = await page.context().newCDPSession(page);
          const { result } = await cdp.send("Runtime.evaluate", { expression: "window" });
          const { listeners } = await cdp.send("DOMDebugger.getEventListeners", { objectId: result.objectId! });
          await cdp.detach();
          return listeners
            .filter((l) => l.type === "popstate" || l.type === "beforeunload")
            .map((l) => l.type)
            .sort();
        };
        const guarded = await listeners();
        assert.ok(guarded.includes("beforeunload"));
        await page.evaluate(() => (window as unknown as Probe).__unguard());
        const after = await listeners();
        assert.deepEqual(
          after,
          guarded.filter((type) => type !== "beforeunload"),
        );
        await page.evaluate(() => history.forward());
        await heading("About");
        await click('nav a[href="/"]');
        await heading("Home");
      });

      await t.test("no document loads, no errors", async () => {
        assert.deepEqual(documents, ["/?q=start"]);
        assert.deepEqual(errors, []);
      });

      await t.test("navigate() to another origin loads the document", async () => {
        await page.route("https://example.invalid/**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Elsewhere</h1>" }));
        await click('nav a[href="/"]');
        await heading("Home");
        await click("#go-out");
        await page.waitForURL("https://example.invalid/");
        assert.equal(await page.textContent("h1"), "Elsewhere");
      });

      // Derived model gap (plan M6): `navigate()` before the router's boundary adopted (an independent boundary's handler on a
      // cold page) finds no `rivet:go` listener and loads the document; the loader has no hook to adopt the App first yet.
      await t.test(
        "cold resumed page: navigate() before the router listens waits for it (no document load)",
        { skip: "plan M6: no cold App adopt for navigate()" },
        async () => {
          const cold = await browser.newPage();
          const loads: string[] = [];
          cold.on("request", (request) => request.resourceType() === "document" && loads.push(new URL(request.url()).pathname));
          cold.on("pageerror", (error) => errors.push(error.message));
          // The App's `rivet:go` listener attaches at idle, or before the first delegated handler runs (the
          // resume runtime drains pending `load` listeners on dispatch), so a click's navigate() usually
          // finds it. Gate the event at the window to model a call made before the App listens: navigate()
          // asks again when the runtime announces attached listeners (`rivet:attach`, modelled by the release).
          await cold.addInitScript(() => {
            let open = false;
            addEventListener("rivet:go", (event) => open || event.stopImmediatePropagation(), { capture: true });
            (window as unknown as { __release(): void }).__release = () => ((open = true), void document.dispatchEvent(new Event("rivet:attach")));
          });
          await cold.goto(app.url + "/");
          await cold.click("#go-item");
          // Z1: a resumed router app boots nothing at idle; a press on a link starts the runtime + router (intent).
          await cold.dispatchEvent("a[href^='/']", "pointerdown");
          await cold.waitForFunction(() => typeof (document as unknown as { $rdp?: unknown }).$rdp === "function");
          await cold.waitForTimeout(300);
          assert.equal(new URL(cold.url()).pathname, "/", "waits for the router");
          await cold.evaluate(() => (window as unknown as { __release(): void }).__release());
          await heading("Item 7", cold);
          assert.equal(new URL(cold.url()).pathname, "/items/7");
          assert.deepEqual(loads, ["/"]);
          assert.deepEqual(errors, []);
          await cold.close();
        },
      );

      await t.test("no App listening (built without navigate() detected): navigate() loads the document at once", async () => {
        const bare = await browser.newPage();
        const loads: string[] = [];
        bare.on("request", (request) => request.resourceType() === "document" && loads.push(new URL(request.url()).pathname));
        // Resumed page.
        await bare.goto(app.url + "/");
        assert.equal(await bare.evaluate(() => document.querySelectorAll("[data-rivet-go]").length), 1);
        // What a build without the listener renders: no marker on the routes element, and no App
        // answering `rivet:go` (this build's App, once it boots at idle, would; under load that can be
        // before the click): the event stops at the window.
        await bare.evaluate(() => {
          document.querySelector("[data-rivet-go]")!.removeAttribute("data-rivet-go");
          addEventListener("rivet:go", (event) => event.stopImmediatePropagation(), { capture: true });
        });
        const started = Date.now();
        await bare.click("#go-item");
        await bare.waitForURL(/\/items\/7\?q=x$/);
        assert.ok(Date.now() - started < 2_000, "no retry window");
        assert.deepEqual(loads, ["/", "/items/7"]);
        await bare.close();
      });
    } finally {
      await browser.close();
      await app.close();
    }
  }),
);
