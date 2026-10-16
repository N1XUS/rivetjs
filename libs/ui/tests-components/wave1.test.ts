// Plan 2 wave 1 — every wave-1 component on one resumed page (`/wave1`): SSR markup, JS loaded before interaction, Button press on the
// first click, live `<Button variant={variant()}>`, Chip / Badge / Alert markup server vs client.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, nonRuntimeScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage();
  try {
    await body(page);
  } finally {
    await page.close();
  }
}

/** Tags the element (an expando on the node): `marked` later tells whether it is still the same node. */
const mark = (page: Page, selector: string) => page.$eval(selector, (el) => void ((el as unknown as Record<string, boolean>).__rvMark = true));
const marked = (page: Page, selector: string) => page.$eval(selector, (el) => (el as unknown as Record<string, boolean>).__rvMark === true);

/** Every wave-1 `data-slot` the server must render (Kbd, Skeleton and the Avatar root carry none, as upstream). */
const SLOTS = [
  "header",
  "separator",
  "typography",
  "prose",
  "label",
  "description",
  "field-error",
  "error-message",
  "spinner",
  "spinner-icon",
  "empty-state",
  "link",
  "link-icon",
  "avatar-fallback",
  "close-button",
  "button",
  "chip",
  "chip-label",
  "badge",
  "badge-label",
  "badge-anchor",
  "alert-root",
  "alert-indicator",
  "alert-content",
  "alert-title",
  "alert-description",
];

/** T10–T13 component roots of the `Markup` fragment (`w-<name>` class; no cdk state), compared one by one. */
const MARKUP_PARTS = [
  "header",
  "separator",
  "heading",
  "paragraph",
  "code",
  "prose",
  "label",
  "description",
  "error-message",
  "kbd",
  "spinner",
  "skeleton",
  "empty-state",
  "chip",
  "badge",
  "alert",
];
/** `FieldMarkup`: cdk `TextField` + Label / Description / FieldError (`/wave1` only; the TextField preloads its state chunks). */
const FIELD_PARTS = ["field", "field-label", "field-description", "field-error"];
/** `ExprMarkup` (`/wave1` only): Chip / Badge with `{expr}` children + live props. */
const EXPR_PARTS = ["chip-expr", "badge-expr"];
const PARTS = [...MARKUP_PARTS, ...FIELD_PARTS, ...EXPR_PARTS];

/** Target-independent markup of every `PARTS` root in a region (`@rivetjs/testing/html` `normalizedHTML` rules, in-page: comment / empty
 * text anchors dropped, adjacent text merged, attributes sorted, generated `rv…` ids masked, `data-r` markers dropped) + the region's element count; the counter text is blanked. */
const snapshot = (page: Page, id: string) =>
  page.evaluate(
    ([id, parts]) => {
      const normalize = (node: Element): string => {
        const clone = node.cloneNode(true) as Element;
        for (const n of clone.querySelectorAll("output.w-n")) n.textContent = "";
        const walk = (el: Element) => {
          for (const child of [...el.childNodes]) {
            if (child.nodeType === Node.COMMENT_NODE || (child.nodeType === Node.TEXT_NODE && !child.textContent)) child.remove();
            else if (child.nodeType === Node.ELEMENT_NODE) walk(child as Element);
          }
          el.normalize();
        };
        walk(clone);
        const ser = (el: Element): string => {
          // Generated ids (`rv…`) differ per instance; `data-r` resume markers exist on server nodes only.
          const attrs = [...el.attributes]
            .filter((a) => a.name !== "data-r")
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((a) => ` ${a.name}="${/^rv[a-z0-9]*$/.test(a.value) ? "#" : a.value}"`);
          const inner = [...el.childNodes].map((c) => (c.nodeType === Node.ELEMENT_NODE ? ser(c as Element) : c.textContent)).join("");
          return `<${el.localName}${attrs.join("")}>${inner}</${el.localName}>`;
        };
        return ser(clone);
      };
      const region = document.getElementById(id)!;
      const html: Record<string, string> = {};
      for (const part of parts) {
        const roots = region.querySelectorAll(`.w-${part}`);
        html[part] = roots.length === 1 ? normalize(roots[0]!) : `<${roots.length} roots>`;
      }
      return { html, count: region.querySelectorAll("*").length };
    },
    [id, PARTS] as const,
  );

test("wave1: every wave-1 component renders on the server (data-slot per part), styles applied; Button / Link preload only their resume chunks", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/wave1");
    for (const slot of SLOTS) assert.ok((await page.$(`[data-slot="${slot}"]`)) !== null, `data-slot="${slot}"`);
    assert.equal(await page.getAttribute("#w-press", "class"), "button button--md button--secondary");
    assert.equal(await page.getAttribute("#w-live", "class"), "button button--md button--primary");
    assert.equal(await page.getAttribute("#w-static .w-heading", "data-type"), "h2");
    assert.equal(await page.getAttribute("#w-static .w-chip", "class"), "chip chip--danger chip--secondary w-chip");
    assert.equal(await page.getAttribute("#w-static .w-kbd", "class"), "kbd kbd--default w-kbd");
    assert.equal(await page.textContent("#w-static [data-slot=field-error]"), "Enter a valid email");
    assert.equal(await page.$("#w-avatar img"), null, "avatar: server renders the fallback only");
    assert.notEqual(await page.$eval("#w-press", (el) => getComputedStyle(el).paddingLeft), "0px");
    assert.notEqual(await page.$eval("[data-slot=alert-root]", (el) => getComputedStyle(el).paddingTop), "0px");
    await page.waitForLoadState("networkidle");
    // Documented (libs/ui/CLAUDE.md Known diffs): cdk Button / Link preload their resume chunks + the route module on load; the markup-only
    // route below carries the strict gate.
    const preloaded = nonRuntimeScripts(seen);
    assert.ok(
      preloaded.some((url) => /\/resume-Button-/.test(url)),
      "Button resume chunk preloaded: " + preloaded.join(","),
    );
    assert.deepEqual(seen.errors, []);
  }));

test("wave1-markup: T10–T13 components without a cdk field — no ui / route JS before interaction, no errors", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/wave1-markup");
    for (const part of MARKUP_PARTS) assert.ok((await page.$(`#w-static .w-${part}`)) !== null, `.w-${part}`);
    await page.waitForLoadState("networkidle");
    assert.deepEqual(nonRuntimeScripts(seen), [], "only runtime entry chunks before interaction");
    assert.deepEqual(seen.errors, []);
  }));

test("wave1: resumed Button press increments the counter on the first click; CloseButton press", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/wave1");
    await page.waitForLoadState("networkidle");
    await page.click("#w-press");
    await page.waitForFunction(() => document.querySelector("#w-count")?.textContent === "1");
    assert.ok(nonRuntimeScripts(seen).length > 0, "ui chunks load on interaction: " + seen.scripts.join(","));
    await page.click("#w-press");
    await page.waitForFunction(() => document.querySelector("#w-count")?.textContent === "2");
    await page.click("#w-close");
    await page.waitForFunction(() => document.querySelector("#w-closed")?.textContent === "1");
    assert.deepEqual(seen.errors, []);
  }));

// Live props (docs/design/specs/2026-10-07-live-props-design.md P1/P2): `<Button variant={variant()}>` follows the signal. Resumed page:
// the server-recorded region re-creates the Button on the FIRST change (resume recipes = P3, not landed; card.test.ts pins that case as
// `test.fails`), every later change updates the classes in place (node kept).
test("wave1: live <Button variant={variant()}> follows every toggle; after the first, the button node is kept", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/wave1");
    await page.waitForLoadState("networkidle");
    let first = true;
    for (const v of ["secondary", "primary", "secondary"]) {
      await page.click("#w-variant");
      await page.waitForFunction((c) => document.querySelector("#w-live")?.getAttribute("class") === c, `button button--md button--${v}`);
      if (first) first = false;
      else assert.ok(await marked(page, "#w-live"), "#w-live node kept");
      await mark(page, "#w-live");
      await page.waitForFunction((t) => document.querySelector("#w-live")?.textContent === t, v);
      assert.equal(await page.getAttribute("#w-live", "data-slot"), "button");
    }
    assert.deepEqual(seen.errors, []);
  }));

test("wave1: T10–T13 markup identical server vs resumed client, per component (adopted region kept, re-created region equal), no resume errors", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/wave1");
    await page.waitForLoadState("networkidle");
    const staticBefore = await snapshot(page, "w-static");
    const server = await snapshot(page, "w-markup");
    assert.deepEqual(server, staticBefore, "both regions render the same server markup");
    await page.click("#w-press");
    await page.waitForFunction(() => document.querySelector("#w-markup output.w-n")?.textContent === "1");
    const client = await snapshot(page, "w-markup");
    for (const part of PARTS) assert.equal(client.html[part], server.html[part], `${part}: server markup vs client markup`);
    assert.equal(client.count, server.count, "element count server vs client");
    assert.deepEqual(await snapshot(page, "w-static"), staticBefore, "adopted region untouched");
    assert.deepEqual(seen.errors, [], "no errors on resume");
  }));
