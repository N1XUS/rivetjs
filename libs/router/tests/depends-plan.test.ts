// Client bookkeeping of `event.depends()` keys and what `invalidate(key)` reruns (layouts.ts), with
// browser globals stubbed: kept loaders keep their recorded keys, unknown keys rerun everything,
// apps without a layout table rerun everything on any match.
import { test } from "vitest";
import assert from "node:assert/strict";

const g = globalThis as Record<string, unknown>;
g.document = {};
g.location = { href: "http://x.test/shop/a" };
const { _depsLoaded, _plan, _stale } = await import("../client/layouts.ts");
import type { LayoutTable, Layouts } from "../client/layouts.ts";

const url = (path: string) => new URL("http://x.test" + path);
const is = (key: string) => (k: string) => k === key;
const table: LayoutTable = { ids: ["/", "/shop"], params: [[], []], kind: [3, 3], root: 0, routes: [["/shop/:p", [0, 1]], ["/plain", [0]]] };

test("keys unknown (no record, or kept loaders never seen): no plan", () => {
  assert.equal(_plan(undefined, table, url("/shop/a"), is("cart")), undefined);
  _depsLoaded(url("/shop/a"), 3, undefined, [0]);
  assert.equal(_plan(undefined, table, url("/shop/a"), is("cart")), undefined);
});

test("resumed layout state seeds the keys of the server render", () => {
  // Nothing recorded yet (resumed page before any client load).
  const state = { k: [], l: [], at: "/plain", x: [], dk: [["session"], undefined] } as unknown as Layouts;
  assert.deepEqual(_plan(state, table, url("/plain"), is("session")), { any: true, page: false, drop: new Set(["/"]) });
});

test("layout and page matches; kept loaders keep their keys across navigation", () => {
  _depsLoaded(url("/shop/a"), 3, [["session"], ["cart"], ["/api/a"]]);
  assert.deepEqual(_plan(undefined, table, url("/shop/a"), is("cart")), { any: true, page: false, drop: new Set(["/shop"]) });
  assert.deepEqual(_plan(undefined, table, url("/shop/a"), (k) => k.startsWith("/api/")), { any: true, page: true, drop: new Set() });
  assert.deepEqual(_plan(undefined, table, url("/shop/a"), is("none")), { any: false, page: false, drop: new Set() });
  // Another URL than the recorded one: unknown.
  assert.equal(_plan(undefined, table, url("/shop/b"), is("cart")), undefined);
  // /shop/b kept both layouts: their keys carry over, the page's are the new ones.
  _depsLoaded(url("/shop/b"), 3, [undefined, undefined, ["/api/b"]], [0, 1]);
  assert.deepEqual(_plan(undefined, table, url("/shop/b"), (k) => k === "session" || k === "/api/b"), { any: true, page: true, drop: new Set(["/"]) });
});

test("no layout table: any match reruns everything", () => {
  _depsLoaded(url("/x"), 2, [["cart"], undefined]);
  assert.deepEqual(_plan(undefined, undefined, url("/x"), is("cart")), { any: true, page: true, drop: new Set() });
  assert.deepEqual(_plan(undefined, undefined, url("/x"), is("none")), { any: false, page: false, drop: new Set() });
});

test("stale data (form submit, invalidate()): no plan", () => {
  _depsLoaded(url("/x"), 1, [["cart"]]);
  _stale();
  assert.equal(_plan(undefined, undefined, url("/x"), is("cart")), undefined);
});
