// HMR on a resumed page (dev server): a hot-wrapped component inside a re-created region renders during the region
// read, so it gets the server's `_regionState` values and its For adopts the server rows (no entrance replay of
// server-rendered rows, the motion PresenceFor stack). Runs in both resolutions (projects `runtime` / `runtime-dev`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createRoot, signal } from "@rivetjs/reactivity";
import { _region, type AdoptedRow } from "../dom-adopt.ts";
import { Stack } from "./hot/region-fixture.tsx";

const window = new Window({ url: "http://localhost/" });
const doc = window.document as unknown as Document;
Object.assign(globalThis, { document: doc });

test("a hot-wrapped component re-created by a resumed region adopts the server state and rows", async () => {
  // Server content: <!--[--><ul><!--r-->li 1<!--/r--><!--r-->li 2<!--/r--></ul><!--]-->
  const host = doc.createElement("div");
  doc.body.append(host);
  const start = doc.createComment("[");
  const end = doc.createComment("]");
  const ul = doc.createElement("ul");
  const rows: AdoptedRow[] = [];
  const lis: Element[] = [];
  for (const n of [1, 2]) {
    const a = doc.createTextNode(""),
      b = doc.createTextNode(""),
      li = doc.createElement("li");
    li.textContent = String(n);
    ul.append(a, li, b);
    lis.push(li);
    rows.push({ item: n, index: n - 1, flags: 0, start: a, end: b, dispose: () => {} });
  }
  host.append(start, ul, end);
  const items = signal([1, 2]);
  const log: string[] = [];
  let took = false;
  const root = createRoot((dispose) => {
    took = _region(start, end, () => Stack({ items, log }), rows, null, { values: [{ from: "server" }], nested: undefined });
    return dispose;
  });
  assert.deepEqual(log, ["server"], "the region read's `_regionState` value reached the hot component");
  assert.ok(took, "the hot component's For took the server rows");
  const kept = Array.from(host.querySelectorAll("li"));
  assert.ok(kept.length === 2 && kept[0] === lis[0] && kept[1] === lis[1], "server rows kept, not re-created");
  items.set([1, 2, 3]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(host.textContent, "123");
  assert.ok(host.querySelectorAll("li")[0] === lis[0], "an add keeps the adopted rows");
  root.dispose();
  await window.happyDOM.close();
});
