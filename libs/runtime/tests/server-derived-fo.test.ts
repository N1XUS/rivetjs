import { test } from "vitest";
import assert from "node:assert/strict";
import { foRecords, foUrls } from "../server-derived-fo.ts";
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
