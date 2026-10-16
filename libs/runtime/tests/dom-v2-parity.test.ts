// DOM v2 parity fixes (round-2 review C1, C15): boolean attributes follow truthiness like the server; `_for` rejects a new key equal to a kept prefix / suffix row's key.
import { test } from "vitest";
import assert from "node:assert/strict";
import { withPage } from "./resume/harness.ts";
import { encodeAttributeValue } from "../template.ts";

const VALUES: [string, unknown][] = [
  ["0", 0],
  ["empty", ""],
  ["NaN", NaN],
  ["false", false],
  ["null", null],
  ["1", 1],
  ["str", "x"],
  ["true", true],
];
// Server: whether each value renders the boolean attribute (the reference).
const server = Object.fromEntries(VALUES.map(([label, value]) => [label, encodeAttributeValue("disabled", value as never) !== ""]));

const unit = `
import { _tpl, _attrValue, _attrWrite } from "/dom.ts";
import { _spread, _for, _insert } from "/dom-v2.ts";
import { signal, createRoot, effect } from "/reactivity.mjs";
const VALUES = [["0", 0], ["empty", ""], ["NaN", NaN], ["false", false], ["null", null], ["1", 1], ["str", "x"], ["true", true]];
export function booleans() {
  const out = { v2: {}, write: {}, spread: {}, property: {} };
  for (const [label, value] of VALUES) {
    const a = _tpl("<button>b</button>")(); _attrValue(a, "disabled", value); out.v2[label] = a.hasAttribute("disabled");
    out.property[label] = a.disabled;
    const b = _tpl("<button>b</button>")(); b.setAttribute("disabled", ""); _attrWrite(b, "disabled", value); out.write[label] = b.hasAttribute("disabled");
    const c = _tpl("<button>b</button>")(); _spread(c, { disabled: value }); out.spread[label] = c.hasAttribute("disabled");
  }
  // hidden keeps its enumerated keyword; "" / 0 omit it.
  const h = _tpl("<div></div>")(); _attrValue(h, "hidden", "until-found"); out.hiddenKeyword = h.getAttribute("hidden");
  const z = _tpl("<div></div>")(); _attrValue(z, "hidden", 0); out.hiddenZero = z.hasAttribute("hidden");
  return JSON.stringify(out);
}
export function duplicateKeys() {
  const results = [];
  const attempt = (first, second) => {
    const list = signal(first), ul = document.createElement("ul");
    let error = null;
    const root = createRoot((dispose) => {
      _insert(ul, _for({ each: list, by: (r) => r.id, children: (item) => { const li = document.createElement("li"); li.textContent = item().id; return li; } }));
      return dispose;
    });
    try { list.set(second); } catch (e) { error = e.message; }
    results.push([error, ul.textContent]);
    root.value();
  };
  const a = { id: "a" }, b = { id: "b" }, c = { id: "c" };
  attempt([a, b], [a, { id: "a" }, b]); // new middle key equals the kept prefix key
  attempt([a, b], [a, { id: "b" }, b]); // equals the kept suffix key
  attempt([a, b], [a, c, b]); // unique: fine
  attempt([a, b, c], [a, { id: "x" }, { id: "x" }, c]); // duplicate inside the middle (existing check)
  return JSON.stringify(results);
}
// Length-changing updates where an equal suffix item moves to another index: with an index-keyed \`by\` the kept row's key
// would go stale (the new middle row then took it: "Duplicate For key"). Each step: [error, text, reused] — reused = for each
// new row, the old row index whose node it kept (-1: created).
export function movedSuffix() {
  const run = (by, steps) => {
    const list = signal(steps[0]), ul = document.createElement("ul"), out = [];
    const root = createRoot((dispose) => {
      _insert(ul, _for({ each: list, by, children: (item, index) => { const li = document.createElement("li"); effect(() => { li.textContent = (item().id ?? item()) + index(); }); return li; } }));
      return dispose;
    });
    for (let s = 1; s < steps.length; s++) {
      const before = Array.from(ul.children);
      let error = null;
      try { list.set(steps[s]); } catch (e) { error = e.message; }
      out.push([error, Array.from(ul.children, (li) => li.textContent).join(" "), Array.from(ul.children, (li) => before.indexOf(li))]);
    }
    root.value();
    return out;
  };
  const byIndex = (_, i) => i, byId = (r) => r.id;
  const o = {};
  for (const id of "abcxy") o[id] = { id };
  const ids = (s) => Array.from(s, (c) => o[c]);
  const seq = ["ab", "axb", "axyb", "b", "ab", "xab", "ab", "abc", "cba", "ca", "c"];
  return JSON.stringify({
    index: run(byIndex, seq.map((s) => Array.from(s))),
    item: run(byId, seq.map(ids)),
    // Index-keyed objects (Markdown live words): same items, index keys.
    indexObjects: run(byIndex, seq.map(ids)),
    // A key from item + index.
    mixed: run((r, i) => r + i, seq.map((s) => Array.from(s))),
  });
}
`;

test("dom v2: boolean attributes follow truthiness (server / v2 / spread parity)", async () => {
  await withPage({ "/": "<!doctype html><body></body>", "/unit.mjs": unit }, async (page) => {
    await page.goto("http://rivet.test/");
    const out = JSON.parse(await page.evaluate(async () => ((await import("/unit.mjs" as string)) as { booleans(): string }).booleans()));
    assert.deepEqual(server, { "0": false, empty: false, NaN: false, false: false, null: false, "1": true, str: true, true: true });
    assert.deepEqual(out.v2, server);
    assert.deepEqual(out.write, server);
    assert.deepEqual(out.spread, server);
    assert.deepEqual(out.property, server);
    assert.equal(out.hiddenKeyword, "until-found");
    assert.equal(out.hiddenZero, false);
  });
});

test("dom v2: _for rejects a new key equal to a kept prefix / suffix key", async () => {
  await withPage({ "/": "<!doctype html><body></body>", "/unit.mjs": unit }, async (page) => {
    await page.goto("http://rivet.test/");
    const out = JSON.parse(await page.evaluate(async () => ((await import("/unit.mjs" as string)) as { duplicateKeys(): string }).duplicateKeys()));
    assert.deepEqual(out, [
      ["Duplicate For key", "ab"],
      ["Duplicate For key", "ab"],
      [null, "acb"],
      ["Duplicate For key", "abc"],
    ]);
  });
});

test("dom v2: _for keeps a moved suffix row only when its key holds (index-keyed by)", async () => {
  await withPage({ "/": "<!doctype html><body></body>", "/unit.mjs": unit }, async (page) => {
    await page.goto("http://rivet.test/");
    const out = JSON.parse(await page.evaluate(async () => ((await import("/unit.mjs" as string)) as { movedSuffix(): string }).movedSuffix()));
    const texts = ["a0 x1 b2", "a0 x1 y2 b3", "b0", "a0 b1", "x0 a1 b2", "a0 b1", "a0 b1 c2", "c0 b1 a2", "c0 a1", "c0"];
    for (const name of ["index", "item", "indexObjects", "mixed"])
      assert.deepEqual(
        out[name].map(([error, text]: [string | null, string]) => [error, text]),
        texts.map((text) => [null, text]),
        name,
      );
    // Index keys: rows stay by position (an update in place), new positions are created.
    assert.deepEqual(
      out.index.map((step: unknown[]) => step[2]),
      [[0, 1, -1], [0, 1, 2, -1], [0], [0, -1], [0, 1, -1], [0, 1], [0, 1, -1], [0, 1, 2], [0, 1], [0]],
    );
    assert.deepEqual(
      out.indexObjects.map((step: unknown[]) => step[2]),
      out.index.map((step: unknown[]) => step[2]),
    );
    // Item keys: rows follow their item.
    assert.deepEqual(
      out.item.map((step: unknown[]) => step[2]),
      [[0, -1, 1], [0, 1, -1, 2], [3], [-1, 0], [-1, 0, 1], [1, 2], [0, 1, -1], [2, 1, 0], [0, 2], [0]],
    );
  });
});
