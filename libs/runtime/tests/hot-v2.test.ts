// HMR (`hot.ts`) on compiled DOM output (the register hook's lowering): an update re-renders the
// instance in place inside its insertion, keeps its signal state by creation order, re-inserts the parent's eager children (same nodes, bindings still live) and leaves
// no stale nodes. Runs in both resolutions (projects `runtime` / `runtime-dev`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { signal } from "@rivetjs/reactivity";
import { mount } from "@rivetjs/runtime/dom";
import { App, update } from "./hot/v2-fixture.tsx";

const window = new Window({ url: "http://localhost/" });
const doc = window.document as unknown as Document;
// Re-renders after `mount` returned (the update) construct in the global document, as in a browser.
Object.assign(globalThis, { document: doc });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const click = (el: Element) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event);

test("hot update re-renders in place, keeps state and the parent's eager children", async () => {
  const host = doc.createElement("div");
  doc.body.append(host);
  const n = signal(1);
  const stop = mount(() => App({ n }), host);
  const text = () => host.textContent!.replace(/\s+/g, "");
  assert.equal(text(), "x:01");
  click(host.querySelector("p.a")!);
  await settle();
  assert.equal(text(), "x:11");
  const b = host.querySelector("b")!;
  update();
  await settle();
  // CardB took count's value (1), the same <b> moved into its output; CardA's nodes are gone.
  assert.ok(host.querySelector("p") === null);
  assert.equal(text(), "x=11");
  // Identity checks stay boolean: a failing assert would inspect the whole happy-dom graph.
  assert.ok(host.querySelector("section.b b") === b, "the parent's <b> is re-inserted, not rebuilt");
  n.set(2);
  await settle();
  assert.equal(text(), "x=12", "the eager child's binding (owned by the parent) is still live");
  click(host.querySelector("section.b")!);
  await settle();
  assert.equal(text(), "x=112", "the new implementation's handler runs");
  stop();
  assert.equal(host.childNodes.length, 0);
  await window.happyDOM.close();
});
