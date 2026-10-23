// Form in a drawer (cdk Modal) on a live page (`export const live = true`), Chromium end to end
// (production build, node adapter): an enhanced submit never reloads; issues show in the open drawer;
// success updates the list + the layout in place from the single-flight answer and closes the drawer
// while page-local state survives; the same flow without JavaScript (`?new` + full POST documents).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { chromium, type Browser, type Page } from "playwright";
import { start } from "@rivetjs/router/node";
import { buildApp } from "./drawer-app/serve.ts";

const root = new URL("./drawer-app/", import.meta.url).pathname;
let origin = "";
let close: () => Promise<void> = async () => {};
let browser: Browser;

beforeAll(async () => {
  await buildApp();
  const app = await start({ dist: root + "dist", port: 0, host: "127.0.0.1", onError: () => {} });
  origin = app.url;
  close = () => app.close();
  browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
}, 120_000);
afterAll(async () => {
  await browser?.close();
  await close();
});

function watch(page: Page) {
  const seen = { documents: 0, posts: [] as number[], data: 0, urls: [] as string[], errors: [] as string[] };
  page.on("request", (request) => {
    if (request.resourceType() === "document") seen.documents++;
    if (new URL(request.url()).searchParams.has("_rivet")) (seen.data++, seen.urls.push(request.method() + " " + request.url()));
  });
  page.on("requestfinished", async (request) => {
    if (request.method() === "POST") seen.posts.push((await request.sizes()).responseBodySize);
  });
  page.on("pageerror", (error) => seen.errors.push(error.message));
  return seen;
}
const rows = (page: Page) => page.locator("#customers li").count();
let unique = 0;
const email = () => `user${Date.now()}-${unique++}@example.com`;

test("JS: drawer submit keeps the page — issues in the open drawer, then list + layout update in place and the drawer closes", async () => {
  const page = await browser.newPage();
  const seen = watch(page);
  await page.goto(origin + "/");
  const before = await rows(page);
  const total = Number(await page.textContent("#total"));
  // Page-local state, then the drawer (cold clicks on the resumed page).
  await page.click("#clicks");
  await page.click("#clicks");
  await page.waitForFunction(() => document.querySelector("#clicks")?.textContent === "Clicked 2");
  await page.click("#new");
  await page.waitForSelector("#drawer");
  // A server-side issue (email already a customer): shown inside the open drawer, focus on the field.
  await page.fill("#customer-name", "Ada Again");
  await page.fill("#customer-email", "ada@example.com");
  await page.click("#save");
  await page.waitForFunction(() => document.querySelector("#customer-email-error")?.textContent?.includes("already a customer"));
  assert.equal(await page.locator("#drawer").isVisible(), true);
  assert.equal(await page.evaluate(() => document.activeElement?.id), "customer-email");
  assert.equal(await rows(page), before);
  // Success: one POST answers the action + fresh loader data (no data request, no document).
  const address = email();
  await page.fill("#customer-email", address);
  await page.click("#save");
  await page.waitForFunction((n) => document.querySelectorAll("#customers li").length === n + 1, before);
  await page.waitForSelector("#drawer", { state: "detached" });
  assert.match((await page.locator("#customers li").last().textContent()) ?? "", new RegExp(address.replace(/[.]/g, "\\.")));
  assert.equal(Number(await page.textContent("#total")), total + 1, "the layout's loader data updated too");
  assert.equal(await page.textContent("#clicks"), "Clicked 2", "the page was not re-rendered");
  assert.equal(seen.documents, 1);
  assert.equal(seen.data, 0, seen.urls.join(", "));
  assert.equal(seen.posts.length, 2);
  // Nothing left inert behind the closed drawer: the page stays usable.
  assert.equal(await page.evaluate(() => document.querySelector("[inert]")), null);
  await page.click("#clicks");
  await page.waitForFunction(() => document.querySelector("#clicks")?.textContent === "Clicked 3");
  // Again (warm): the next add updates the same list.
  await page.click("#new");
  await page.fill("#customer-name", "Ken");
  await page.fill("#customer-email", email());
  await page.click("#save");
  await page.waitForFunction((n) => document.querySelectorAll("#customers li").length === n + 2, before);
  await page.waitForSelector("#drawer", { state: "detached" });
  assert.equal(seen.documents, 1);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("JS: a search-only navigation of the live page refreshes it in place (link, back, forward)", async () => {
  const page = await browser.newPage();
  const seen = watch(page);
  await page.goto(origin + "/");
  await page.click("#clicks");
  await page.waitForFunction(() => document.querySelector("#clicks")?.textContent === "Clicked 1");
  await page.click("#new-url");
  await page.waitForFunction(() => document.querySelector("#creating")?.textContent === "creating");
  assert.equal(new URL(page.url()).search, "?new");
  assert.equal(await page.textContent("#clicks"), "Clicked 1", "the page was not re-rendered");
  await page.goBack();
  await page.waitForFunction(() => document.querySelector("#creating")?.textContent === "listing");
  assert.equal(new URL(page.url()).search, "");
  await page.goForward();
  await page.waitForFunction(() => document.querySelector("#creating")?.textContent === "creating");
  assert.equal(await page.textContent("#clicks"), "Clicked 1", "the page was not re-rendered");
  // Still live after search navigations: a submit updates the list in place.
  const before = await rows(page);
  await page.click("#new");
  await page.fill("#customer-name", "Search Nav");
  await page.fill("#customer-email", email());
  await page.click("#save");
  await page.waitForFunction((n) => document.querySelectorAll("#customers li").length === n + 1, before);
  assert.equal(await page.textContent("#clicks"), "Clicked 1");
  // Another page and back: regular navigations.
  await page.evaluate(() => document.querySelector<HTMLAnchorElement>("#new-url")!.setAttribute("href", "/overlays"));
  await page.click("#new-url");
  await page.waitForSelector("#loads");
  await page.goBack();
  await page.waitForSelector("#customers");
  assert.equal(seen.documents, 1);
  assert.equal(seen.data, 5, "one data request per search navigation (3) and per page navigation (2)");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("JS: focus in the drawer form warms the data-reading chunks — no script request after the answer", async () => {
  const page = await browser.newPage();
  const seen = watch(page);
  await page.goto(origin + "/");
  await page.click("#new");
  await page.waitForSelector("#drawer");
  await page.fill("#customer-name", "Warm");
  await page.fill("#customer-email", email());
  await page.waitForTimeout(300);
  const before = await rows(page);
  const after: string[] = [];
  let posted = false;
  page.on("request", (request) => {
    if (request.method() === "POST") posted = true;
    else if (posted && request.resourceType() === "script") after.push(new URL(request.url()).pathname);
  });
  await page.click("#save");
  await page.waitForFunction((n) => document.querySelectorAll("#customers li").length === n + 1, before);
  await page.waitForTimeout(100);
  assert.deepEqual(after, [], "every chunk the in-place refresh needs was loaded on intent");
  assert.equal(Number(await page.textContent("#total")), before + 1);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("JS: the single-flight answer is a fraction of the no-JS document", async () => {
  const js = await browser.newPage();
  const seenJS = watch(js);
  await js.goto(origin + "/");
  await js.click("#new");
  await js.fill("#customer-name", "Bytes");
  await js.fill("#customer-email", email());
  await js.click("#save");
  await js.waitForSelector("#drawer", { state: "detached" });
  await js.waitForTimeout(100);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const nojs = await context.newPage();
  const seenDoc = watch(nojs);
  await nojs.goto(origin + "/?new");
  await nojs.fill("#customer-name", "Bytes");
  await nojs.fill("#customer-email", email());
  await nojs.click("#save");
  await nojs.waitForLoadState();
  await nojs.waitForTimeout(100);
  const [answer] = seenJS.posts,
    [document] = seenDoc.posts;
  assert.ok(answer! > 0 && document! > 4 * answer!, `answer ${answer} B vs document ${document} B`);
  await js.close();
  await context.close();
});

test("no JS: `?new` renders the drawer open; a failed POST re-renders it with the issue, a successful one closes it", async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(origin + "/?new");
  assert.equal(await page.locator("#drawer").isVisible(), true);
  const before = await rows(page);
  await page.fill("#customer-name", "Ada Again");
  await page.fill("#customer-email", "ada@example.com");
  await page.click("#save");
  await page.waitForSelector("#customer-email-error:not([hidden])");
  assert.match((await page.textContent("#customer-email-error")) ?? "", /already a customer/);
  assert.equal(await page.inputValue("#customer-name"), "Ada Again", "values echoed");
  assert.equal(await rows(page), before);
  await page.fill("#customer-email", email());
  await page.click("#save");
  await page.waitForFunction((n) => document.querySelectorAll("#customers li").length === n + 1, before);
  assert.equal(await page.locator("#drawer").count(), 0);
  await context.close();
});

// Overlay leak regression (`/overlays`, not a live page): an open cdk Modal / Popover and ui Drawer / Sheet must be
// disposed with the page — a revalidation re-renders it, a client navigation or the back button leaves it — so no
// portal, `inert` page or scroll lock stays behind. Root cause was resume attribution: content of the Router's awaited
// route Async recorded under the page root instead of the Router's region, so its re-creation disposed nothing.
const KINDS = ["modal", "popover", "drawer", "sheet"] as const;
const leftovers = (page: Page) =>
  page.evaluate(() => ({
    inert: document.querySelectorAll("[inert]").length,
    dialogs: document.querySelectorAll("[role=dialog],[role=alertdialog]").length,
    portals: [...document.querySelectorAll("[data-rivet-portal]")].filter((portal) => portal.childElementCount > 0).length,
    overflow: document.documentElement.style.overflow,
  }));
const CLEAN = { inert: 0, dialogs: 0, portals: 0, overflow: "" };
async function open(page: Page, kind: string) {
  await page.click(`#${kind}-open`);
  await page.waitForSelector(`#${kind}-dialog`);
}

for (const kind of KINDS) {
  test(`${kind}: a revalidation of a non-live page disposes the open overlay`, async () => {
    const page = await browser.newPage();
    const seen = watch(page);
    await page.goto(origin + "/overlays");
    const loads = await page.textContent("#loads");
    await open(page, kind);
    await page.click(`#${kind}-refresh`);
    await page.waitForFunction((n) => document.querySelector("#loads")?.textContent !== n, loads);
    await page.waitForSelector(`#${kind}-dialog`, { state: "detached" });
    assert.deepEqual(await leftovers(page), CLEAN);
    await page.click("#clicks");
    await page.waitForFunction(() => document.querySelector("#clicks")?.textContent === "Clicked 1");
    // Opens again on the re-rendered page, and closes cleanly.
    await open(page, kind);
    await page.keyboard.press("Escape");
    await page.waitForSelector(`#${kind}-dialog`, { state: "detached" });
    assert.deepEqual(await leftovers(page), CLEAN);
    assert.equal(seen.documents, 1);
    assert.deepEqual(seen.errors, []);
    await page.close();
  });

  test(`${kind}: a client navigation away from the open overlay disposes it`, async () => {
    const page = await browser.newPage();
    const seen = watch(page);
    await page.goto(origin + "/overlays");
    await open(page, kind);
    await page.click(`#${kind}-away`);
    await page.waitForSelector("#other");
    await page.waitForSelector(`#${kind}-dialog`, { state: "detached" });
    assert.deepEqual(await leftovers(page), CLEAN);
    // Back on the page (client-rendered now): open and leave again.
    await page.click("#to-overlays");
    await open(page, kind);
    await page.click(`#${kind}-away`);
    await page.waitForSelector("#other");
    await page.waitForSelector(`#${kind}-dialog`, { state: "detached" });
    assert.deepEqual(await leftovers(page), CLEAN);
    assert.equal(seen.documents, 1);
    assert.deepEqual(seen.errors, []);
    await page.close();
  });

  test(`${kind}: the back button with the overlay open disposes it`, async () => {
    const page = await browser.newPage();
    const seen = watch(page);
    // Same-document history: `/other` (resumed), then `/overlays` by a client navigation.
    await page.goto(origin + "/other");
    await page.click("#to-overlays");
    await open(page, kind);
    await page.goBack();
    await page.waitForSelector("#other");
    await page.waitForSelector(`#${kind}-dialog`, { state: "detached" });
    assert.deepEqual(await leftovers(page), CLEAN);
    // Forward again (popstate renders `/overlays`), open, back.
    await page.goForward();
    await open(page, kind);
    await page.goBack();
    await page.waitForSelector("#other");
    await page.waitForSelector(`#${kind}-dialog`, { state: "detached" });
    assert.deepEqual(await leftovers(page), CLEAN);
    assert.equal(seen.documents, 1);
    assert.deepEqual(seen.errors, []);
    await page.close();
  });
}
