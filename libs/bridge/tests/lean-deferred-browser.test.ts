// D-lean in Chromium: a page whose other resumables are only intent client events (a file router's link listeners)
// ends with the lean islands boot + a deferred state + the resume loader. The island hydrates through the lean boot
// without the Rivet runtime; the first link click starts the runtime (cold click held and replayed by the loader), the
// router-like handler runs once, and the island is not hydrated a second time (its effect is not in the state). With
// `preload.ahead` (router document prefetch on) the runtime is fetched after `load` but never evaluated before intent.
import { test } from "vitest";
import assert from "node:assert/strict";
import { withPage } from "../../runtime/tests/resume/harness.ts";
import { resumedPage } from "./resume-page.ts";

const source = `
import { clientEvent } from "@rivetjs/runtime/dom";
import { _island } from "@rivetjs/bridge/server";
import { fake, Clicker } from "./fake-adapter.ts";
const COUNTER = { id: "src/Counter.fake#default", c: Clicker, a: fake, chunk: "/islands/counter.js" };
function loadCounter() { return import("/islands/counter.js"); }
export function Counter(props) { return <>{_island(props, COUNTER, loadCounter)}</>; }
export function Page() {
  // Like the router's interceptClick: a click the loader already held (default prevented) is skipped, its replay handled.
  clientEvent(document, "click", (event) => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    window.__nav = (window.__nav ?? 0) + 1;
  }, { preload: "intent", match: "a" });
  return <main>
    <a class="go" href="/next">next</a>
    <Counter client="load" count={1} />
  </main>;
}
`;

const files = await resumedPage(source, undefined, { islands: { "src/Counter.fake#default": "/islands/counter.js" } });

test("lean islands + deferred state: island hydrates without the runtime; the first link click starts it once", async () => {
  const html = files["/"] as string;
  assert.ok(html.includes('type="rivet/islands"') && html.includes('type="rivet/state"'), html);
  await withPage(files, async (browser, requests) => {
    const errors: string[] = [];
    browser.on("pageerror", (error) => errors.push(String(error)));
    browser.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await browser.goto("http://rivet.test/");
    await browser.waitForFunction(() => (window as unknown as { __log?: unknown[] }).__log?.length);
    const calls = () => browser.evaluate(() => (window as unknown as { __log: { call: string; id?: string }[] }).__log.map((e) => [e.call, e.id ?? null]));
    assert.deepEqual(await calls(), [["hydrate", "i0"]]);
    await new Promise((resolve) => setTimeout(resolve, 300));
    // No Rivet runtime before an interaction (the runtime entry, the page's symbol chunk).
    assert.ok(!requests.includes("/rt.js") && !requests.includes("/c/Page.js"), requests.join(" "));
    // The island handles its own clicks (React-side code only).
    await browser.click("rivet-island button");
    // Cold link click: the loader holds it, starts the runtime, replays it to the resumed handler.
    await browser.click("a.go");
    await browser.waitForFunction(() => (window as unknown as { __nav?: number }).__nav === 1);
    assert.ok(requests.includes("/rt.js"), requests.join(" "));
    assert.equal(new URL(browser.url()).pathname, "/");
    await new Promise((resolve) => setTimeout(resolve, 200));
    // Handled once (held click replayed, not run twice); the runtime boot did not hydrate the island again.
    assert.equal(await browser.evaluate(() => (window as unknown as { __nav: number }).__nav), 1);
    assert.deepEqual(await calls(), [["hydrate", "i0"]]);
    assert.deepEqual(errors, []);
  });
});

test("keyboard: focusing the link (intent) then Enter reaches the handler once", async () => {
  await withPage(files, async (browser) => {
    const errors: string[] = [];
    browser.on("pageerror", (error) => errors.push(String(error)));
    await browser.goto("http://rivet.test/");
    await browser.waitForFunction(() => (window as unknown as { __log?: unknown[] }).__log?.length);
    await browser.focus("a.go");
    await browser.keyboard.press("Enter");
    await browser.waitForFunction(() => (window as unknown as { __nav?: number }).__nav === 1);
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(await browser.evaluate(() => (window as unknown as { __nav: number }).__nav), 1);
    assert.equal(new URL(browser.url()).pathname, "/");
    assert.deepEqual(errors, []);
  });
});

// Fetch-ahead (`preload.ahead`): every served module records its evaluation; the runtime entry + the page chunk are
// modulepreloaded after `load` (fetched) but evaluate only once the first link click starts the runtime.
const PROBE = (path: string, code: string) => (/\.(m?js|ts)$/.test(path) ? `(self.__ev ??= []).push(${JSON.stringify(path)});\n` + code : code);
const ahead = await resumedPage(source, PROBE, {
  islands: { "src/Counter.fake#default": "/islands/counter.js" },
  loader: "/resume-loader-module.ts",
  preload: { ahead: true },
});

test("preload.ahead: runtime + page chunk fetched after load (low priority), not evaluated before the first link click", async () => {
  const html = ahead["/"] as string;
  const tag = /<script type="rivet\/state"[^>]*>/.exec(html)![0];
  assert.match(tag, /data-fo="\/rt\.js \/c\/Page\.js"/);
  assert.ok(!tag.includes("data-boot"), tag);
  await withPage(ahead, async (browser, requests) => {
    const errors: string[] = [];
    browser.on("pageerror", (error) => errors.push(String(error)));
    await browser.goto("http://rivet.test/");
    await browser.waitForFunction(() => (window as unknown as { __log?: unknown[] }).__log?.length);
    // The loader module adds the fetch-only links after load + fonts + an idle slice.
    await browser.waitForFunction(() => document.querySelector('link[rel="modulepreload"][href="/rt.js"]'));
    const link = await browser.evaluate(() => {
      const el = document.querySelector('link[rel="modulepreload"][href="/rt.js"]') as HTMLLinkElement;
      return el.getAttribute("fetchpriority");
    });
    assert.equal(link, "low");
    await browser.waitForFunction(() => performance.getEntriesByType("resource").some((entry) => entry.name.endsWith("/c/Page.js")));
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.ok(requests.includes("/rt.js") && requests.includes("/c/Page.js"), requests.join(" "));
    const evaluated = () => browser.evaluate(() => (self as unknown as { __ev: string[] }).__ev);
    const before = await evaluated();
    assert.ok(!before.includes("/rt.js") && !before.includes("/c/Page.js") && !before.includes("/fixture.mjs"), before.join(" "));
    assert.ok(before.includes("/islands/counter.js"), before.join(" "));
    await browser.click("a.go");
    await browser.waitForFunction(() => (window as unknown as { __nav?: number }).__nav === 1);
    assert.ok((await evaluated()).includes("/rt.js"));
    assert.deepEqual(await browser.evaluate(() => (window as unknown as { __log: { call: string }[] }).__log.map((e) => e.call)), ["hydrate"]);
    assert.deepEqual(errors, []);
  });
});
