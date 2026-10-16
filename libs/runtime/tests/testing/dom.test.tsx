// DOM-target suite for @rivetjs/runtime/testing. Run by ../testing.test.ts through the register hook.
import "./happy-dom.ts";
import { afterEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createId } from "@rivetjs/runtime/id";
import { render, fire, flush, cleanup } from "@rivetjs/runtime/testing";
import { Counter, Width, Greeting, Form, log } from "./components.tsx";

afterEach(() => {
  cleanup();
  log.length = 0;
});

test("render mounts into an auto-created container; html() drops range markers; unmount disposes", () => {
  const view = render(() => <Counter start={1} />);
  assert.equal(view.container.parentNode, document.body);
  assert.equal(view.html(), '<div class="counter"><button>+2</button><output>1</output></div>');
  assert.equal(view.find("output").textContent, "1");
  assert.throws(() => view.find("nav"), /find\("nav"\): no match/);
  view.unmount();
  assert.deepEqual(log, ["counter cleanup"]);
  assert.equal(view.container.parentNode, null);
  view.unmount();
  assert.deepEqual(log, ["counter cleanup"]);
});

test("render into a given container leaves the container in place", () => {
  const host = document.createElement("main");
  document.body.append(host);
  const view = render(() => <Counter start={0} />, { container: host });
  assert.equal(view.container, host);
  view.unmount();
  assert.equal(host.parentNode, document.body);
  assert.equal(host.innerHTML, "");
  host.remove();
});

test("fire dispatches a real event; batched handler writes are visible on return", () => {
  const view = render(() => <Counter start={0} />);
  const seen: string[] = [];
  view.container.addEventListener("click", (event) => seen.push(event.constructor.name + ":" + event.bubbles));
  assert.equal(fire(view.find("button"), "click"), true);
  assert.equal(view.find("output").textContent, "2");
  assert.deepEqual(seen, ["MouseEvent:true"]);
});

test("fire returns false when a handler prevents the default; input events read the element value", () => {
  const view = render(() => <Form />);
  const input = view.find<HTMLInputElement>("input");
  input.value = "rivet";
  fire(input, "input");
  assert.equal(view.find("span").textContent, "RIVET");
  assert.equal(fire(view.find("form"), "submit"), false);
});

test("flush runs clientEffect; cleanup disposes every rendered tree", async () => {
  const view = render(() => <Width />);
  render(() => <Counter start={0} />);
  assert.equal(view.html(), "<p>pending</p>");
  await flush();
  assert.equal(view.html(), "<p>mounted</p>");
  cleanup();
  assert.deepEqual(log.sort(), ["counter cleanup", "effect cleanup"]);
  assert.equal(document.body.innerHTML, "");
});

test("flush commits a resolved Async region", async () => {
  const view = render(() => <Greeting name={Promise.resolve("dom")} />);
  assert.equal(view.html(), "<section><i>loading</i></section>");
  await flush();
  assert.equal(view.html(), "<section><b>hello dom</b></section>");
});

test("flush settles under fake timers (node:test mock timers) without advancing them", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const view = render(() => <Width />);
    let fired = false;
    setTimeout(() => (fired = true), 0);
    await flush();
    assert.equal(view.html(), "<p>mounted</p>");
    assert.equal(fired, false);
    mock.timers.tick(0);
    assert.equal(fired, true);
  } finally {
    mock.timers.reset();
  }
});

test("fire uses each type's browser defaults: focus / mouseenter don't bubble, custom events are plain", () => {
  const view = render(() => <Form />);
  const seen: string[] = [];
  for (const type of ["focus", "mouseenter", "focusin", "rv-custom", "keydown"])
    view.container.addEventListener(type, (event) => seen.push(type + ":" + event.constructor.name));
  const input = view.find("input");
  fire(input, "focus");
  fire(input, "mouseenter");
  fire(input, "focusin");
  fire(input, "rv-custom");
  fire(input, "keydown", { key: "a" });
  fire(input, "rv-custom", { bubbles: true });
  assert.deepEqual(seen, ["focusin:FocusEvent", "keydown:KeyboardEvent", "rv-custom:Event"]);
});

test("cleanup restarts the id counter, so ids don't depend on test order", () => {
  const first = createId();
  createId();
  cleanup();
  assert.equal(createId(), first);
});
