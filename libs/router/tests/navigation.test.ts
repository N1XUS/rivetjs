// Navigation accessibility and history fidelity end to end: a production build of fixture-nav
// (resumed pages, no transitions) served by the node adapter and driven in Chromium under a strict
// CSP (Trusted Types, no inline styles). Route announcer, scroll restoration, hash-only navigation,
// app history state, focus.
import { test } from "vitest";
import { steps } from "@rivetjs/testing/steps";
import assert from "node:assert/strict";
import { readdir, readFile, rm } from "node:fs/promises";
import { build } from "vite";
import { chromium, type Page } from "playwright";
import { start } from "../adapters/node.ts";
import { strictCSP } from "../server/strict-csp.ts";
import { generate } from "../build/codegen.ts";
import { routeTable } from "../build/routes.ts";

const root = new URL("./fixture-nav/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";

interface TestWindow extends Window {
  __said: string[];
  __hashes: string[];
}

/** Record every distinct text the live region shows (clear then set yields "", text). */
function instrument() {
  const w = window as unknown as TestWindow;
  w.__said = [];
  // Same-document fragment links are the browser's own navigations: `hashchange` fires (hash-driven overlays).
  w.__hashes = [];
  addEventListener("hashchange", () => w.__hashes.push(location.hash));
  document.addEventListener("securitypolicyviolation", (event) => console.error("CSP " + event.violatedDirective + " " + event.blockedURI));
  new MutationObserver(() => {
    const region = document.querySelector("[aria-live]");
    if (region && w.__said[w.__said.length - 1] !== region.textContent) w.__said.push(region.textContent!);
  }).observe(document, { subtree: true, childList: true, characterData: true });
}

test("codegen: `announce: false` swaps routes without the announcer", () => {
  const table = routeTable(["index.tsx"]);
  assert.match(generate(table, { routesDir: "src/routes" }).files["app.tsx"]!, /adopting \? apply\(\) : swapRoute\(apply, next\)/);
  const quiet = generate(table, { routesDir: "src/routes", announce: false }).files["app.tsx"]!;
  assert.match(quiet, /adopting \? apply\(\) : swapRouteQuiet\(apply, next\)/);
  assert.match(quiet, /import \{[^}]*\bswapRouteQuiet\b[^}]*\} from "@rivetjs\/router\/client"/);
});

test(
  "navigation: announcer, scroll restoration, hash-only navigation, history state, focus",
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
      page.on("console", (message) => message.text().startsWith("CSP ") && errors.push(message.text()));
      page.on("request", (request) => {
        if (request.resourceType() === "document") documents.push(new URL(request.url()).pathname);
        const url = new URL(request.url());
        if (url.searchParams.get("_rivet") === "data") data.push(url.pathname + url.search.replace(/[?&]_rivet=data/, ""));
      });
      await page.route(app.url + "/**", async (route) => {
        if (route.request().resourceType() !== "document") return route.continue();
        const response = await route.fetch();
        const policy = /'nonce-([^']+)'/.exec(response.headers()["content-security-policy"] ?? "");
        const csp = policy ? strictCSP(policy[1]!, { trustedTypes: true }) + "; style-src 'self'" : undefined;
        await route.fulfill({ response, headers: { ...response.headers(), ...(csp ? { "content-security-policy": csp } : {}) } });
      });
      await page.addInitScript(instrument);
      const ready = async () => {
        // Z1: a resumed router app boots nothing at idle; a press on a link starts the runtime + router (intent).
        await page.dispatchEvent("a[href^='/']", "pointerdown");
        await page.waitForFunction(() => typeof (document as unknown as { $rdp?: unknown }).$rdp === "function");
        await page.evaluate(() => new Promise((done) => requestIdleCallback(() => setTimeout(done, 50))));
      };
      await page.goto(app.url + "/");
      await ready();
      // Clicks through the DOM: Playwright's own click would scroll the link into view first.
      const click = (selector: string) => page.evaluate((s) => document.querySelector<HTMLElement>(s)!.click(), selector);
      const nav = (name: string) => click(`nav a[href="${name}"]`);
      const said = () => page.evaluate(() => (window as unknown as TestWindow).__said);
      const scrolled = () => page.evaluate(() => scrollY);
      const near = async (y: number) => {
        await page.waitForFunction((y) => Math.abs(scrollY - y) < 2, y);
      };
      const active = () => page.evaluate(() => (document.activeElement?.id || document.activeElement?.tagName) ?? null);
      const state = () => page.evaluate(() => history.state as Record<string, unknown> | null);
      const heading = (text: string) => page.waitForFunction((text) => document.querySelector("h1")?.textContent === text, text);

      await t.test("no search params read: the client build has no search module or router resume entry", async () => {
        for (const file of await readdir(root + "dist/client/assets"))
          if (file.endsWith(".js")) assert.ok(!/\.search=\(\)=>/.test(await readFile(root + "dist/client/assets/" + file, "utf8")), file);
        const manifest = await readFile(root + "dist/client/.vite/manifest.json", "utf8");
        assert.doesNotMatch(manifest, /entry\.resume\.ts|client\/search\.ts/);
      });

      await t.test("no navigate() / useParams(): no rivet:go listener, resume state or serving code; no params context", async () => {
        for (const file of await readdir(root + "dist/client/assets"))
          if (file.endsWith(".js")) {
            const source = await readFile(root + "dist/client/assets/" + file, "utf8");
            // navigate.ts (`rivet:go` dispatch) and perform (`trigger: "api"`) are absent.
            assert.ok(!source.includes("rivet:go") && !source.includes('"api"'), file);
          }
        const html = await (await fetch(app.url + "/")).text();
        assert.ok(!html.includes("rivet:go") && !html.includes("data-rivet-go"));
        assert.doesNotMatch(await readFile(root + ".rivet/app.tsx", "utf8"), /RouteParamsContext|_serve/);
      });

      await t.test("initial load: no live region, browser scroll restoration untouched", async () => {
        assert.equal(await page.evaluate(() => document.querySelectorAll("[aria-live]").length), 0);
        assert.equal(await page.evaluate(() => history.scrollRestoration), "auto");
      });

      await t.test("hash link on a resumed page: scrolls to and focuses the target, keeps the page", async () => {
        await page.click("#count");
        await page.waitForFunction(() => document.querySelector("#count")?.textContent === "Count 1");
        await page.evaluate(() => {
          (document.querySelector("h1") as unknown as { mark: number }).mark = 1;
          history.replaceState({ ...history.state, mine: "home" }, "");
        });
        const length = await page.evaluate(() => history.length);
        await click("#to-one");
        await page.waitForURL(/\/#one$/);
        await page.waitForFunction(() => document.activeElement?.id === "one");
        assert.ok((await scrolled()) > 2000);
        assert.equal(await page.evaluate(() => history.length), length + 1);
        // Not intercepted (alpha.1 report: hash overlays broke): `hashchange` fired, `:target` matches.
        await page.waitForFunction(() => (window as unknown as TestWindow).__hashes.join() === "#one");
        assert.equal(await page.evaluate(() => document.querySelector(":target")?.id), "one");
        // Same page instance, same state, no route data fetched, nothing announced.
        assert.equal(await page.textContent("#count"), "Count 1");
        assert.equal(await page.evaluate(() => (document.querySelector("h1") as unknown as { mark?: number }).mark), 1);
        assert.deepEqual(data, []);
        assert.deepEqual(await said(), []);
        assert.equal(await page.evaluate(() => history.scrollRestoration), "manual");
      });

      await t.test("back/forward across hash entries restore positions without route work", async () => {
        const far = await scrolled();
        await page.goBack();
        await page.waitForURL(app.url + "/");
        await near(0);
        assert.equal((await state())?.mine, "home");
        await page.waitForFunction(() => (window as unknown as TestWindow).__hashes.join() === "#one,");
        await page.goForward();
        await page.waitForURL(/\/#one$/);
        await near(far);
        assert.equal(await page.textContent("#count"), "Count 1");
        assert.equal(await page.evaluate(() => (document.querySelector("h1") as unknown as { mark?: number }).mark), 1);
        assert.deepEqual(data, []);
      });

      await t.test("same-URL hash link scrolls again without a new entry; dropping the hash goes to the top", async () => {
        await page.evaluate(() => scrollTo(0, 0));
        await near(0);
        const length = await page.evaluate(() => history.length);
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await click("#again-one");
        await page.waitForFunction(() => document.activeElement?.id === "one" && scrollY > 2000);
        assert.equal(await page.evaluate(() => history.length), length);
        await click("#no-hash");
        await page.waitForURL(app.url + "/");
        await near(0);
        assert.equal(await page.evaluate(() => history.length), length + 1);
        assert.equal(await page.textContent("#count"), "Count 1");
        assert.deepEqual(data, []);
      });

      await t.test("an empty fragment link (`#`, overlay close) is the browser's too: hashchange, top, no route work", async () => {
        const length = await page.evaluate(() => history.length);
        await page.evaluate(() => ((window as unknown as TestWindow).__hashes = []));
        await click("#to-one");
        await page.waitForURL(/\/#one$/);
        await click("#close");
        await page.waitForURL(/\/#$/);
        await near(0);
        await page.waitForFunction(() => (window as unknown as TestWindow).__hashes.join() === "#one,");
        assert.equal(await page.evaluate(() => document.querySelector(":target")), null);
        assert.equal(await page.evaluate(() => history.length), length + 2);
        assert.equal(await page.textContent("#count"), "Count 1");
        assert.deepEqual(data, []);
      });

      await t.test("route navigation announces title, else h1, else pathname; focus target, h1, main", async () => {
        await nav("/bare");
        await heading("Bare page");
        await page.waitForFunction(() => document.activeElement?.tagName === "H1");
        await page.waitForFunction(() => (window as unknown as TestWindow).__said.at(-1) === "Bare page");
        const region = await page.evaluate(() => {
          const all = document.querySelectorAll("[aria-live]");
          const el = all[0] as HTMLElement;
          const style = getComputedStyle(el);
          return {
            count: all.length,
            live: el.getAttribute("aria-live"),
            atomic: el.getAttribute("aria-atomic"),
            position: style.position,
            width: el.offsetWidth,
            height: el.offsetHeight,
          };
        });
        assert.deepEqual(region, { count: 1, live: "assertive", atomic: "true", position: "absolute", width: 1, height: 1 });

        await nav("/empty");
        await page.waitForSelector("#empty");
        await page.waitForFunction(() => document.activeElement?.tagName === "MAIN");
        await page.waitForFunction(() => (window as unknown as TestWindow).__said.at(-1) === "/empty");

        await nav("/long#far");
        await heading("Long");
        await page.waitForFunction(() => document.activeElement?.id === "far");
        assert.ok((await scrolled()) > 2000);
        await page.waitForFunction(() => (window as unknown as TestWindow).__said.at(-1) === "Long");
        assert.equal(await page.title(), "Long");
      });

      await t.test("hash-only changes on a client-rendered page keep its loader data", async () => {
        const loads = await page.textContent("#loads");
        const fetched = data.length;
        await page.evaluate(() => scrollTo(0, 0));
        await click("#to-far");
        await page.waitForFunction(() => scrollY > 2000 && document.activeElement?.id === "far");
        await click("#drop-hash");
        await page.waitForURL(app.url + "/long");
        await near(0);
        await page.goBack();
        await page.waitForURL(/\/long#far$/);
        await page.waitForFunction(() => scrollY > 2000);
        await page.goForward();
        await page.waitForURL(app.url + "/long");
        await near(0);
        assert.equal(await page.textContent("#loads"), loads);
        assert.equal(data.length, fetched);
      });

      await t.test("same text twice in a row is announced again (cleared, then set)", async () => {
        const before = (await said()).length;
        await nav("/long?again=1");
        await page.waitForURL(/\/long\?again=1$/);
        await page.waitForFunction((n) => (window as unknown as TestWindow).__said.length >= n + 2, before);
        assert.deepEqual((await said()).slice(before), ["", "Long"]);
        assert.deepEqual(await said(), ["", "Bare page", "", "/empty", "", "Long", "", "Long"]);
      });

      await t.test("scroll is saved before every navigation: back restores, forward after back restores", async () => {
        await page.evaluate(() => scrollTo(0, 2500));
        await near(2500);
        await nav("/bare");
        await heading("Bare page");
        await near(0);
        await page.evaluate(() => scrollTo(0, 1200));
        await near(1200);
        await page.goBack();
        await heading("Long");
        await near(2500);
        await page.goForward();
        await heading("Bare page");
        await near(1200);
      });

      await t.test("app history state survives navigation bookkeeping and back/forward", async () => {
        await page.evaluate(() => history.replaceState({ ...history.state, mine: 1 }, ""));
        await nav("/empty");
        await page.waitForSelector("#empty");
        await page.evaluate(() => history.replaceState({ ...history.state, mine: 2 }, ""));
        await page.goBack();
        await heading("Bare page");
        assert.equal((await state())?.mine, 1);
        await page.goForward();
        await page.waitForSelector("#empty");
        assert.equal((await state())?.mine, 2);
        await page.goBack();
        await heading("Bare page");
        assert.equal((await state())?.mine, 1);
        await near(1200);
      });

      await t.test("no document loads, no errors, no CSP violations", async () => {
        assert.deepEqual(documents, ["/"]);
        assert.deepEqual(errors, []);
      });

      await t.test("reload: the browser restores the position (scroll restoration back to auto on unload)", async () => {
        await page.reload();
        await ready();
        await heading("Bare page");
        await near(1200);
        assert.equal(await page.evaluate(() => history.scrollRestoration), "auto");
        assert.deepEqual(errors, []);
      });
    } finally {
      await browser.close();
      await app.close();
    }
  }),
);
