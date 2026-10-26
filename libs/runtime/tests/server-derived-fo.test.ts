import { test } from "vitest";
import assert from "node:assert/strict";
import { foNames, foRecords, foUrls } from "../server-derived-fo.ts";
import type { BoundaryRecord, FlushTail } from "../resume-format.ts";

// ZERO R6a: fetch-ahead gating by D5 listening records (`server-derived-fo.ts`).
const rec = (id: number, parent: number, flags: number, name: string): BoundaryRecord => [id, parent, flags, name, []];
const ids = (tail: FlushTail): number[] => foRecords(tail).map((r) => r[0]);

test("no D5 facts (no `e`): every record is fetched ahead (today)", () => {
  const tail: FlushTail = { b: [rec(1, -1, 1, "A"), rec(2, 1, 1, "B")] };
  assert.deepEqual(ids(tail), [1, 2]);
});

test("nothing listens and no trigger: nothing fetched ahead, not even the runtime", () => {
  const tail: FlushTail = { b: [rec(1, -1, 1, "Page"), rec(2, 1, 1, "Card")], e: {}, m: { Page: "/p.js", Card: "/c.js" } };
  assert.deepEqual(ids(tail), []);
  assert.deepEqual(foUrls(tail, "/rt.js", { "/rt.js": ["/core.js"] }, []), []);
});

test("a listening independent record: its chunk only; a dependent one: its parent chain too", () => {
  const b = [rec(1, -1, 1, "Page"), rec(2, 1, 1, "Button"), rec(3, 1, 0, "Inner"), rec(4, 3, 0, "Leaf")];
  assert.deepEqual(ids({ b, e: { Button: "click" } }), [2]);
  assert.deepEqual(ids({ b, e: { Leaf: "click" } }), [1, 3, 4]);
});

test("triggers, document click listeners, wake sources / readers and MOD records are kept", () => {
  const b = [rec(1, -1, 1, "Page"), rec(2, 1, 1 | 64, "Idle"), rec(3, 1, 1, "Source"), rec(4, 1, 1, "Reader"), rec(5, 1, 1 | 512, "Mod"), rec(6, 1, 1, "Dead")];
  assert.deepEqual(ids({ b, e: {} }), [2, 5]);
  assert.deepEqual(ids({ b, e: {}, g: [[1, "a[href]"]] }), [1, 2, 5]);
  // Reader 4 listens and read Source 3's key: the source adopts first.
  assert.deepEqual(ids({ b, e: { Reader: "click" }, w: { "3.k": [4] } }), [2, 3, 4, 5]);
  // Source 3 listens: a write wakes Reader 4.
  assert.deepEqual(ids({ b, e: { Source: "click" }, w: { "3.k": [4] } }), [2, 3, 4, 5]);
});

test("foUrls: runtime + kept names' chunks + islands, each with its static closure, deduplicated", () => {
  const tail: FlushTail = {
    b: [rec(1, -1, 1, "Page"), rec(2, 1, 1, "Button"), rec(3, 1, 1, "Static")],
    e: { Button: "click" },
    m: { Page: "/page.js", Button: "/button.js", Static: "/static.js" },
  };
  const deps = { "/rt.js": ["/core.js"], "/button.js": ["/press.js", "/core.js"] };
  assert.deepEqual(foUrls(tail, "/rt.js", deps, []), ["/rt.js", "/core.js", "/button.js", "/press.js"]);
  assert.deepEqual(foUrls({ b: tail.b, e: {}, m: tail.m }, "/rt.js", deps, ["/island.js"]), ["/rt.js", "/core.js", "/island.js"]);
});

test("foNames: the names of foRecords (small flushes take the bit-mask path, ZERO REGRESS), random tails", () => {
  let seed = 7;
  const rand = (n: number): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n);
  for (let round = 0; round < 400; round++) {
    const len = 1 + rand(round < 300 ? 31 : 60),
      b: BoundaryRecord[] = [],
      e: Record<string, string> = {},
      w: Record<string, number[]> = {};
    for (let i = 1; i <= len; i++) {
      const flags = (rand(2) ? 1 : 0) | (rand(9) ? 0 : [32, 64, 128, 512][rand(4)]!);
      b.push(rec(i, i === 1 ? 0 : 1 + rand(i - 1), flags, "N" + rand(Math.min(len, 12))));
    }
    for (let i = 0; i < 4; i++) if (rand(2)) e["N" + rand(12)] = "click";
    for (let i = 0, n = rand(4); i < n; i++) w[1 + rand(len) + ".k" + i] = [1 + rand(len), 1 + rand(len)];
    const tail: FlushTail = { b, e, w, ...(rand(4) ? {} : { g: [[1, "a[href]"]] as [number, string][] }) };
    assert.deepEqual([...foNames(tail)].sort(), [...new Set(foRecords(tail).map((r) => r[3]))].sort(), "round " + round);
  }
});
