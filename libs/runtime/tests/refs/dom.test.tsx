// DOM-target suite for element refs. Run by ../refs.test.ts through the register hook.
import "../testing/happy-dom.ts";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { render, fire, flush, cleanup } from "@rivetjs/runtime/testing";
import { Canvas, Form, Toggle, Swap, List, open, which, log } from "./components.tsx";

afterEach(() => {
  cleanup();
  log.length = 0;
});

test("ref(): undefined during setup, the element after mount; a clientEffect reading it sees the element", async () => {
  const view = render(() => <Canvas />);
  await flush();
  assert.deepEqual(log, ["setup:undefined", "effect:CANVAS"]);
  assert.equal(view.find("canvas").id, "c");
});

test("ref forwarded through a component prop; an absent forwarded ref is ignored; callback refs still run", async () => {
  const view = render(() => <Form />);
  await flush();
  assert.equal(view.find("output").textContent, "true");
  fire(view.find("button"), "click");
  assert.equal(document.activeElement, view.find("input"));
});

test("a ref inside Show: an effect reading it re-runs when the element attaches", async () => {
  open.set(false);
  render(() => <Toggle />);
  await flush();
  assert.deepEqual(log, ["panel:none"]);
  open.set(true);
  await flush();
  assert.deepEqual(log, ["panel:none", "panel:panel"]);
  // Unmount resets the ref; the effect sees undefined.
  open.set(false);
  await flush();
  assert.deepEqual(log, ["panel:none", "panel:panel", "panel:none"]);
});

test("a ref moving between Show branches ends on the new element, never cleared by the old one", async () => {
  which.set(true);
  render(() => <Swap />);
  await flush();
  assert.equal(log.at(-1), "box:a", log.join());
  which.set(false);
  await flush();
  assert.equal(log.at(-1), "box:b", log.join());
  which.set(true);
  await flush();
  assert.equal(log.at(-1), "box:a", log.join());
});

test("one ref per For row", async () => {
  const view = render(() => <List />);
  const [a, b] = [...view.container.querySelectorAll("li")] as HTMLLIElement[];
  fire(b!, "click");
  assert.equal(b!.dataset.hit, "b");
  assert.equal(a!.dataset.hit, undefined);
});
