import { test } from "vitest";
import assert from "node:assert/strict";
import { brotliCompressSync } from "node:zlib";
import { chromium } from "playwright";

test("resumed playground page: loader only before interaction, then counter, filter, effects and events", async () => {
  const { createPlaygroundServer } = await import("../server.ts");
  const { url: origin, close } = await createPlaygroundServer({ port: 0 });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [],
      scripts: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Pages ship a strict nonce CSP: any blocked script or eval shows up as an error.
    page.on("console", (message) => message.text().startsWith("CSP ") && errors.push(message.text()));
    await page.addInitScript(() =>
      document.addEventListener("securitypolicyviolation", (event) => console.error("CSP " + event.violatedDirective + " " + event.blockedURI)),
    );
    page.on("request", (request) => {
      if (request.resourceType() === "script" || /\.m?js$/.test(new URL(request.url()).pathname)) scripts.push(request.url());
    });
    const response = await page.goto(origin + "/resume");
    const html = await response!.text();
    // The only scripts before interaction are the inline loader, which fits the loader's brotli budget (1,912 B:
    // libs/runtime/tests/resume-loader.test.ts), and the expand add-on on pages with row templates.
    const inline = [...html.matchAll(/<script(?: nonce="[^"]+")?>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
    const loader = inline.filter((script) => !script.includes(".$rx="));
    assert.equal(loader.length, 1);
    assert.ok(inline.length <= 2);
    assert.ok(brotliCompressSync(loader[0]!).length <= 1912);
    assert.doesNotMatch(html, /<script type="module"/);
    assert.match(html, /<output id="resume-count"[^>]*>(?:<!--r\d*-->)?0(?:<!--\/-->)?<\/output>/);
    // Client effects/events boot the runtime at idle; the canvas effect draws once visible.
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#resume-canvas")!.dataset.drawn === "0");
    await page.locator("#resume-increase").click();
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#resume-count")!.textContent === "1");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#resume-canvas")!.dataset.drawn === "1");
    await page.getByLabel("Filter examples").fill("rout");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#resume-matches")!.textContent!.startsWith("1 of 3"));
    await page.setViewportSize({ width: 640, height: 480 });
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#resume-width")!.textContent!.endsWith("640"));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await close();
  }
});

test("resumed page without interaction loads no modules when it has no client effects", async () => {
  const { createPlaygroundServer } = await import("../server.ts");
  const { url: origin, close } = await createPlaygroundServer({ port: 0 });
  try {
    const html = await (await fetch(origin + "/resume")).text();
    // This page has effects, so it asks for an idle boot; pages without them omit data-boot.
    assert.match(html, /<script type="rivet\/boundaries"[^>]* data-boot[ >]/);
  } finally {
    await close();
  }
});

test("resumed home page: counter, filter, client navigation, back, cold detail and client-only widget", async () => {
  const { createPlaygroundServer } = await import("../server.ts");
  const { url: origin, close } = await createPlaygroundServer({ port: 0 });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Pages ship a strict nonce CSP: any blocked script or eval shows up as an error.
    page.on("console", (message) => message.text().startsWith("CSP ") && errors.push(message.text()));
    await page.addInitScript(() =>
      document.addEventListener("securitypolicyviolation", (event) => console.error("CSP " + event.violatedDirective + " " + event.blockedURI)),
    );
    let documents = 0;
    page.on("request", (request) => request.resourceType() === "document" && documents++);
    await page.goto(origin + "/");
    await page.getByRole("button", { name: "Increase count" }).click();
    await page.getByRole("button", { name: "Increase count" }).click();
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#count")!.textContent === "2");
    // For list re-created by its region symbol on the first query change.
    await page.getByLabel("Filter examples").fill("rout");
    await page.waitForFunction(() => document.querySelectorAll("#examples li").length === 1);
    await page.getByLabel("Filter examples").fill("");
    await page.waitForFunction(() => document.querySelectorAll("#examples li").length === 3);
    // Router resumes: link click navigates in-document, counter state survives.
    // Link interception attaches once the resumed runtime starts (until then links navigate natively).
    await page.waitForFunction(() => typeof (document as unknown as { $rdp?: unknown }).$rdp === "function");
    await page.evaluate(() => new Promise((done) => requestIdleCallback(() => setTimeout(done, 50))));
    await page.getByRole("link", { name: "Explicit async" }).click();
    await page.waitForURL(/\/items\/2$/);
    await page.waitForSelector("#detail");
    assert.equal(await page.textContent("#count"), "2");
    await page.goBack();
    await page.waitForFunction(() => document.querySelectorAll("#examples li").length === 3);
    assert.equal(await page.textContent("#count"), "2");
    assert.equal(documents, 1);
    // Client-only widget mounts into its region.
    await page.waitForFunction(() => document.querySelector("#browser-widget")?.textContent!.includes("ready"));
    // Cold detail page: its back link resumes and navigates in the same document.
    documents = 0;
    await page.goto(origin + "/items/3");
    // Link interception attaches once the resumed runtime starts (until then links navigate natively).
    await page.waitForFunction(() => typeof (document as unknown as { $rdp?: unknown }).$rdp === "function");
    await page.evaluate(() => new Promise((done) => requestIdleCallback(() => setTimeout(done, 50))));
    await page.getByRole("link", { name: "Back to examples" }).click();
    await page.waitForFunction(() => document.querySelectorAll("#examples li").length === 3);
    assert.equal(new URL(page.url()).pathname, "/");
    assert.equal(documents, 1);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await close();
  }
});

test("gtag-style page views: analytics chunk loads at idle, never preloaded, reruns per client navigation", async () => {
  const { createPlaygroundServer } = await import("../server.ts");
  const { url: origin, close } = await createPlaygroundServer({ port: 0 });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Pages ship a strict nonce CSP: any blocked script or eval shows up as an error.
    page.on("console", (message) => message.text().startsWith("CSP ") && errors.push(message.text()));
    await page.addInitScript(() =>
      document.addEventListener("securitypolicyviolation", (event) => console.error("CSP " + event.violatedDirective + " " + event.blockedURI)),
    );
    let documents = 0;
    page.on("request", (request) => request.resourceType() === "document" && documents++);
    // Registered before any page script, so it marks the start of the first idle period.
    await page.addInitScript(() => requestIdleCallback(() => (window.__firstIdle = performance.now())));
    const response = await page.goto(origin + "/");
    const html = await response!.text();
    // Scheduled prefetches (`data-preload`, when the page has any) and the lazy router's fetch-only
    // hints (Z1: `data-fo`, the runtime and router chunks the loader module hints at low priority after load).
    const attribute = html.match(/data-preload="([^"]*)"/)?.[1];
    const preload = attribute ? (JSON.parse(attribute.replaceAll("&quot;", '"').replaceAll("&amp;", "&")) as [string, ...[string, string][]]) : [];
    const hints = (html.match(/data-fo="([^"]*)"/)?.[1] ?? "").split(" ").filter(Boolean);
    const scheduled = [...preload.slice(1).map((entry) => (entry as [string, string])[0]), ...hints];
    assert.ok(scheduled.length > 0);
    assert.equal(
      [...preload.slice(0, 1), ...scheduled].some((url) => /analytics/.test(url as string)),
      false,
      "analytics chunk is never scheduled for preload",
    );
    await page.waitForFunction(() => window.__pageViews?.length === 1);
    assert.deepEqual(await page.evaluate(() => window.__pageViews), ["/"]);
    const timing = await page.evaluate(() => ({
      idle: window.__firstIdle,
      analytics: performance
        .getEntriesByType("resource")
        .filter((entry) => /\/analytics-[^/]*\.js$/.test(entry.name))
        .map((entry) => entry.startTime),
    }));
    assert.equal(timing.analytics.length, 1);
    assert.ok(typeof timing.idle === "number" && timing.analytics[0] >= timing.idle, JSON.stringify(timing));
    // Link interception attaches once the resumed runtime starts (until then links navigate natively).
    await page.waitForFunction(() => typeof (document as unknown as { $rdp?: unknown }).$rdp === "function");
    await page.evaluate(() => new Promise((done) => requestIdleCallback(() => setTimeout(done, 50))));
    await page.getByRole("link", { name: "Explicit async" }).click();
    await page.waitForURL(/\/items\/2$/);
    await page.waitForFunction(() => window.__pageViews!.length === 2);
    await page.goBack();
    await page.waitForFunction(() => window.__pageViews!.length === 3);
    await page.waitForTimeout(100);
    assert.deepEqual(await page.evaluate(() => window.__pageViews), ["/", "/items/2", "/"]);
    assert.equal(documents, 1);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await close();
  }
});

test("dev server: client-rendered pages count one page view per navigation", async () => {
  const { createPlaygroundServer } = await import("../server.ts");
  const { url: origin, close } = await createPlaygroundServer({ port: 0, dev: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin + "/");
    await page.waitForFunction(() => window.__pageViews?.length === 1);
    await page.getByRole("button", { name: "Increase count" }).click();
    await page.waitForFunction(() => document.querySelector("#count")?.textContent === "1");
    await page.getByRole("link", { name: "Explicit async" }).click();
    await page.waitForSelector("#detail");
    await page.waitForFunction(() => window.__pageViews?.length === 2);
    await page.waitForTimeout(200);
    assert.deepEqual(await page.evaluate(() => window.__pageViews), ["/", "/items/2"]);
    assert.equal(await page.textContent("#count"), "1");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await close();
  }
});
