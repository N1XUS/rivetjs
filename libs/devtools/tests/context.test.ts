// Contexts (names, providers, consumers, editability), typed signal edits (fresh copies, in-place
// class instances), computed overrides and "why it last updated", over the reactivity façade.
import { test } from "vitest";
import assert from "node:assert/strict";
import { HOOK, _debug } from "@rivetjs/reactivity/debug";
import { createHook } from "../agent/hook.ts";
import { Model } from "../agent/model.ts";
import { displayName } from "../protocol.ts";

const hook = createHook(2);
(globalThis as { [HOOK]?: unknown })[HOOK] = hook;
const r = await import("../../reactivity/dev.ts");
const model = new Model(() => _debug, () => hook);
model.connected = true;
hook.on = (event) => model.handle(event);
const named = <T>(value: T, name: string): T => (hook.emit("name", { value, name }), value);
const container = { nodeType: 1, localName: "div", id: "app" };

test("contexts: names, provider and consumer components, provided signals editable, plain values read-only", async () => {
  const Theme = named(r.createContext<unknown>("light"), "ThemeContext");
  const Theme2 = named(r.createContext("x"), "ThemeContext");
  const Locale = r.createContext("en", { id: "rivet:locale" });
  const Anon = r.createContext(0);
  const mode = r.signal("dark");
  let root!: object, app!: object, card!: object, lone!: object;
  let seen: unknown[] = [];
  r.createRoot(() => {
    root = r.getOwner()!;
    r.createRoot(() => {
      app = r.getOwner()!;
      r.provide(Theme, mode, () =>
        r.provide(Locale, "de", () => {
          r.createRoot(() => {
            card = r.getOwner()!;
            seen = [r.useContext(Theme), r.useContext(Locale), r.useContext(Anon)];
            hook.emit("comp.mount", { owner: card, fn: function Card() {}, props: {} });
          });
        }),
      );
      hook.emit("comp.mount", { owner: app, fn: function App() {}, props: {} });
    });
    r.createRoot(() => {
      lone = r.getOwner()!;
      r.useContext(Theme2);
      hook.emit("comp.mount", { owner: lone, fn: function Lone() {}, props: {} });
    });
    hook.emit("root.mount", { owner: root, container });
  });
  assert.equal(seen[0], mode, "the façade returns the provided value");

  const appInfo = (await model.owner(model.id(app)))!;
  assert.deepEqual(appInfo.context.map((c) => [c.ctx.name, c.signal !== undefined, c.readonly === undefined, c.consumers.map((x) => x.name)]), [
    ["ThemeContext", true, true, ["Card"]],
    ["rivet:locale", false, false, ["Card"]],
  ]);
  assert.match(appInfo.context[1]!.readonly!, /plain snapshot/);
  const cardInfo = (await model.owner(model.id(card)))!;
  assert.deepEqual(
    cardInfo.consumed.map((c) => [c.ctx.name, c.value.p, c.provider?.name ?? null]),
    [["ThemeContext", 'signal("dark")', "App"], ["rivet:locale", '"de"', "App"], ["context #" + model.id(Anon), "0", null]],
  );
  assert.equal(cardInfo.consumed[0]!.signal, model.id(mode));
  // A second token under the same binding name is numbered.
  assert.deepEqual((await model.owner(model.id(lone)))!.consumed.map((c) => c.ctx.name), ["ThemeContext#2"]);
  // Owner chain: root, then components above.
  assert.deepEqual(cardInfo.chain.map((c) => c.name), ["div#app", "App"]);

  // The Contexts tab lists each provider instance with its component.
  const providers = await model.contexts();
  assert.deepEqual(providers.map((p) => [p.ctx.name, p.owner?.name, p.consumers.length]), [["ThemeContext", "App", 1], ["rivet:locale", "App", 1]]);

  // Editing a provided signal: consumers that read it update.
  let shown = "";
  r.effect(() => void (shown = (seen[0] as () => string)()));
  assert.equal(model.edit({ kind: "signal", id: providers[0]!.signal! }, [], { op: "set", value: { t: "s", v: "sepia" } }, hook).ok, true);
  assert.equal(shown, "sepia");
});

test("typed edits through .set (fresh copies) and in place on a class instance (re-notified)", () => {
  class Store {
    count = 1;
  }
  const map = r.signal(new Map([["a", 1]]));
  const store = r.signal(new Store());
  const runs: unknown[] = [];
  r.effect(() => void runs.push(store().count));
  const before = map();
  const res = model.edit({ kind: "signal", id: model.id(map) }, [], { op: "add", key: { t: "s", v: "b" }, value: { t: "n", v: "2" } }, hook);
  assert.equal(res.ok, true);
  assert.notEqual(map(), before);
  assert.deepEqual([...map()], [["a", 1], ["b", 2]]);
  const instance = store();
  const inPlace = model.edit({ kind: "signal", id: model.id(store) }, [{ o: "count" }], { op: "set", value: { t: "n", v: "5" } }, hook);
  assert.deepEqual(inPlace.ok && inPlace.inPlace, true);
  assert.equal(store(), instance, "same instance");
  assert.deepEqual(runs, [1, 5], "observers ran once with the mutated instance");
});

test("computed overrides pin what consumers see until reset", async () => {
  let owner!: object, total!: () => number;
  const a = r.signal(2);
  const seen: number[] = [];
  r.createRoot(() => {
    owner = r.getOwner()!;
    total = named(r.computed(() => a() * 10), "total");
    r.effect(() => void seen.push(total()));
    hook.emit("comp.mount", { owner, fn: function Totals() {}, props: {} });
  });
  const id = model.id(_debug(total)!.ref);
  assert.equal(model.edit({ kind: "computed", id }, [], { op: "set", value: { t: "n", v: "99" } }, hook).ok, true);
  assert.equal(total(), 99);
  a.set(3);
  assert.equal(total(), 99, "pinned across source writes");
  const info = (await model.owner(model.id(owner)))!;
  assert.deepEqual(info.computeds.map((c) => [displayName(c, { scoped: false }), c.pinned?.p]), [["total", "99"]]);
  // The pin signal is internal: not listed, not in the graph.
  assert.deepEqual(info.signals, []);
  assert.deepEqual(model.graph(id, "up", 1)!.next.map((n) => n.kind), []);
  assert.equal(model.clearOverride({ kind: "computed", id }), true);
  assert.equal(total(), 30);
  assert.deepEqual(seen, [20, 99, 30]);
  assert.equal((await model.owner(model.id(owner)))!.computeds[0]!.pinned, undefined);
});

test("why it last updated: the write behind a component's latest run, devtools edits flagged", async () => {
  let owner!: object, count!: ReturnType<typeof r.signal<number>>;
  r.createRoot(() => {
    owner = r.getOwner()!;
    count = named(r.signal(0), "count");
    r.effect(() => void count());
    hook.emit("comp.mount", { owner, fn: function Clicker() {}, props: {} });
  });
  assert.equal((await model.owner(model.id(owner)))!.lastUpdate, undefined, "the first run has no cause");
  count.set(1);
  let last = (await model.owner(model.id(owner)))!.lastUpdate!;
  assert.deepEqual(last.causes.map((c) => [displayName(c.signal), c.by]), [["Clicker › count", undefined]]);
  await Promise.resolve();
  model.edit({ kind: "signal", id: model.id(count) }, [], { op: "set", value: { t: "n", v: "4" } }, hook);
  last = (await model.owner(model.id(owner)))!.lastUpdate!;
  assert.deepEqual(last.causes.map((c) => c.by), ["devtools"]);
  const details = (await model.signalDetails(model.id(count)))!;
  assert.equal(details.lastWrite?.by, "devtools");
  assert.deepEqual(details.chain.map((c) => c.name), ["Clicker"]);
});

test("a lookup during setup (before comp.mount) does not pin a child's runs to its parent", () => {
  let parent!: object, child!: object, effectNode!: object;
  r.createRoot(() => {
    parent = r.getOwner()!;
    hook.emit("comp.mount", { owner: parent, fn: function Parent() {}, props: {} });
    r.createRoot(() => {
      child = r.getOwner()!;
      r.effect(() => void (effectNode = r.getOwner()!));
      // Looked up while the child is still setting up (performance attribution of its first run).
      assert.equal(model.compId(effectNode), model.id(parent));
      hook.emit("comp.mount", { owner: child, fn: function Child() {}, props: {} });
    });
  });
  assert.equal(model.compId(effectNode), model.id(child));
});
