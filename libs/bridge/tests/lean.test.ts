// T7b lean islands on the derived model: `leanValues` (which hydrated islands boot from the lean script: plain JSON
// props, a getter reading no signal is its value) and `derivedLean` (records + inline boot); the generated boot is
// current. Pages end to end: `derived-browser.test.ts`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { computed, signal } from "@rivetjs/reactivity";
import { BOOT } from "../boot.min.ts";
import { minifiedBoot } from "../build-boot.ts";
import { derivedLean, leanValues } from "../lean.ts";

test("leanValues: plain JSON props are the island's values; getters that read no signal are sent as their value", () => {
  const rows = [1, 2];
  const props = Object.defineProperty({ count: 1, data: { a: [1, "x", null, true] } }, "values", { get: () => rows.map((n) => n * 2), enumerable: true });
  assert.deepEqual(leanValues("load", props, null), { count: 1, data: { a: [1, "x", null, true] }, values: [2, 4] });
});

test("leanValues: a signal read (direct or through a computed), a function, a non-JSON value, no policy or a block keep the full driver", () => {
  const n = signal(2);
  const double = computed(() => n() * 2);
  const live = (read: () => unknown) => Object.defineProperty({}, "count", { get: read, enumerable: true });
  assert.match(
    leanValues(
      "load",
      live(() => n()),
      null,
    ) as string,
    /prop "count" is live/,
  );
  assert.match(
    leanValues(
      "load",
      live(() => double()),
      null,
    ) as string,
    /prop "count" is live/,
  );
  assert.match(leanValues("load", { onPick: () => 1 }, null) as string, /is a function/);
  assert.match(leanValues("load", { when: new Date(0) }, null) as string, /not a plain JSON value/);
  assert.match(leanValues(undefined, { count: 1 }, null) as string, /without a client policy/);
  assert.equal(leanValues("load", { count: 1 }, 'slot "default" holds Rivet content'), 'slot "default" holds Rivet content');
});

test("derivedLean: records with the chunk closure for prefetched policies, nonce on both scripts, islands without a chunk left out", () => {
  const manifest = { islands: { "src/C.fake#default": "/c/c.js" }, deps: { "/c/c.js": ["/c/vendor.js"] } };
  const html = derivedLean(
    [
      { id: "i0", key: "src/C.fake#default", on: "load", props: { count: 1 } },
      { id: "i1", key: "src/C.fake#default", on: "interaction", props: { count: 2 } },
      { id: "i2", key: "src/Missing.fake#default", on: "load", props: {} },
      { id: "i3", key: "src/C.fake#default", on: "load", props: null },
    ],
    manifest,
    "abc",
  );
  const records = [
    ["i0", "/c/c.js", { count: 1 }, "load", ["/c/c.js", "/c/vendor.js"]],
    ["i1", "/c/c.js", { count: 2 }, "interaction"],
  ];
  assert.equal(html, `<script type="rivet/islands" nonce="abc">${JSON.stringify(records)}</script><script nonce="abc">${BOOT}</script>`);
  assert.equal(derivedLean([{ id: "i0", key: "src/Missing.fake#default", on: "load", props: {} }], manifest, ""), "");
});

test("boot.min.ts is current (node libs/bridge/build-boot.ts)", async () => {
  assert.equal(BOOT, await minifiedBoot());
});
