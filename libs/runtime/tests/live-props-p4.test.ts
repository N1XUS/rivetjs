// Lane LIVE-PROPS P4 (gap 1): a native-element spread of an identifier (`<span {...rest}>`, rest = `splitProps` result over
// live props) follows the live getters. The compiler passes the object uncopied (`_spread(el, rest, 2)`); `_spread` reads it
// inside its effect, which reactivity releases at once when nothing was read (a plain object). Fixture `fixtures/live-props-p4.tsx`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost/" });
Object.assign(globalThis, {
  document: window.document,
  window,
  Node: window.Node,
  Element: window.Element,
  HTMLElement: window.HTMLElement,
  Text: window.Text,
  Comment: window.Comment,
  DocumentFragment: window.DocumentFragment,
  MutationObserver: window.MutationObserver,
  Event: window.Event,
});
const { createRoot, signal } = await import("@rivetjs/reactivity");
const { mount, _spread, _c } = await import("@rivetjs/runtime/dom");
const { splitProps, _p, _pg, _propsOf } = await import("@rivetjs/runtime/props");
const { Uses } = await import("./fixtures/live-props-p4.tsx");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const inRoot = (fn: () => void): (() => void) => {
  let stop = () => {};
  createRoot((dispose) => {
    stop = dispose;
    fn();
  });
  return stop;
};

test("_spread(el, rest, 2): live getters update in place; a plain object applies once", async () => {
  const v = signal("a");
  const props = _p((i: number) => (i === 0 ? v() : undefined));
  _pg(props, "title", 0);
  (props as Record<string, unknown>)["tone"] = "x";
  const [, rest] = splitProps(props, ["tone"]);
  const el = document.createElement("span");
  const plain = document.createElement("span");
  const stop = inRoot(() => {
    _spread(el, rest, 2);
    _spread(plain, { title: "p", id: "q" }, 2);
  });
  assert.equal(el.getAttribute("title"), "a");
  assert.equal(el.hasAttribute("tone"), false);
  assert.equal(plain.getAttribute("title"), "p");
  assert.equal(plain.id, "q");
  v.set("b");
  await tick();
  assert.equal(el.getAttribute("title"), "b");
  stop();
});

test("compiled: an identifier spread of live props follows the prop (lone, own props, next to an attribute)", async () => {
  const v = signal("a");
  const host = document.createElement("div");
  document.body.append(host);
  const stop = mount(() => Uses({ title: () => v() }) as never, host);
  const titles = () => ["span", "i", "b"].map((tag) => host.querySelector(tag)!.getAttribute("title"));
  const nodes = ["span", "i", "b"].map((tag) => host.querySelector(tag));
  assert.deepEqual(titles(), ["a", "a", "a"]);
  assert.equal(host.querySelector("b")!.getAttribute("data-x"), "1");
  assert.equal(host.querySelector("span")!.hasAttribute("tone"), false);
  v.set("b");
  await tick();
  assert.deepEqual(titles(), ["b", "b", "b"]);
  assert.deepEqual(
    ["span", "i", "b"].map((tag, i) => host.querySelector(tag) === nodes[i]),
    [true, true, true],
    "elements kept",
  );
  stop();
});

test("gap 4: `_c(_propsOf, props)` (resumed live props recipe) returns the props object, also in development", () => {
  const props = { a: 1 };
  let out: unknown;
  const stop = inRoot(() => {
    out = _c(_propsOf, props);
  });
  assert.equal(out, props);
  stop();
});

test("gap 5: the server entry has the `bindRef` twin of `/dom` (a server-compiled `.tsx` importing it links; a no-op)", async () => {
  const server = await import("@rivetjs/runtime/server");
  const dom = await import("@rivetjs/runtime/dom");
  assert.equal(typeof server.bindRef, "function");
  assert.equal(typeof dom.bindRef, "function");
  assert.equal(
    server.bindRef(null as never, () => assert.fail("never called on the server")),
    undefined,
  );
});
