// DOM suite for Suspense and transitions (happy-dom). Run by ../suspense.test.ts through the register hook.
import "../testing/happy-dom.ts";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@rivetjs/reactivity";
import { startTransition, useTransition } from "@rivetjs/runtime/dom";
import { render, flush, cleanup } from "@rivetjs/runtime/testing";
import { Failing, Nested, Pair, Reload, Sync, Two, gate } from "./components.tsx";

afterEach(() => cleanup());
const text = (view: { container: Element | DocumentFragment }) => (view.container as Element).textContent;

test("Suspense shows one fallback until every Async below resolved, then reveals them together", async () => {
  const a = gate<string>(), b = gate<string>();
  const view = render(() => <Pair a={a.promise} b={b.promise} />);
  assert.equal(view.html(), '<main><p class="wait">loading</p></main>');
  a.resolve("A");
  await flush();
  assert.equal(view.html(), '<main><p class="wait">loading</p></main>', "a resolved alone stays hidden");
  b.resolve("B");
  await flush();
  assert.equal(view.html(), '<main><b class="a">A</b><b class="b">B</b></main>');
});

test("Suspense with synchronous content renders it at once", () => {
  const view = render(() => <Sync />);
  assert.equal(view.html(), "<b>now</b>");
});

test("a reload below a revealed Suspense hides the content (state kept) and shows the fallback again", async () => {
  const one = gate<string>(), two = gate<string>();
  const id = signal(1);
  const view = render(() => <Reload id={id} loads={{ 1: one.promise, 2: two.promise }} suspense />);
  one.resolve("one");
  await flush();
  assert.equal(view.find(".value").textContent, "one0");
  id.set(2);
  assert.equal(view.find(".wait").textContent, "loading");
  assert.equal(view.container.querySelector(".value"), null);
  two.resolve("two");
  await flush();
  assert.equal(view.find(".value").textContent, "two0");
  assert.equal(view.container.querySelector(".wait"), null);
});

test("nested Suspense: the inner one reveals on its own once the outer content is in", async () => {
  const outer = gate<string>(), inner = gate<string>();
  const view = render(() => <Nested outer={outer.promise} inner={inner.promise} />);
  assert.equal(view.html(), '<p class="outer-wait">outer</p>');
  inner.resolve("in");
  await flush();
  assert.equal(view.html(), '<p class="outer-wait">outer</p>', "the outer still waits");
  outer.resolve("out");
  await flush();
  assert.equal(view.html(), '<div><b class="outer">out</b><b class="inner">in</b></div>');
  const late = gate<string>(), first = gate<string>();
  const second = render(() => <Nested outer={first.promise} inner={late.promise} />);
  first.resolve("out");
  await flush();
  assert.equal(second.html(), '<div><b class="outer">out</b><p class="inner-wait">inner</p></div>');
  late.resolve("in");
  await flush();
  assert.equal(second.html(), '<div><b class="outer">out</b><b class="inner">in</b></div>');
});

test("a failed Async stops counting: an ErrorBoundary inside renders within the revealed content", async () => {
  const a = gate<string>(), b = gate<string>();
  const view = render(() => <Failing a={a.promise} b={b.promise} inside />);
  a.reject(new Error("a broke"));
  await flush();
  assert.equal(view.html(), '<p class="wait">loading</p>');
  b.resolve("B");
  await flush();
  assert.equal(view.html(), '<p class="caught">a broke</p><b class="b">B</b>');
});

test("a failed Async with an ErrorBoundary outside replaces the whole Suspense", async () => {
  const a = gate<string>(), b = gate<string>();
  const view = render(() => <Failing a={a.promise} b={b.promise} inside={false} />);
  a.reject(new Error("a broke"));
  await flush();
  assert.equal(view.html(), '<p class="caught">a broke</p>');
});

test("startTransition keeps the shown output (no fallback), commits on settle, sets pending", async () => {
  const one = gate<string>(), two = gate<string>();
  const id = signal(1), pending = signal(false);
  const view = render(() => <Reload id={id} loads={{ 1: one.promise, 2: two.promise }} pending={pending} />);
  one.resolve("one");
  await flush();
  // State inside the kept output survives until the commit.
  view.find("button").click();
  assert.equal(view.find(".value").textContent, "one1");
  let resolved = false;
  const done = startTransition(() => id.set(2), pending).then(() => (resolved = true));
  assert.equal(view.find(".pending").textContent, "yes");
  assert.equal(view.find(".value").textContent, "one1");
  assert.equal(view.container.querySelector(".fallback"), null);
  view.find("button").click();
  assert.equal(view.find(".value").textContent, "one2", "the old output stays live");
  await flush();
  assert.equal(resolved, false);
  two.resolve("two");
  await done;
  assert.equal(view.find(".value").textContent, "two2");
  assert.equal(view.find(".pending").textContent, "no");
  // Without a transition the reload shows the fallback.
  const three = gate<string>();
  const again = render(() => <Reload id={signal(3)} loads={{ 3: three.promise }} />);
  assert.equal(again.find(".fallback").textContent, "…");
});

test("a transition commits every joined Async in one step; a later start joins the pending one", async () => {
  const a1 = gate<string>(), b1 = gate<string>(), a2 = gate<string>(), b2 = gate<string>(), a3 = gate<string>(), b3 = gate<string>();
  const id = signal(1);
  const view = render(() => <Two id={id} a={{ 1: a1.promise, 2: a2.promise, 3: a3.promise }} b={{ 1: b1.promise, 2: b2.promise, 3: b3.promise }} />);
  a1.resolve("a1");
  b1.resolve("b1");
  await flush();
  const [pending, start] = useTransition();
  const first = start(() => id.set(2));
  assert.equal(pending(), true);
  a2.resolve("a2");
  await flush();
  assert.equal(view.html(), '<div><b class="a">a1</b><b class="b">b1</b></div>', "a2 waits for b");
  // Superseded before b2 settles: the generation for 2 leaves, the one for 3 joins the same transition.
  const second = start(() => id.set(3));
  b2.resolve("b2");
  await flush();
  assert.equal(view.html(), '<div><b class="a">a1</b><b class="b">b1</b></div>');
  a3.resolve("a3");
  b3.resolve("b3");
  await Promise.all([first, second]);
  assert.equal(view.html(), '<div><b class="a">a3</b><b class="b">b3</b></div>');
  assert.equal(pending(), false);
});

test("inside a transition a revealed Suspense does not fall back", async () => {
  const one = gate<string>(), two = gate<string>();
  const id = signal(1);
  const view = render(() => <Reload id={id} loads={{ 1: one.promise, 2: two.promise }} suspense />);
  one.resolve("one");
  await flush();
  const done = startTransition(() => id.set(2));
  assert.equal(view.container.querySelector(".wait"), null);
  assert.equal(view.find(".value").textContent, "one0");
  two.resolve("two");
  await done;
  assert.equal(view.find(".value").textContent, "two0");
});

test("a transition with nothing to load resolves at once", async () => {
  const value = signal(0);
  await startTransition(() => value.set(1));
  assert.equal(value(), 1);
});

test("unmounting during a transition releases it", async () => {
  const one = gate<string>(), two = gate<string>();
  const id = signal(1);
  const view = render(() => <Reload id={id} loads={{ 1: one.promise, 2: two.promise }} />);
  one.resolve("one");
  await flush();
  const done = startTransition(() => id.set(2));
  view.unmount();
  await done;
  assert.equal(text(view), "");
});

test("unmounting a Suspense while a load below it is pending disposes it quietly", () => {
  const a = gate<string>(), b = gate<string>();
  const view = render(() => <Pair a={a.promise} b={b.promise} />);
  assert.equal(view.html(), '<main><p class="wait">loading</p></main>');
  // The pending Async (made before the Suspense's own effect) is disposed first: its release must not run the effect
  // over the disposed owner (DERIVED-C3: a derived adopt's probe run is disposed the same way).
  assert.doesNotThrow(() => view.unmount());
});
