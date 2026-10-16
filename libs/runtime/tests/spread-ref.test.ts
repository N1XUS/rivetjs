// `ref` inside `{...spread}` is applied like an explicit `ref={…}` attribute (Plan 2 Task 2).
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
const { signal } = await import("@rivetjs/reactivity");
const { mount, ref } = await import("../dom.ts");
const { Probe } = await import("./fixtures/spread-ref.tsx");

const render = (props: Record<string, unknown>): { el: HTMLElement; stop: () => void } => {
  const host = document.createElement("div");
  document.body.append(host);
  const stop = mount(() => Probe({ props }) as never, host);
  return { el: host.firstElementChild as HTMLElement, stop };
};

test("spread: a `ref` object key is set to the element (and reset on unmount)", () => {
  const r = ref<HTMLElement>();
  const { el, stop } = render({ ref: r, id: "x" });
  assert.equal(r(), el);
  assert.equal(el.id, "x");
  stop();
  assert.equal(r(), undefined);
});

test("spread: a `ref` callback runs once with the element; the key is never written as an attribute", () => {
  const seen: unknown[] = [];
  const { el } = render({ ref: (e: HTMLElement) => seen.push(e), id: "y" });
  assert.deepEqual(seen, [el]);
  assert.equal(el.hasAttribute("ref"), false);
});

test("spread: ref plus an accessor attribute: an update keeps the element and does not call ref again", async () => {
  const cls = signal("a");
  let calls = 0;
  const { el, stop } = render({ ref: () => void calls++, class: () => cls() });
  cls.set("b");
  await Promise.resolve();
  assert.equal(el.className, "b");
  assert.equal(calls, 1);
  stop();
});

test("spread: a `ref()` signal stays set across accessor re-runs (cleanup belongs to the spread's owner)", async () => {
  const r = ref<HTMLElement>();
  const cls = signal("a");
  const { el, stop } = render({ ref: r, class: () => cls() });
  cls.set("b");
  await Promise.resolve();
  assert.equal(r(), el);
  stop();
  assert.equal(r(), undefined);
});

// React semantics: `<a {...p} ref={x}>` attaches only `x` (the later prop wins): the compiler appends `ref: undefined` to the
// spread object (live-props-p4).
test("explicit ref next to a spread ref binds once, later wins", async () => {
  const { Both } = await import("./fixtures/spread-ref-both.tsx");
  const host = document.createElement("div");
  document.body.append(host);
  const calls: string[] = [];
  mount(() => Both({ props: { ref: () => calls.push("spread") }, explicit: () => calls.push("explicit") }) as never, host);
  assert.deepEqual(calls, ["explicit"]);
});
