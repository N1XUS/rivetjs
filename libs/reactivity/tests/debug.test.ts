import { test } from "vitest";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  _bindingEffect,
  signal,
  computed,
  effect,
  createRoot,
  provide,
  createContext,
  getOwner,
  runWithOwner,
  onCleanup,
  type Owner,
} from "@rivetjs/reactivity";
import { _debug } from "@rivetjs/reactivity/debug";

test("_debug walks owners in creation order with parents, kinds and provided tokens", () => {
  const token = createContext("none");
  let root: Owner | null = null,
    provider: Owner | null = null;
  const { dispose } = createRoot(() => {
    root = getOwner();
    effect(() => {});
    provide(token, "value", () => {
      provider = getOwner();
      createRoot(() => {});
    });
    computed(() => 1)();
  });
  const view = _debug(root)!;
  assert.equal(view.kind, "owner");
  assert.equal(view.ref, root);
  assert.deepEqual(
    view.children().map((c) => c.kind),
    ["effect", "owner", "computed"],
  );
  const p = view.children()[1]!;
  assert.equal(p.ref, provider);
  assert.equal(p.token, token);
  assert.equal(p.context, "value");
  assert.equal(p.parent()!.ref, root);
  assert.equal(p.children().length, 1);
  assert.equal(view.parent(), null);
  assert.ok(Object.isFrozen(view));
  dispose();
  assert.equal(_debug(root)!.disposed, true);
  assert.deepEqual(_debug(root)!.children(), []);
});

test("_debug views signals and computeds: values, states, sources and observers", () => {
  const a = signal(1),
    b = signal(2);
  const flip = signal(false);
  let runs = 0;
  const c = computed(() => (runs++, flip() ? b() + a() : a() + b()));
  const sa = _debug(a)!;
  assert.equal(sa.kind, "signal");
  assert.equal(sa.ref, a);
  assert.equal(sa.getter, a);
  assert.equal(sa.value, 1);
  const vc = _debug(c)!;
  assert.equal(vc.kind, "computed");
  assert.equal(vc.state, "dirty");
  assert.equal(vc.value, undefined);
  assert.equal(runs, 0, "views never evaluate");
  let seen = 0;
  const stop = effect(() => {
    seen = c();
  });
  assert.equal(seen, 3);
  assert.equal(_debug(c)!.state, "clean");
  assert.equal(_debug(c)!.value, 3);
  assert.deepEqual(
    _debug(c)!
      .sources()
      .map((s) => s.ref),
    [flip, a, b],
  );
  assert.deepEqual(
    _debug(a)!
      .observers()
      .map((o) => o.ref),
    [vc.ref],
  );
  // A diverged read order relinks sources in the new order.
  flip.set(true);
  assert.deepEqual(
    _debug(c)!
      .sources()
      .map((s) => s.ref),
    [flip, b, a],
  );
  const eff = _debug(c)!.observers()[0]!;
  assert.equal(eff.kind, "effect");
  assert.deepEqual(
    eff.sources().map((s) => s.ref),
    [vc.ref],
  );
  assert.equal(eff.disposed, false);
  stop();
  // Views are snapshots: query again for current state.
  assert.equal(_debug(eff.ref)!.disposed, true);
  assert.deepEqual(_debug(c)!.observers(), []);
});

test("_debug reports failed computeds and stays untracked", () => {
  const fail = signal(true);
  const c = computed(() => {
    if (fail()) throw new Error("boom");
    return 1;
  });
  assert.throws(c, /boom/);
  assert.equal(_debug(c)!.failed, true);
  let runs = 0;
  const probe = signal(0);
  const stop = effect(() => {
    runs++;
    // Reading views inside an effect subscribes to nothing.
    _debug(probe)!.value;
    _debug(c)!.sources();
  });
  probe.set(1);
  fail.set(false);
  assert.equal(runs, 1);
  stop();
});

test("_debug returns null for anything that is not reactive", () => {
  for (const value of [null, undefined, 1, "x", {}, [], () => 1, { kind: 0 }]) assert.equal(_debug(value), null);
});

test("escaped effect and computed owners remain debuggable and own later reactive work", () => {
  const value = signal(1),
    token = createContext("default");
  const captures: Owner[] = [],
    seen: string[] = [],
    cleaned: string[] = [];
  const root = createRoot(() =>
    provide(token, "provided", () => {
      effect(() => {
        captures.push(getOwner()!);
      });
      computed(() => {
        captures.push(getOwner()!);
        return 7;
      })();
    }),
  );
  for (const [index, captured] of captures.entries()) {
    const kind = index === 0 ? "effect" : "computed";
    const view = _debug(captured)!;
    assert.equal(view.kind, kind);
    assert.equal(view.ref, captured);
    assert.equal(view.failed, false);
    assert.deepEqual(view.observers(), []);
    runWithOwner(captured, () => {
      assert.equal(getOwner(), captured);
      const doubled = computed(() => value() * 2);
      effect(() => {
        seen.push(`${kind}:${doubled()}`);
      });
      onCleanup(() => cleaned.push(kind));
    });
    assert.deepEqual(
      _debug(captured)!
        .children()
        .map((child) => child.kind),
      ["computed", "effect"],
    );
    for (const child of _debug(captured)!.children()) assert.equal(child.parent()!.ref, captured);
  }
  value.set(2);
  assert.deepEqual(seen, ["effect:2", "computed:2", "effect:4", "computed:4"]);
  root.dispose();
  value.set(3);
  assert.deepEqual(cleaned, ["effect", "computed"]);
  for (const captured of captures) {
    assert.equal(_debug(captured)!.disposed, true);
    assert.deepEqual(_debug(captured)!.children(), []);
    assert.throws(() => runWithOwner(captured, () => effect(() => {})), /disposed owner/);
  }
  assert.deepEqual(seen, ["effect:2", "computed:2", "effect:4", "computed:4"]);
});

test("debug parent views expose private binding owners during their initial read", () => {
  let parent: Owner | null = null,
    binding: Owner | null = null,
    cleaned = 0;
  const root = createRoot(() => {
    parent = getOwner();
    _bindingEffect(() => {
      const children = _debug(parent)!.children();
      binding = children[children.length - 1]!.ref as Owner;
      assert.equal(_debug(binding)!.disposed, false);
    });
  });
  assert.equal(_debug(parent)!.children()[0]!.ref, binding);
  runWithOwner(binding, () => onCleanup(() => cleaned++));
  root.dispose();
  assert.equal(cleaned, 1);
  assert.equal(_debug(binding)!.disposed, true);
});

test("importing debug retains inert bindings only when a devtools hook exists at import", () => {
  // Fresh processes: the development test preload installs a hook in this one.
  const run = (withHook: boolean) => {
    const source = `
      ${withHook ? 'globalThis[Symbol.for("rivet.devtools")] = { v: 1, level: 1, stacks: false, emit() {} };' : ""}
      const { _bindingEffect, createRoot, getOwner } = await import(${JSON.stringify(new URL("../index.ts", import.meta.url).href)});
      const { _debug } = await import(${JSON.stringify(new URL("../debug.ts", import.meta.url).href)});
      let parent;
      createRoot(() => {
        parent = getOwner();
        _bindingEffect(() => {});
      });
      process.stdout.write(String(_debug(parent).children().length));
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return Number(result.stdout.trim());
  };
  assert.equal(run(false), 0, "no hook: inert bindings are released as in production");
  assert.equal(run(true), 1, "hook: inert bindings stay in the graph for the devtools");
});
