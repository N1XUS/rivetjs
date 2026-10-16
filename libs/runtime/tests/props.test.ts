// Live component props helpers (`props.ts`, spec docs/design/specs/2026-10-07-live-props-design.md):
// mergeProps / splitProps / _restProps keep getters live (nothing read while combining), Solid parity.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createRoot, effect, signal } from "@rivetjs/reactivity";
import { _p, _pg, _restProps, _spreadProps, mergeProps, splitProps } from "../props.ts";

// What the compiler emits for `<C variant={v()} size="sm" />`.
const live = <T>(read: () => T, rest: Record<string, unknown> = {}) =>
  ({
    get variant() {
      return read();
    },
    ...rest,
  }) as { variant: T } & Record<string, unknown>;

// Runs `fn` in an effect and returns the values it saw.
function track<T>(fn: () => T): { seen: T[]; dispose: () => void } {
  const seen: T[] = [];
  let dispose = () => {};
  createRoot((d) => {
    dispose = d;
    effect(() => {
      seen.push(fn());
    });
  });
  return { seen, dispose };
}

test("mergeProps: later sources win, undefined falls through, getters stay live", () => {
  const v = signal<string | undefined>("a");
  const reads: string[] = [];
  const props = live(() => (reads.push("v"), v()), { size: undefined, label: "x" });
  const merged = mergeProps({ variant: "default", size: "md", tone: "neutral" }, props);
  assert.deepEqual(reads, [], "merging reads no prop");
  assert.equal(merged.size, "md", "an undefined value keeps the earlier default");
  assert.equal(merged.tone, "neutral");
  assert.equal(merged.label, "x");
  const { seen, dispose } = track(() => merged.variant);
  v.set("b");
  v.set(undefined);
  assert.deepEqual(seen, ["a", "b", "default"], "the getter tracks; undefined resolves to the default");
  dispose();
  assert.deepEqual(Object.keys(merged).sort(), ["label", "size", "tone", "variant"]);
});

test("mergeProps: a later plain value settles a key over an earlier getter", () => {
  const v = signal("a");
  const merged = mergeProps(live(v), { variant: "fixed" });
  assert.equal(merged.variant, "fixed");
  assert.equal(Object.getOwnPropertyDescriptor(merged, "variant")!.get, undefined, "settled keys are data properties");
});

test("mergeProps: key order is object-spread order (first appearance, sources in order), getters included", () => {
  const v = signal("a");
  const merged = mergeProps(
    {
      get class() {
        return v();
      },
      "data-slot": "card",
      id: undefined,
    },
    {
      title: "t",
      "data-slot": "override",
      get id() {
        return "x";
      },
    },
    { children: "c" },
  );
  // Same order as `{ ...first, ...second, ...third }` (the server's spread object): attributes keep source order.
  assert.deepEqual(Object.keys(merged), ["class", "data-slot", "id", "title", "children"]);
  assert.equal(merged["data-slot"], "override");
  assert.equal(merged.id, "x");
  v.set("b");
  assert.equal(merged.class, "b");
});

test("mergeProps: a function source is a reactive object (Proxy), keys follow it", () => {
  const on = signal(true);
  const merged = mergeProps({ a: 1 }, () => (on() ? { b: 2 } : { a: 3 }));
  const { seen, dispose } = track(() => [merged.a, (merged as { b?: number }).b, Object.keys(merged).sort().join()] as const);
  on.set(false);
  dispose();
  assert.deepEqual(seen, [
    [1, 2, "a,b"],
    [3, undefined, "a"],
  ]);
  assert.equal("b" in merged, false);
});

test("mergeProps skips null / undefined / false sources and never copies __proto__", () => {
  const evil = JSON.parse('{"__proto__": {"polluted": 1}, "ok": 1}') as Record<string, unknown>;
  const merged = mergeProps(null, undefined, false, evil) as Record<string, unknown>;
  assert.equal(merged.ok, 1);
  assert.equal(Object.getPrototypeOf(merged), Object.prototype);
  assert.equal(merged.polluted, undefined);
});

test("splitProps: picked parts and rest forward getters without reading them", () => {
  const v = signal("a");
  let reads = 0;
  const props = {
    get variant() {
      reads++;
      return v();
    },
    id: "x",
    onPress: () => {},
    children: "c",
  };
  const [local, dom, rest] = splitProps(props, ["variant", "children"], ["id", "variant"]);
  assert.equal(reads, 0, "splitting reads no prop");
  assert.deepEqual(Object.keys(local).sort(), ["children", "variant"]);
  assert.deepEqual(Object.keys(dom), ["id"], "a key listed twice goes to its first list");
  assert.deepEqual(Object.keys(rest), ["onPress"]);
  const { seen, dispose } = track(() => local.variant);
  v.set("b");
  dispose();
  assert.deepEqual(seen, ["a", "b"]);
});

test("splitProps over a proxied (function-source) props object returns proxies that follow its keys", () => {
  const on = signal(false);
  const props = mergeProps(() => (on() ? { a: 1, b: 2 } : { b: 3 })) as Record<string, unknown>;
  const [picked, rest] = splitProps(props, ["a"]);
  const { seen, dispose } = track(() => [Object.keys(picked).join(), picked.a, Object.keys(rest).join(), rest.b]);
  on.set(true);
  dispose();
  assert.deepEqual(seen, [
    ["", undefined, "b", 3],
    ["a", 1, "b", 2],
  ]);
});

test("splitProps over a proxied props object: a key listed twice goes to its first list", () => {
  const props = mergeProps(() => ({ a: 1, b: 2, c: 3, d: 4 })) as Record<string, unknown>;
  const [first, second, rest] = splitProps(props, ["a", "b"], ["b", "c"]);
  assert.deepEqual([Object.keys(first), Object.keys(second), Object.keys(rest)], [["a", "b"], ["c"], ["d"]]);
  assert.deepEqual([first.b, second.b, "b" in second, second.c, rest.a, rest.d], [2, undefined, false, 3, undefined, 4]);
});

test("_restProps: the destructuring rest object (compiler ABI)", () => {
  const v = signal("a");
  const props = live(v, { title: "t", "aria-label": "l" });
  const rest = _restProps(props, ["title"]);
  assert.deepEqual(Object.keys(rest).sort(), ["aria-label", "variant"]);
  const { seen, dispose } = track(() => rest.variant);
  v.set("b");
  dispose();
  assert.deepEqual(seen, ["a", "b"]);
});

test("author getters keep their `this` when forwarded", () => {
  const source = {
    base: 2,
    get double() {
      return this.base * 2;
    },
  };
  const [picked] = splitProps(source, ["double"]);
  assert.equal(picked.double, 4);
  assert.equal(mergeProps(source).double, 4);
});

test("_spreadProps: object-spread semantics (server twin) — an own undefined overrides, spread key order, getters live", () => {
  const v = signal("a");
  const merged = _spreadProps(
    {
      "aria-label": "x",
      get class() {
        return v();
      },
    },
    { "aria-label": undefined, slot: "s" },
    {
      get slot() {
        return "t";
      },
    },
  );
  // `{ "aria-label": "x", ...p }` with `p["aria-label"] === undefined` → undefined (mergeProps would keep "x").
  assert.deepEqual(Object.keys(merged), ["aria-label", "class", "slot"]);
  assert.equal(merged["aria-label"], undefined);
  assert.equal("aria-label" in merged, true);
  assert.equal(merged.slot, "t");
  const seen = track(() => merged.class);
  v.set("b");
  assert.deepEqual(seen.seen, ["a", "b"]);
  seen.dispose();
  // A later value replaces an earlier getter in place.
  const over = _spreadProps(
    {
      get a() {
        return 1;
      },
      b: 2,
    },
    { a: 3 },
  );
  assert.deepEqual(Object.entries(over), [
    ["a", 3],
    ["b", 2],
  ]);
});

test("_spreadProps: a function source is reactive (Proxy); the last source having a key wins", () => {
  const on = signal(true);
  const merged = _spreadProps({ a: 1, b: 2 }, () => (on() ? { a: undefined } : { c: 3 }));
  assert.equal(merged.a, undefined);
  assert.deepEqual(Object.keys(merged), ["a", "b"]);
  on.set(false);
  assert.equal(merged.a, 1);
  assert.deepEqual(Object.keys(merged), ["a", "b", "c"]);
});

// The compiler's per-call-site factory for `<C a={x()} k="v" b={y()} />` (DOM v2, props-layout).
const factory = (env: (i: number) => unknown, k: unknown) => {
  const o = _p(env);
  _pg(o, "a", 0);
  o["k"] = k;
  _pg(o, "b", 1);
  return o;
};

test("_p / _pg: own enumerable configurable getters in source order, hidden slot, shared map-friendly getters", () => {
  const x = signal(1),
    y = signal("y");
  const o = factory((i) => (i ? y() : x()), "v") as Record<string, unknown>;
  assert.deepEqual(Object.keys(o), ["a", "k", "b"]);
  assert.deepEqual(Reflect.ownKeys(o), ["a", "k", "b"]);
  assert.equal(Object.getPrototypeOf(o), Object.prototype);
  const desc = Object.getOwnPropertyDescriptor(o, "a")!;
  assert.equal(desc.enumerable, true);
  assert.equal(desc.configurable, true);
  assert.equal(desc.set, undefined);
  assert.equal(desc.get!.call(o), 1);
  // Same getter function per index across objects (shared AccessorPairs → one map).
  const other = factory(() => 0, "w");
  assert.equal(Object.getOwnPropertyDescriptor(other, "a")!.get, desc.get);
  assert.deepEqual({ ...o }, { a: 1, k: "v", b: "y" });
  assert.equal(JSON.stringify(o), '{"a":1,"k":"v","b":"y"}');
  const { seen, dispose } = track(() => `${o.a}${o.b}`);
  x.set(2);
  y.set("z");
  assert.deepEqual(seen, ["1y", "2y", "2z"]);
  dispose();
});

test("helpers over _p objects and over each other stay live; results carry no extra own keys", () => {
  const x = signal("a");
  const base = factory((i) => (i ? "B" : x()), "k");
  const spread = _spreadProps({ z: 0 }, base, { k: "K" });
  const merged = mergeProps({ a: "default", d: 1 }, spread);
  const [picked, rest] = splitProps(merged, ["a"]);
  for (const part of [spread, merged, picked, rest]) assert.deepEqual(Reflect.ownKeys(part), Object.keys(part));
  assert.deepEqual(Object.keys(merged), ["a", "d", "z", "k", "b"]);
  assert.equal(picked.a, "a");
  assert.deepEqual(Object.entries(rest), [
    ["d", 1],
    ["z", 0],
    ["k", "K"],
    ["b", "B"],
  ]);
  const { seen, dispose } = track(() => picked.a);
  x.set("b");
  assert.deepEqual(seen, ["a", "b"]);
  // An undefined getter value falls back to mergeProps' default.
  x.set(undefined as never);
  assert.equal(picked.a, "default");
  dispose();
});

test("a descriptor copy of a live props object throws a readable TypeError (no slot), the original still reads", () => {
  const compiled = factory((i) => (i ? "b" : "a"), "v");
  const [, rest] = splitProps(_spreadProps({ s: 1 }, compiled), []);
  const merged = mergeProps({ a: "d" }, compiled);
  for (const props of [compiled, rest, merged, _spreadProps(compiled, {})]) {
    const copy = Object.defineProperties({}, Object.getOwnPropertyDescriptors(props)) as Record<string, unknown>;
    assert.throws(
      () => copy.a,
      (error: unknown) => error instanceof TypeError && /mergeProps \/ splitProps/.test(error.message),
    );
    assert.equal(Object.getOwnPropertyDescriptor(props, "a")!.get!.call(props), "a");
    assert.equal((props as Record<string, unknown>).a, "a");
  }
});
