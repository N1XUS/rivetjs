// The development façade (`development` condition → dev.ts): same primitives, reported to the hook.
import { test, vi } from "vitest";
import assert from "node:assert/strict";
import * as base from "../index.ts";
import * as dev from "../dev.ts";
import { HOOK, _debug, type DevtoolsHook } from "../debug.ts";

// The façade exports exactly the surface it wraps.
const surface: typeof import("../index.ts") = dev;
void surface;

type Event = [string, Record<string, unknown>];
/** Install a recording hook for `fn` (any previous hook, e.g. the dev-hook preload, comes back after). */
function withHook<T>(level: 0 | 1 | 2, fn: (events: Event[], hook: DevtoolsHook) => T, stacks = false): T {
  const events: Event[] = [];
  const scope = globalThis as { [HOOK]?: DevtoolsHook };
  const previous = scope[HOOK];
  const hook: DevtoolsHook = { v: 1, level, stacks, emit: (type, data) => void events.push([type, data as Record<string, unknown>]) };
  scope[HOOK] = hook;
  try {
    return fn(events, hook);
  } finally {
    scope[HOOK] = previous;
  }
}
const types = (events: Event[]) => events.map(([type]) => type);

test("façade exports every export of index.ts", () => {
  assert.deepEqual(Object.keys(dev).sort(), Object.keys(base).sort());
});

test("without a hook the façade creates plain primitives and reports nothing", () => {
  const scope = globalThis as { [HOOK]?: DevtoolsHook };
  const previous = scope[HOOK];
  delete scope[HOOK];
  try {
    const s = dev.signal(1);
    assert.equal(base._inspect(s)!.kind, "signal");
    // Plain primitive: the shared (this-checked) `set`, not an instrumented per-signal wrapper.
    assert.equal(s.set, dev.signal(0).set);
  } finally {
    scope[HOOK] = previous;
  }
});

test("level 1 reports signal creation with its owner; writes and runs stay silent", () => {
  withHook(1, (events) => {
    let owner: unknown = null, s!: base.Signal<number>;
    const root = dev.createRoot((dispose) => {
      owner = dev.getOwner();
      s = dev.signal(1);
      dev.effect(() => void s());
      return dispose;
    });
    s.set(2);
    assert.deepEqual(types(events), ["sig.create"]);
    assert.equal(events[0]![1].sig, s);
    assert.equal(events[0]![1].owner, owner);
    assert.equal(events[0]![1].stack, undefined);
    root.value();
  });
});

test("level 2 reports writes before the effects they trigger, then runs and batches", () => {
  withHook(2, (events) => {
    const s = dev.signal(1);
    const double = dev.computed(() => s() * 2);
    let seen = 0;
    const stop = dev.effect(() => {
      seen = double();
    });
    events.length = 0;
    s.set(5);
    assert.equal(seen, 10);
    assert.deepEqual(types(events), ["sig.write", "node.run", "node.run"]);
    assert.deepEqual({ ...events[0]![1] }, { sig: s, prev: 1, next: 5 });
    // The computed ran (inside the effect's run) and reported before the effect finished.
    assert.equal(events[1]![1].node, _debug(double)!.ref);
    assert.equal(typeof events[1]![1].ms, "number");
    // update() writes through the reported set; equal writes are marked skipped.
    events.length = 0;
    s.update((n) => n + 1);
    s.set(6);
    assert.deepEqual(types(events), ["sig.write", "node.run", "node.run", "sig.write"]);
    assert.equal(events[3]![1].skipped, true);
    events.length = 0;
    dev.batch(() => {
      s.set(7);
      s.set(8);
    });
    assert.deepEqual(types(events), ["batch.start", "sig.write", "sig.write", "batch.end", "node.run", "node.run"]);
    stop();
  });
});

test("level 2 registers computeds at creation and effects at their first run", () => {
  withHook(2, (events) => {
    let owner: unknown;
    dev.createRoot(() => {
      owner = dev.getOwner();
      const c = dev.computed(() => 1);
      dev.effect(() => void c());
    });
    const created = events.filter(([type]) => type === "node.create").map(([, data]) => data);
    assert.equal(created.length, 2);
    assert.equal(_debug(created[0]!.node)!.kind, "computed");
    assert.equal(typeof created[0]!.getter, "function");
    assert.equal(_debug(created[1]!.node)!.kind, "effect");
    assert.equal(created[0]!.owner, owner);
    assert.equal(created[1]!.owner, owner);
  });
});

test("failed runs report the error and rethrow it unchanged", () => {
  withHook(2, (events) => {
    const failure = new Error("boom");
    const c = dev.computed(() => {
      throw failure;
    });
    assert.throws(c, (error) => error === failure);
    const run = events.find(([type]) => type === "node.run")![1];
    assert.equal(run.error, failure);
  });
});

test("stacks are captured as Error objects while the hook asks for them", () => {
  withHook(
    1,
    (events) => {
      dev.signal(0);
      const stack = events[0]![1].stack;
      assert.ok(stack instanceof Error);
      assert.match(stack.stack!, /dev-facade\.test\.ts/);
    },
    true,
  );
});

test("writes made by the devtools are tagged", () => {
  withHook(2, (events, hook) => {
    const s = dev.signal(0);
    hook.writing = true;
    s.set(1);
    hook.writing = false;
    assert.equal(events.at(-1)![1].by, "devtools");
  });
});

test("the façade returns real primitives: resume hooks and identity are unchanged", () => {
  withHook(2, () => {
    const s = dev.signal(3, { equals: false });
    const c = dev.computed(() => s() + 1);
    assert.deepEqual(base._inspect(s), { kind: "signal", value: 3, equals: null });
    assert.equal(base._inspect(c)!.kind, "computed");
    assert.deepEqual(base._trackReads(() => c()).signals, [s]);
    let runs = 0;
    dev.effect(() => void (runs++, s()));
    s.set(3);
    assert.equal(runs, 2, "equals: false still notifies");
  });
});

test("contexts: creation and reads are reported with the providing owner (null: the default)", () => {
  withHook(1, (events) => {
    const token = dev.createContext("light");
    let provider: unknown = null, reader: unknown = null, value: unknown, fallback: unknown;
    dev.createRoot(() => {
      dev.provide(token, "dark", () => {
        provider = dev.getOwner();
        dev.createRoot(() => {
          reader = dev.getOwner();
          value = dev.useContext(token);
        });
      });
      fallback = dev.useContext(dev.createContext(1));
    });
    assert.equal(value, "dark");
    assert.equal(fallback, 1);
    const reads = events.filter(([type]) => type === "ctx.read").map(([, data]) => data);
    assert.equal(events[0]![0], "ctx.create");
    assert.equal(events[0]![1].token, token);
    assert.deepEqual([reads[0]!.token, reads[0]!.owner, reads[0]!.provider], [token, reader, _debug(provider)!.ref]);
    assert.equal(reads[1]!.provider, null);
  });
});


test("private binding helpers retain source-free owners in the development facade", () => {
  withHook(2, (events) => {
    let owner: base.Owner | null = null;
    const root = dev.createRoot(() => {
      owner = dev.getOwner();
      dev._bindingEffect(() => {});
    });
    assert.deepEqual(_debug(owner)!.children().map((child) => child.kind), ["effect"]);
    assert.ok(types(events).includes("node.create"));
    root.dispose();
  });
});

/** Run `fn` with no hook, a level-0 hook and a recording (level 2) hook. */
function eachHookLevel(fn: () => void): void {
  const scope = globalThis as { [HOOK]?: DevtoolsHook };
  const previous = scope[HOOK];
  delete scope[HOOK];
  try {
    fn();
  } finally {
    scope[HOOK] = previous;
  }
  withHook(0, fn);
  withHook(2, fn);
}
function warnings<T>(fn: () => T): [T, string[]] {
  const seen: string[] = [];
  const spy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => void seen.push(args.map(String).join(" ")));
  try {
    return [fn(), seen];
  } finally {
    spy.mockRestore();
  }
}

test("development: an unbound set/update throws a readable TypeError (prod fails too), at every hook level", () => {
  eachHookLevel(() => {
    const s = dev.signal(0), t = dev.signal(0);
    const { set, update } = s;
    assert.throws(() => set(1), (error: unknown) => error instanceof TypeError && /signal\.set\(\) was called without its signal/.test((error as Error).message));
    assert.throws(() => update((n) => n + 1), (error: unknown) => error instanceof TypeError && /signal\.update\(\) was called without its signal/.test((error as Error).message));
    assert.equal(s(), 0);
    // Method calls, bound calls and calls on another signal behave as in production.
    s.set(3);
    s.update((n) => n + 1);
    s.set.bind(s)(5);
    assert.equal(s(), 5);
    s.set.call(t, 7);
    assert.deepEqual([s(), t()], [5, 7]);
  });
});

test("development: an effect returning a function warns once (returned cleanups are ignored; use onCleanup)", () => {
  eachHookLevel(() => {
    const s = dev.signal(0);
    let cleaned = 0;
    const [stop, seen] = warnings(() => {
      const stop = dev.effect(() => {
        s();
        return () => cleaned++;
      });
      s.set(1);
      return stop;
    });
    stop();
    assert.equal(cleaned, 0);
    assert.equal(seen.length, 1);
    assert.match(seen[0]!, /effect returned a function.*onCleanup/);
    // Returning a non-function value (an expression body) is fine.
    const [, quiet] = warnings(() => dev.effect(() => s())());
    assert.deepEqual(quiet, []);
  });
});

test("development: reading a disposed computed warns once and returns its last value", () => {
  eachHookLevel(() => {
    const s = dev.signal(1);
    let c!: () => number;
    const root = dev.createRoot((dispose) => {
      c = dev.computed(() => s() * 2);
      return dispose;
    });
    const [live, none] = warnings(() => c());
    assert.deepEqual([live, none], [2, []]);
    root.dispose();
    s.set(5);
    const [values, seen] = warnings(() => [c(), c()]);
    assert.deepEqual(values, [2, 2]);
    assert.equal(seen.length, 1);
    assert.match(seen[0]!, /disposed computed/);
    // Still classified and tracked like a computed.
    assert.equal(base._inspect(c)!.kind, "computed");
    assert.ok(_debug(c));
  });
});
