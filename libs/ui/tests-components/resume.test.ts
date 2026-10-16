// Resume edge cases (no upstream story): Card / Surface contexts re-provided to a re-created child region, a live
// `variant={live()}` Card re-providing SurfaceContext in place, and
// `dom.*` resuming an accessor prop next to JSX children.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { cardVariants } from "../styles/src/components/card/index.ts";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

/** Runs `body` on a fresh page, closed even when an assertion throws. */
async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage();
  try {
    await body(page);
  } finally {
    await page.close();
  }
}

const attr = (page: Page, selector: string, name: string) => page.getAttribute(selector, name);
/** Tags the element (an expando on the node): `marked` later tells whether it is still the same node. */
const mark = (page: Page, selector: string) => page.$eval(selector, (el) => void ((el as unknown as Record<string, boolean>).__rvMark = true));
const marked = (page: Page, selector: string) => page.$eval(selector, (el) => (el as unknown as Record<string, boolean>).__rvMark === true);

test("resume: a re-created child region of a Card re-provides rv-ui-card + rv-ui-surface (parts keep variant classes)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/resume");
    assert.equal(await attr(page, "#r-content", "class"), cardVariants({ variant: "secondary" }).content());
    assert.equal(await attr(page, "#r-surface", "data-surface"), "secondary");
    assert.equal(await attr(page, "#t-surface", "data-surface"), "none");
    await mark(page, "#r-card");
    await mark(page, "#r-transparent");
    await page.click("#toggle");
    await page.waitForSelector("#r-footer", { state: "attached" });
    // Only the child region re-created: the Card roots are the server nodes.
    assert.ok(await marked(page, "#r-card"), "#r-card root kept");
    assert.ok(await marked(page, "#r-transparent"), "#r-transparent root kept");
    // CardContext `{ variant: "secondary" }` reached the re-created footer (no context → no slot class, only `class`).
    assert.equal(await attr(page, "#r-footer", "class"), cardVariants({ variant: "secondary" }).footer());
    assert.equal(await attr(page, "#r-footer", "data-slot"), "card-footer");
    // SurfaceContext `{ variant: "secondary" }` reached a consumer inside it.
    assert.equal(await attr(page, "#r-surface", "data-surface"), "secondary");
    assert.equal(await attr(page, "#r-card", "class"), "card card--secondary");
    // Transparent Card: CardContext only, no SurfaceContext.
    await page.waitForSelector("#t-footer", { state: "attached" });
    assert.equal(await attr(page, "#t-footer", "class"), cardVariants({ variant: "transparent" }).footer());
    assert.equal(await attr(page, "#t-surface", "data-surface"), "none");
    // And back.
    await page.click("#toggle");
    await page.waitForSelector("#r-content", { state: "attached" });
    assert.equal(await attr(page, "#r-content", "class"), cardVariants({ variant: "secondary" }).content());
    assert.equal(await attr(page, "#r-surface", "data-surface"), "secondary");
    assert.ok(await marked(page, "#r-card"), "#r-card root kept");
    assert.deepEqual(seen.errors, []);
  }));

// Live props: the Card's context values are getters over its live `variant`, so a consumer's binding follows the prop
// (transparent → the outer Surface's variant, as upstream where a transparent Card provides no SurfaceContext). The first
// change re-creates the resumed Card region (live-props P3 not landed: card.test.ts `.fails`); later ones keep the nodes.
test("resume: live <Card variant={live()}> — SurfaceContext consumer follows every change, nodes kept after the first", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/resume");
    assert.equal(await attr(page, "#r-live", "class"), "card card--secondary");
    assert.equal(await attr(page, "#l-surface", "data-surface"), "secondary");
    let first = true;
    for (const [v, surface] of [
      ["transparent", "default"],
      ["tertiary", "tertiary"],
      ["secondary", "secondary"],
      ["transparent", "default"],
    ] as const) {
      await page.click("#live");
      await page.waitForFunction((c) => document.querySelector("#r-live")?.getAttribute("class") === c, `card card--${v}`);
      await page.waitForFunction((d) => document.querySelector("#l-surface")?.getAttribute("data-surface") === d, surface);
      if (first) first = false;
      else for (const sel of ["#r-live", "#l-surface"]) assert.ok(await marked(page, sel), `${sel} kept (${v})`);
      for (const sel of ["#r-live", "#l-surface"]) await mark(page, sel);
    }
    assert.equal(await attr(page, "#r-outer", "class"), "surface surface--default");
    assert.deepEqual(seen.errors, []);
  }));

test("resume: <dom.div class={() => c()}><span/></dom.div> resumes and the class follows the signal", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/resume");
    assert.equal(await attr(page, "#r-dom", "class"), "a");
    assert.equal(await page.textContent("#r-dom-child"), "child");
    await mark(page, "#r-dom");
    await page.click("#cls");
    await page.waitForFunction(() => document.querySelector("#r-dom")?.getAttribute("class") === "b");
    assert.ok(await marked(page, "#r-dom"), "#r-dom element kept");
    assert.equal(await page.textContent("#r-dom-child"), "child");
    assert.equal(await page.$$eval("#r-dom > *", (els) => els.length), 1);
    await page.click("#cls");
    await page.waitForFunction(() => document.querySelector("#r-dom")?.getAttribute("class") === "a");
    assert.equal(await page.textContent("#r-dom-child"), "child");
    assert.deepEqual(seen.errors, []);
  }));

// The resumed `_spread` binding keeps the server content until `children` changes: `#r-dom-child` survives class changes
// (child DOM state — focus, input value, nested component state — kept).
test("resume: dom.div accessor class change keeps the child node", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/resume");
    await mark(page, "#r-dom-child");
    await page.click("#cls");
    await page.waitForFunction(() => document.querySelector("#r-dom")?.getAttribute("class") === "b");
    assert.ok(await marked(page, "#r-dom-child"), "#r-dom-child kept across the first change");
    await page.click("#cls");
    await page.waitForFunction(() => document.querySelector("#r-dom")?.getAttribute("class") === "a");
    assert.ok(await marked(page, "#r-dom-child"), "#r-dom-child kept across the second change");
  }));

// `dom.div render` with a press handler on a resumed page (Task 4 found a non-native `render` target not firing its press):
// the handler fires, the accessor attribute and the function `children` follow.
test("resume: dom.div render={section} with onClick resumes, the handler fires, an accessor attribute follows", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/resume");
    assert.equal(await page.$eval("#r-render", (el) => el.tagName), "SECTION");
    assert.equal(await attr(page, "#r-render", "data-n"), "0");
    assert.equal(await page.textContent("#r-render"), "presses: 0");
    await page.click("#r-render");
    await page.waitForFunction(() => document.querySelector("#r-render")?.getAttribute("data-n") === "1");
    await page.waitForFunction(() => document.querySelector("#r-render")?.textContent === "presses: 1");
    await page.click("#r-render");
    await page.waitForFunction(() => document.querySelector("#r-render")?.getAttribute("data-n") === "2");
    assert.deepEqual(seen.errors, []);
  }));
