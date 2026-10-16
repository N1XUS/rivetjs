// Route transitions + pending UI end to end: a production build of fixture-transitions (resumed
// pages, `rivetRouter({ transitions })`) served by the node adapter and driven in Chromium.
import { test } from "vitest";
import { steps } from "@rivetjs/testing/steps";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { build } from "vite";
import { chromium, type Browser, type BrowserContextOptions, type Page } from "playwright";
import { start } from "../adapters/node.ts";
import { strictCSP } from "../server/strict-csp.ts";

const root = new URL("./fixture-transitions/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";

interface Recorded {
  types: string[] | null;
  names: string[];
  page: string;
  attr: string | null;
}
interface TestWindow extends Window {
  __vt: Recorded[];
  __events: string[];
  __blank?: boolean;
}

/** Record view transitions (types, names at snapshot time) and router events; report CSP violations. */
function instrument(options: { noViewTransitions?: boolean } = {}) {
  const w = window as unknown as TestWindow;
  w.__vt = [];
  w.__events = [];
  document.addEventListener("securitypolicyviolation", (event) => console.error("CSP " + event.violatedDirective + " " + event.blockedURI));
  for (const type of ["rivet:navigate", "rivet:before-swap", "rivet:after-swap", "rivet:navigated"])
    document.addEventListener(type, () => w.__events.push(type));
  const proto = Document.prototype as unknown as { startViewTransition?: (arg: unknown) => unknown };
  if (options.noViewTransitions) {
    delete proto.startViewTransition;
    return;
  }
  const original = proto.startViewTransition!;
  proto.startViewTransition = function (this: Document, arg: unknown) {
    w.__vt.push({
      types: typeof arg === "function" ? null : [...(arg as { types: string[] }).types],
      names: [...document.querySelectorAll<HTMLElement>("[data-vt-name]")].map((e) => e.getAttribute("data-vt-name") + "=" + e.style.viewTransitionName),
      page: document.querySelector<HTMLElement>("[data-rivet-routes]")!.style.viewTransitionName,
      attr: document.documentElement.getAttribute("data-rivet-transition"),
    });
    return original.call(this, arg);
  };
}

async function open(browser: Browser, url: string, context: BrowserContextOptions = {}, options: { noViewTransitions?: boolean } = {}) {
  const ctx = await browser.newContext(context);
  const page = await ctx.newPage();
  const errors: string[] = [],
    scripts: string[] = [],
    documents: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.text().startsWith("CSP ") && errors.push(message.text()));
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    if (request.resourceType() === "document") documents.push(new URL(request.url()).pathname);
  });
  // Stricter than the default policy: Trusted Types enforced and no inline styles at all.
  await page.route(url + "/**", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    const policy = /'nonce-([^']+)'/.exec(response.headers()["content-security-policy"] ?? "");
    const csp = policy ? strictCSP(policy[1]!, { trustedTypes: true }) + "; style-src 'self'" : undefined;
    await route.fulfill({ response, headers: { ...response.headers(), ...(csp ? { "content-security-policy": csp } : {}) } });
  });
  await page.addInitScript(instrument, options);
  await page.goto(url + "/");
  // Resumed runtime started and its idle listeners attached.
  // Z1: a resumed router app boots nothing at idle; a press on a link starts the runtime + router (intent).
  await page.dispatchEvent("a[href^='/']", "pointerdown");
  await page.waitForFunction(() => (document as unknown as { $r?: { r(): unknown } }).$r?.r());
  await page.evaluate(() => new Promise((done) => requestIdleCallback(() => setTimeout(done, 50))));
  return { page, errors, scripts, documents, close: () => ctx.close() };
}
const settled = (page: Page) => page.waitForFunction(() => !document.documentElement.hasAttribute("data-rivet-transition"));
const recorded = (page: Page) => page.evaluate(() => (window as unknown as TestWindow).__vt);

test(
  "transitions: view transitions, shared elements, pending UI, Link, strict CSP",
  steps(async (t) => {
    await rm(root + "dist", { recursive: true, force: true });
    await build({ root, configFile, logLevel: "silent" });
    await build({ root, configFile, logLevel: "silent", build: { ssr: true } });
    const app = await start({ dist: root + "dist", port: 0, onError: () => {} });
    const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
    try {
      await t.test("<Link> renders a plain anchor with its data attributes", async () => {
        const html = await (await fetch(app.url + "/")).text();
        assert.match(html, /<a href="\/items\/1" data-transition="zoom" data-rivet-pending-class="is-pending">First<\/a>/);
        assert.match(html, /<a href="\/plain" data-rivet-prefetch="none">Plain<\/a>/);
        assert.match(html, /<a href="\/">Home<\/a>/);
      });

      const { page, errors, scripts, documents, close } = await open(browser, app.url);
      const host = page.locator("[data-rivet-routes]");
      const nav = (name: string) => page.locator("nav").getByRole("link", { name, exact: true });

      await t.test("first navigation: one view transition with link types and the shared element", async () => {
        assert.ok(!scripts.some((path) => /\/transitions-/.test(path)), "no transitions chunk before intent: " + scripts.join());
        // The server view stays until the new route commits (never a blank region).
        await page.evaluate(() => {
          const w = window as unknown as TestWindow;
          const routes = document.querySelector("[data-rivet-routes]")!;
          new MutationObserver(() => {
            if (!routes.querySelector("h1")) w.__blank = true;
          }).observe(routes, { childList: true, subtree: true });
        });
        await page.getByRole("link", { name: "First item" }).hover();
        for (let i = 0; i < 100 && !scripts.some((path) => /\/transitions-/.test(path)); i++) await page.waitForTimeout(20);
        assert.ok(
          scripts.some((path) => /\/transitions-/.test(path)),
          "intent loads the transitions chunk",
        );
        await page.getByRole("link", { name: "First item" }).click();
        await page.waitForSelector("#item");
        await settled(page);
        assert.equal(await page.title(), "First item");
        assert.deepEqual(await recorded(page), [{ types: ["push", "zoom"], names: ["item-1=item-1", "item-2="], page: "rivet-page", attr: "push zoom" }]);
        // Names exist only during the transition.
        assert.equal(await page.locator(".hero").evaluate((e) => (e as HTMLElement).style.viewTransitionName), "");
        assert.equal(await host.evaluate((e) => (e as HTMLElement).style.viewTransitionName), "");
        assert.equal(await page.evaluate(() => (window as unknown as TestWindow).__blank), undefined);
        await page.waitForFunction(() => document.activeElement?.textContent === "First item");
      });

      await t.test("back: direction type, route types skipped for the link-less traversal", async () => {
        await page.goBack();
        await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Home");
        await settled(page);
        assert.deepEqual((await recorded(page))[1]!.types, ["back"]);
        await page.goForward();
        await page.waitForSelector("#item");
        await settled(page);
        // The route's own `transition` export applies without a link override.
        assert.deepEqual((await recorded(page))[2]!.types, ["forward", "detail"]);
      });

      await t.test('data-transition="none" and route `transition = false` swap instantly, events still fire', async () => {
        await nav("Home").click();
        await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Home");
        await settled(page);
        const count = (await recorded(page)).length;
        await page.evaluate(() => ((window as unknown as TestWindow).__events = []));
        await nav("Instant").click();
        await page.waitForSelector("#item");
        await nav("Plain").click();
        await page.waitForSelector("#plain");
        assert.equal((await recorded(page)).length, count);
        assert.deepEqual(await page.evaluate(() => (window as unknown as TestWindow).__events), [
          ...["rivet:navigate", "rivet:before-swap", "rivet:after-swap", "rivet:navigated"],
          ...["rivet:navigate", "rivet:before-swap", "rivet:after-swap", "rivet:navigated"],
        ]);
      });

      await t.test("redirect during client navigation replaces the entry and commits the target once", async () => {
        await nav("Home").click();
        await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Home");
        await nav("Guarded").click();
        await page.waitForURL(/\/plain$/);
        await page.waitForSelector("#plain");
        await page.goBack();
        await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Home");
        await settled(page);
      });

      await t.test("pending: aria-busy and link attribute at once, indicator after delay, old page live", async () => {
        // `<Link pending>` classes and the link attribute apply synchronously on click.
        const classes = await page.evaluate(() => {
          const link = [...document.querySelectorAll("nav a")].find((a) => a.textContent === "First") as HTMLAnchorElement;
          link.click();
          return [link.className, link.hasAttribute("data-rivet-pending")];
        });
        assert.deepEqual(classes, ["is-pending", true]);
        await page.waitForSelector("#item");
        await settled(page);
        assert.equal(await nav("First").getAttribute("class"), "");
        assert.equal(await nav("First").getAttribute("data-rivet-pending"), null);
        await nav("Home").click();
        await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Home");
        await settled(page);

        await nav("Slow").click();
        assert.equal(await host.getAttribute("aria-busy"), "true");
        assert.equal(await nav("Slow").getAttribute("data-rivet-pending"), "");
        // useNavigation() in the resumed root layout updates in place.
        await page.waitForFunction(() => document.querySelector("#nav-state")?.textContent?.startsWith("loading"));
        // The old page stays mounted and live while the next one loads.
        await page.locator("#home-count").click();
        assert.equal(await page.textContent("#home-count"), "Home count 1");
        await page.waitForFunction(() => document.documentElement.hasAttribute("data-rivet-pending"));
        assert.equal(await page.textContent("#nav-state"), "loading shown");
        await page.waitForSelector("#item");
        assert.equal(await page.textContent("h1"), "Second item");
        assert.equal(await host.getAttribute("aria-busy"), null);
        await page.waitForFunction(() => !document.documentElement.hasAttribute("data-rivet-pending"));
        await page.waitForFunction(() => document.querySelector("#nav-state")?.textContent === "idle");
        // A fast navigation (below the delay) never shows the indicator.
        await page.evaluate(() => {
          const w = window as unknown as TestWindow & { __shown?: boolean };
          new MutationObserver(() => {
            if (document.documentElement.hasAttribute("data-rivet-pending")) w.__shown = true;
          }).observe(document.documentElement, { attributes: true });
        });
        await nav("Home").click();
        await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Home");
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => (window as unknown as { __shown?: boolean }).__shown), undefined);
      });

      await t.test("rapid navigation: a newer click supersedes a pending one; the last URL wins", async () => {
        const before = (await recorded(page)).length;
        await nav("Slow").click();
        await page.waitForFunction(() => document.querySelector("#nav-state")?.textContent?.startsWith("loading"));
        await nav("Plain").click();
        await page.waitForSelector("#plain");
        // The slow response arrives later and is discarded.
        await page.waitForTimeout(800);
        assert.equal(new URL(page.url()).pathname, "/plain");
        assert.equal(await page.textContent("h1"), "Plain");
        assert.equal(await host.getAttribute("aria-busy"), null);
        assert.equal(await nav("Slow").getAttribute("data-rivet-pending"), null);
        await page.waitForFunction(() => document.querySelector("#nav-state")?.textContent === "idle");
        // `/plain` opts out of animation; the superseded navigation never animated.
        assert.equal((await recorded(page)).length, before);
        await nav("Home").click();
        await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Home");
        await settled(page);
      });

      await t.test("a navigation that starts before the running transition is ready skips it without errors", async () => {
        const before = (await recorded(page)).length;
        // The next click lands inside the update callback: the running transition is skipped before `ready`.
        await page.evaluate(() =>
          document.addEventListener("rivet:after-swap", () => document.querySelector<HTMLAnchorElement>('nav a[href="/"]')!.click(), { once: true }),
        );
        await page.getByRole("link", { name: "First item" }).click();
        await page.waitForFunction(() => location.pathname === "/" && document.querySelector("h1")?.textContent === "Home");
        await settled(page);
        assert.ok((await recorded(page)).length > before);
        await page.waitForTimeout(100);
      });

      await t.test("no document loads, no errors, no CSP violations (Trusted Types, style-src 'self')", async () => {
        assert.equal(await page.textContent("#layout-clicks"), "Layout clicks 0");
        await page.locator("#layout-clicks").click();
        assert.equal(await page.textContent("#layout-clicks"), "Layout clicks 1");
        assert.deepEqual(documents, ["/"]);
        assert.deepEqual(errors, []);
      });
      await close();

      await t.test("reduced motion: no view transition", async () => {
        const reduced = await open(browser, app.url, { reducedMotion: "reduce" });
        await reduced.page.getByRole("link", { name: "First item" }).click();
        await reduced.page.waitForSelector("#item");
        await reduced.page.waitForTimeout(100);
        assert.deepEqual(await recorded(reduced.page), []);
        assert.deepEqual(reduced.errors, []);
        await reduced.close();
      });

      await t.test("without View Transitions: instant swap, events in order", async () => {
        const plain = await open(browser, app.url, {}, { noViewTransitions: true });
        await plain.page.getByRole("link", { name: "First item" }).click();
        await plain.page.waitForSelector("#item");
        await plain.page.waitForFunction(() => (window as unknown as TestWindow).__events.length === 4);
        assert.deepEqual(await plain.page.evaluate(() => (window as unknown as TestWindow).__events), [
          "rivet:navigate",
          "rivet:before-swap",
          "rivet:after-swap",
          "rivet:navigated",
        ]);
        assert.deepEqual(plain.errors, []);
        await plain.close();
      });
    } finally {
      await browser.close();
      await app.close();
    }
  }),
);
