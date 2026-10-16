// Agent model over real façade events (reactivity façade in Node; component events emitted by hand
// as the DOM façade would).
import { test } from "vitest";
import assert from "node:assert/strict";
import { HOOK, _debug } from "@rivetjs/reactivity/debug";
import { createHook } from "../agent/hook.ts";
import { Model } from "../agent/model.ts";
import { displayName } from "../protocol.ts";

const hook = createHook(2);
(globalThis as { [HOOK]?: unknown })[HOOK] = hook;
// The façade reads the hook at call time; import it after installing the hook.
const r = await import("../../reactivity/dev.ts");
const model = new Model(() => _debug);
model.connected = true;
hook.on = (event) => model.handle(event);

function Counter() {}
function Inner() {}
const Wrapper = () => {};
const container = { nodeType: 1, localName: "div", id: "app" };

test("tree, owner details, edits, graph and update counts", async () => {
  const token = r.createContext("theme", { id: "theme" });
  let rootOwner!: object, counter!: object, inner!: object, wrapper!: object, binding!: object;
  let count!: ReturnType<typeof r.signal<number>>, internal!: ReturnType<typeof r.signal<number>>;
  const { dispose } = r.createRoot((stop) => {
    rootOwner = r.getOwner()!;
    r.createRoot(() => {
      counter = r.getOwner()!;
      count = r.signal(1);
      internal = r.signal(0);
      hook.emit("sig.internal", { sig: internal });
      const double = r.computed(() => count() * 2);
      r.effect(() => {
        binding = r.getOwner()!;
        double();
      });
      r.provide(token, "dark", () => {
        r.createRoot(() => {
          wrapper = r.getOwner()!;
          r.createRoot(() => {
            inner = r.getOwner()!;
            r.signal("inner");
            hook.emit("comp.mount", { owner: inner, fn: Inner, props: {} });
          });
          hook.emit("comp.mount", { owner: wrapper, fn: Wrapper, props: {} });
        });
      });
      const props = Object.defineProperty({ label: "x" }, "lazy", { enumerable: true, get: () => assert.fail("getter ran") });
      hook.emit("comp.mount", { owner: counter, fn: Counter, props });
    });
    hook.emit("root.mount", { owner: rootOwner, container });
    return stop;
  });
  hook.emit("hot.register", { id: "src/counter.tsx#default", wrapper: Counter, impl: function CounterView() {} });
  hook.emit("comp.hide", { fn: Wrapper });

  const tree = model.tree();
  assert.deepEqual(
    JSON.parse(JSON.stringify(tree, (key, value) => (key === "id" || key === "updates" ? undefined : value))),
    [{ name: "div#app", kind: "root", children: [{ name: "CounterView", file: "src/counter.tsx", kind: "component", children: [{ name: "Inner", kind: "component", children: [] }] }] }],
  );
  const counterId = tree[0]!.children[0]!.id;
  assert.equal(counterId, model.id(counter));

  const info = (await model.owner(counterId))!;
  assert.equal(info.name, "CounterView");
  assert.deepEqual(info.signals.map((s) => [s.value.p, s.editable, s.owner?.name]), [["1", true, "CounterView"]]);
  assert.deepEqual(info.computeds.map((c) => [c.value?.p, c.runs]), [["2", 1]]);
  assert.deepEqual(info.effects, { count: 1, runs: 1 });
  assert.deepEqual(info.context.map((c) => [c.ctx.name, c.value, c.signal, typeof c.readonly]), [["theme", { k: "s", p: '"dark"' }, undefined, "string"]]);
  assert.deepEqual(info.props.map((e) => [e.key, e.value.k]), [["label", "s"], ["lazy", "get"]]);
  assert.deepEqual((await model.owner(model.id(inner)))!.signals.map((s) => s.value.p), ['"inner"']);

  // Edits write through .set, tagged; the drained event carries the new value.
  model.drain();
  const signalId = info.signals[0]!.id;
  assert.deepEqual(model.setSignal(signalId, "5", hook), { ok: true, value: { k: "n", p: "5" } });
  assert.equal(count(), 5);
  assert.equal(hook.writing, false);
  assert.equal(model.setSignal(signalId, "{oops", hook).ok, false);
  const drained = model.drain().map(({ t, d }) => [t, d()]);
  assert.deepEqual(drained.find(([t]) => t === "sig.write")![1], { id: signalId, value: { k: "n", p: "5" }, by: "devtools" });

  // Graph: count → double → effect.
  const down = model.graph(signalId, "down", 5)!;
  assert.deepEqual([down.kind, down.next[0]!.kind, down.next[0]!.next[0]!.kind, down.next[0]!.scope], ["signal", "computed", "effect", "CounterView"]);
  const up = model.graph(down.next[0]!.next[0]!.id, "up", 1)!;
  assert.deepEqual(up.next.map((n) => [n.kind, n.value?.p]), [["computed", "10"]]);

  // DOM updates count against the nearest component.
  hook.emit("dom.update", { node: {}, kind: "child", name: null, owner: binding });
  assert.deepEqual(model.drain().find(({ t }) => t === "dom.update")!.d(), { counts: [[counterId, 1]] });
  assert.equal(model.tree()[0]!.children[0]!.updates, 1);
  model.resetCounts();
  assert.equal(model.tree()[0]!.children[0]!.updates, 0);

  // Every signal, minus internal ones.
  assert.deepEqual((await model.allSignals()).map((s) => s.value.p).sort(), ['"inner"', "5"]);
  assert.equal(model.setSignal(model.id(internal), "1", hook).ok, true, "internal signals stay writable by id");

  hook.emit("comp.unmount", { owner: inner });
  assert.deepEqual(model.tree()[0]!.children[0]!.children, []);
  hook.emit("root.unmount", { owner: rootOwner });
  dispose();
  assert.deepEqual(model.tree(), []);
});

test("non-JSON signals are read-only from the panel", () => {
  const s = r.signal(new Map());
  const id = model.id(s);
  assert.deepEqual(model.setSignal(id, "1", hook), { ok: false, error: "only signals holding JSON values can be edited" });
  assert.equal(model.setSignal(model.id({}), "1", hook).ok, false);
});

test("names: source bindings scoped by component, collisions numbered in creation order", async () => {
  // `name` events as the dev transform's helper emits them.
  const named = <T>(value: T, name: string): T => (hook.emit("name", { value, name }), value);
  let owner!: object, other!: object, item!: () => number, item2!: () => number, plain!: () => number, total!: () => number;
  r.createRoot(() => {
    owner = r.getOwner()!;
    item = named(r.signal(1), "item");
    r.createRoot(() => {
      // A plain owner below the component (e.g. a `For` row): same scope.
      item2 = named(r.signal(2), "item");
    });
    plain = r.signal(3);
    total = named(r.computed(() => item() + item2()), "total");
    total();
    hook.emit("comp.mount", { owner, fn: function Cart() {}, props: {} });
  });
  r.createRoot(() => {
    other = r.getOwner()!;
    named(r.signal(0), "item");
    hook.emit("comp.mount", { owner: other, fn: function Other() {}, props: {} });
  });
  const info = (await model.owner(model.id(owner)))!;
  assert.deepEqual(
    info.signals.map((s) => displayName(s)),
    ["Cart › item", "Cart › signal #" + model.id(plain), "Cart › item#2"],
  );
  assert.deepEqual(info.computeds.map((c) => [displayName(c), displayName(c, { scoped: false })]), [["Cart › total", "total"]]);
  // Another component's `item` is its own first.
  assert.deepEqual((await model.owner(model.id(other)))!.signals.map((s) => displayName(s)), ["Other › item"]);
  // The graph uses the same names.
  const down = model.graph(model.id(item2), "down", 1)!;
  assert.deepEqual([displayName(down), displayName(down.next[0]!)], ["Cart › item#2", "Cart › total"]);
});

test("value inspection by handle (pages, cycles via ancestors, long text) and leaf edits at a path", async () => {
  const cyclic: Record<string, unknown> = { n: 1 };
  cyclic.self = { up: cyclic };
  const s = r.signal(cyclic);
  const store = r.signal({ list: [1, { deep: "a" }] });
  let owner!: object;
  r.createRoot(() => {
    owner = r.getOwner()!;
    hook.emit("comp.mount", { owner, fn: function Values() {}, props: { text: "z".repeat(500) } });
  });
  const info = (await model.allSignals()).find((x) => x.id === model.id(s))!;
  const top = model.inspect(info.value.h!)!;
  const self = top.entries.find((e) => e.key === "self")!;
  const inner = model.inspect(self.value.h!, 0, [info.value.h!])!;
  assert.deepEqual(inner.entries, [{ key: "up", value: { k: "cyc", p: "[circular]" } }]);
  assert.equal(model.inspect(123456), null, "unknown handle");
  const text = (await model.owner(model.id(owner)))!.props[0]!.value;
  assert.equal(model.text(text.h!), "z".repeat(500));

  assert.equal(model.setSignalPath(model.id(store), ["list", "1", "deep"], '"b"', hook).ok, true);
  assert.deepEqual(store(), { list: [1, { deep: "b" }] });
  assert.equal(model.setSignalPath(model.id(store), ["list", "9"], "1", hook).ok, false);
  assert.equal(model.setSignalPath(model.id(s), ["n"], "2", hook).ok, false, "cyclic values are not JSON");
});

test("creation stacks resolve to app source locations", async () => {
  hook.stacks = true;
  let owner!: object;
  r.createRoot(() => {
    owner = r.getOwner()!;
    r.signal(0);
    hook.emit("comp.mount", { owner, fn: function Located() {}, props: {} });
  });
  hook.stacks = false;
  const info = (await model.owner(model.id(owner)))!;
  assert.match(info.signals[0]!.location!.file, /devtools\/tests\/model\.test\.ts$/);
  assert.ok(info.signals[0]!.location!.line > 100);
});

test("componentAt: v1 marker spans and DOM v2 node spans (inclusive ends), innermost wins", async () => {
  const { Window } = await import("happy-dom");
  const document = new Window().document as unknown as Document;
  const host = document.createElement("div");
  // v1: <!--rivet:start--><p><b/></p><!--rivet:end-->; v2: <section> returned by Outer, whose <i> Inner returns,
  // and Pair = [<em>, <u>] (fragment output).
  const start = document.createComment("rivet:start"),
    end = document.createComment("rivet:end"),
    p = document.createElement("p"),
    b = document.createElement("b"),
    section = document.createElement("section"),
    i = document.createElement("i"),
    em = document.createElement("em"),
    u = document.createElement("u");
  p.append(b);
  section.append(i);
  host.append(start, p, end, section, em, u);
  document.body.append(host);
  const owners: object[] = [];
  const mount = (fn: Function, span: { start: Node; end: Node }, lazy: boolean) =>
    r.createRoot(() => {
      const owner = r.getOwner()!;
      owners.push(owner);
      hook.emit("comp.mount", { owner, fn, props: {}, ...(lazy ? { spanOf: () => span } : { span }) });
    });
  function V1() {}
  function Leaf() {}
  function Outer() {}
  function Pair() {}
  mount(V1, { start, end }, false);
  // A v2 child's comp.mount comes before its parent's (reported after the component returns).
  mount(Leaf, { start: i, end: i }, true);
  mount(Outer, { start: section, end: section }, true);
  mount(Pair, { start: em, end: u }, true);
  const [v1, leaf, outer, pair] = owners.map((owner) => model.id(owner));
  assert.equal(model.componentAt(b), v1);
  assert.equal(model.componentAt(p), v1);
  assert.equal(model.componentAt(i), leaf);
  assert.equal(model.componentAt(section), outer);
  assert.equal(model.componentAt(em), pair);
  assert.equal(model.componentAt(u), pair);
  assert.equal(model.componentAt(host), null);
});
