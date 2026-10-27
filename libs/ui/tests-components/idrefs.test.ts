// ID-RESUME: generated roots, untouched siblings, portal targets and retained server ids.
import { test, describe, beforeAll, afterAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, type Stories } from "./harness.ts";

import { Window } from "happy-dom";
import { expandTail } from "@rivetjs/runtime/resume-format";
import { loadBuild } from "@rivetjs/router/node";
import { dist } from "./app/serve.ts";

// This half needs no listening socket or browser. It proves the generated DOM roots actually ship as keyed state.
for (const part of ["combo", "select", "tabs", "menu", "list"])
  test(`SSR records retain ${part} IDREF roots`, async () => {
    const { handler } = await loadBuild(dist, { preload: { lean: true } });
    const response = await handler(new Request("http://localhost/idrefs"));
    assert.equal(response.status, 200);
    const window = new Window();
    try {
      window.document.body.innerHTML = await response.text();
      const tail = expandTail(JSON.parse(window.document.querySelector('script[type="rivet/boundaries"]')!.textContent!));
      const values = new Set(tail.b.flatMap((record) => record[4].filter((_, index) => index % 2 === 1)));
      const roots = [...new Set([...window.document.querySelectorAll(`#ir-${part} [id]`)].map((el) => /^(rv\d+)(?:-|$)/.exec(el.id)?.[1]).filter(Boolean))];
      assert.ok(roots.length > 0, "fixture has generated ids");
      assert.deepEqual(
        roots.filter((id) => !values.has(id!)),
        [],
        "server-generated roots must ship as keyed state",
      );
    } finally {
      await window.close();
    }
  });

describe("browser adoption", () => {
  let s: Stories;
  beforeAll(async () => (s = await stories()));
  afterAll(async () => s?.close());

  for (const [name, selector, ready] of [
    ["combo", "[role=combobox]", "[role=listbox]"],
    ["select", "[data-slot=select-trigger]", "[role=listbox]"],
    // `:has-text`, not `:text-is`: the panel's text sits in a child `<p>`, and `:text-is` skips an element whose child matches too.
    ["tabs", "[role=tab]:text-is('Two')", "[role=tabpanel]:has-text('Second')"],
    ["menu", "[data-slot=dropdown-trigger]", "[role=menu]"],
    ["list", "[role=option]:has-text('Pear')", "[role=option][aria-selected=true]"],
  ])
    test(`a resumed ${name} keeps its IDREFs`, async () => {
      const page = await s.browser.newPage();
      try {
        const seen = watch(page);
        await page.goto(s.origin + "/idrefs");
        await page.waitForLoadState("networkidle");
        const root = `#ir-${name}`;
        // Compare surviving SSR nodes by identity, so an overlay mounted later is not compared to absent server content.
        const snapshot = () =>
          page.evaluate((root) => {
            const nodes = [...document.querySelectorAll(root + " [id]")];
            (window as any).__idrefs = nodes.map((el) => [el, el.id]);
            return nodes.length;
          }, root);
        assert.ok((await snapshot()) > 0, "fixture has generated server ids");
        await page.click(`${root} ${selector}`);
        if (name === "combo") await page.keyboard.press("ArrowDown");
        await page.waitForSelector(name === "tabs" || name === "list" ? `${root} ${ready}` : ready);
        await page.waitForTimeout(300);
        const result = await page.evaluate((root) => {
          const moved = ((window as any).__idrefs as [Element, string][])
            .filter(([el, id]) => el.isConnected && el.id !== id)
            .map(([el, id]) => `${id} -> ${el.id}`);
          const dangling: string[] = [];
          const nodes = [
            ...document.querySelectorAll(root + " *"),
            ...document.querySelectorAll("[role=listbox] *, [role=menu] *, [role=listbox], [role=menu]"),
          ];
          for (const el of nodes)
            for (const name of ["aria-labelledby", "aria-describedby", "aria-controls", "aria-activedescendant", "for"])
              for (const id of (el.getAttribute(name) ?? "").split(/\s+/).filter(Boolean)) {
                // An unselected tab's panel is intentionally unmounted (upstream Tabs behaviour).
                if (name === "aria-controls" && el.getAttribute("role") === "tab" && el.getAttribute("aria-selected") !== "true") continue;
                if (!document.getElementById(id)) dangling.push(`${el.id} ${name} -> ${id}`);
              }
          return { moved, dangling };
        }, root);
        assert.deepEqual(result, { moved: [], dangling: [] });
        assert.deepEqual(seen.errors, []);
      } finally {
        await page.close();
      }
    });
});
