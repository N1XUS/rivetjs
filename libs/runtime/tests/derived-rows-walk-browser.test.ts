// Per-event walks after boot (KEYDOWN 2026-11-06): the loader's `ids` and the runtime's `enclosing` scanned every earlier
// sibling of each ancestor on every event (a pointerdown on row 900 of 1,000: ~1.4 ms at 4x CPU). A sole list's row
// openers carry `$rs` once its rows are built, and both walks stop there. Pins: an event in a late row reads a bounded
// number of siblings, and a row boundary whose `<!--bN-->` opener sits at the list's level still adopts on its first click.
// Fixture: `tests/derived/rows-walk.{server,dom}.tsx`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const fixture = (name: string): Promise<string> => readFile(new URL("./derived/" + name, import.meta.url), "utf8");
const manifest = { hash: "t", runtime: "/rt.js", symbols: { App: "/page.js", Tag: "/page.js" } };

async function files(): Promise<Record<string, string>> {
  const out = compile(await fixture("rows-walk.server.tsx"), { target: "server", filename: "rows-walk.server.tsx" });
  assert.deepEqual(out.diagnostics, []);
  const { App } = await importServer<{ App: () => ServerValue }>(out.code);
  const dom = compile(await fixture("rows-walk.dom.tsx"), { target: "dom", filename: "rows-walk.dom.tsx" });
  assert.deepEqual(dom.diagnostics, []);
  return {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + ((await derivedToString(() => App(), { manifest })) as string) + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/page.js": rewrite(dom.code),
  };
}

test("events in a late row of a sole list walk a bounded number of siblings; its row boundary still adopts", async () => {
  await withPage(await files(), async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("http://rivet.test/");
    // Adopt App (the list's unit): its rows are built at idle.
    await page.click("#bump");
    await page.waitForFunction(() => document.querySelector("#bump")!.textContent === "1");
    await page.waitForTimeout(300);
    // A first click in row 280 adopts its Tag (opener at the list's level) and reaches its handler.
    await page.click("#row-280 .tag");
    await page.waitForFunction(() => document.querySelector("#row-280 .tag")!.textContent === "t280*", null, { timeout: 2000 }).catch(() => {});
    assert.equal(await page.textContent("#row-280 .tag"), "t280*");
    // Sibling reads of one pointerdown + click in row 290 (base: every earlier row's nodes, ~870 per walk, several walks).
    const reads = await page.evaluate(() => {
      const d = Object.getOwnPropertyDescriptor(Node.prototype, "previousSibling")!;
      let n = 0;
      Object.defineProperty(Node.prototype, "previousSibling", {
        configurable: true,
        get: function (this: Node) {
          return (n++, d.get!.call(this));
        },
      });
      const el = document.querySelector("#row-290 .tag")!;
      try {
        el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, pointerType: "mouse", isPrimary: true }));
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
      } finally {
        Object.defineProperty(Node.prototype, "previousSibling", d);
      }
      return n;
    });
    assert.ok(reads < 200, `previousSibling reads: ${reads}`);
    await page.waitForFunction(() => document.querySelector("#row-290 .tag")!.textContent === "t290*", null, { timeout: 2000 }).catch(() => {});
    assert.equal(await page.textContent("#row-290 .tag"), "t290*");
    assert.deepEqual(errors, []);
  });
});

test("rows built on demand (no idle build): an unbuilt row's index counts from the nearest built row before it", async () => {
  await withPage(await files(), async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.addInitScript(() => void ((window as unknown as Record<string, unknown>).requestIdleCallback = () => 0));
    await page.goto("http://rivet.test/");
    await page.click("#bump");
    await page.waitForFunction(() => document.querySelector("#bump")!.textContent === "1");
    // 280 is built first; 290 and 285 then stop their walks at a built row and count from it; 3 has none before it.
    for (const id of [280, 290, 285, 3]) {
      await page.click(`#row-${id} .tag`);
      await page.waitForFunction((id) => document.querySelector(`#row-${id} .tag`)!.textContent === `t${id}*`, id, { timeout: 2000 }).catch(() => {});
      assert.equal(await page.textContent(`#row-${id} .tag`), `t${id}*`);
    }
    assert.equal(await page.evaluate(() => document.querySelectorAll(".tag").length), 300);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll(".tag")].filter((b) => b.textContent!.endsWith("*")).length), 4);
    assert.deepEqual(errors, []);
  });
});

// One walk per event (KEYS 2026-11-10): once the runtime runs, the loader's merged capture listener asks it three times
// about one event — intent (`rt.w`), its listening records (`rt.i`, in place of the loader's own `ids` walk), the live run
// (`rt.on` → `around`) — and the runtime walks the target's ancestors and their earlier siblings once for all three (base:
// three walks for a keydown / pointerdown / focusin, two for an input).
test("after boot, one event walks its target's ancestors once", async () => {
  await withPage(await files(), async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("http://rivet.test/");
    await page.click("#bump");
    await page.waitForFunction(() => document.querySelector("#bump")!.textContent === "1");
    await page.waitForTimeout(300);
    const reads = await page.evaluate(() => {
      const el = document.querySelector("#bump")!;
      // One walk: each ancestor's earlier siblings, up to the null that ends the scan.
      let walk = 0;
      for (let n: Node | null = el; n && n.nodeType !== 9; n = n.parentNode) for (let s = n.previousSibling; ; s = s.previousSibling) if ((walk++, !s)) break;
      const d = Object.getOwnPropertyDescriptor(Node.prototype, "previousSibling")!;
      const out: Record<string, number> = { walk };
      let n = 0;
      Object.defineProperty(Node.prototype, "previousSibling", {
        configurable: true,
        get: function (this: Node) {
          return (n++, d.get!.call(this));
        },
      });
      try {
        for (const [type, make] of [
          ["keydown", () => new KeyboardEvent("keydown", { bubbles: true, composed: true, key: "x", code: "KeyX" })],
          ["pointerdown", () => new PointerEvent("pointerdown", { bubbles: true, composed: true, pointerType: "mouse", isPrimary: true })],
          ["focusin", () => new FocusEvent("focusin", { bubbles: true, composed: true })],
          ["input", () => new InputEvent("input", { bubbles: true, composed: true })],
        ] as const) {
          n = 0;
          el.dispatchEvent(make());
          out[type] = n;
        }
      } finally {
        Object.defineProperty(Node.prototype, "previousSibling", d);
      }
      return out;
    });
    for (const type of ["keydown", "pointerdown", "focusin", "input"])
      assert.ok(reads[type]! <= reads.walk!, `${type}: ${reads[type]} reads, one walk ${reads.walk}`);
    assert.ok(reads.walk! > 3, "the button has earlier siblings to scan");
    assert.equal(await page.textContent("#bump"), "1");
    assert.deepEqual(errors, []);
  });
});
