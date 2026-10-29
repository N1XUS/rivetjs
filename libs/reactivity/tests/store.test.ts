import { test } from "vitest";
import assert from "node:assert/strict";
import { batch, computed, createRoot, effect, signal } from "@rivetjs/reactivity";
import { at, createStore, produce, read, reconcile, write, type Store, type StorePath, type StoreValue } from "@rivetjs/reactivity/store";
import { _debugStore } from "@rivetjs/reactivity/debug";

interface Todo {
  id: number;
  title: string;
  done: boolean;
}
interface State {
  user: { name: string; email: string };
  todos: Todo[];
  filter: "all" | "done";
  meta?: { tags?: string[] };
}
const initial = (): State => ({
  user: { name: "Ada", email: "ada@example.com" },
  todos: [
    { id: 1, title: "a", done: false },
    { id: 2, title: "b", done: true },
  ],
  filter: "all",
});

/** Run `fn` in an effect; returns the number of runs so far and the last value. */
function watch<T>(fn: () => T): { runs: () => number; last: () => T } {
  let runs = 0,
    last!: T;
  createRoot(() => effect(() => void ((last = fn()), runs++)));
  return { runs: () => runs, last: () => last };
}

test("nodes are created lazily: only read paths get signals", () => {
  const store = createStore(initial());
  assert.equal(store.c, undefined);
  assert.equal(read(store, "user.name"), "Ada");
  assert.deepEqual(Object.keys(store.c!), ["user"]);
  assert.deepEqual(Object.keys(store.c!.user!.c!), ["name"]);
  assert.equal(read(store, "todos.1.title"), "b");
  assert.equal(read(store, "meta.tags"), undefined);
  assert.deepEqual(Object.keys(store.c!), ["user", "todos", "meta"]);
});

test("a write notifies the written path, its ancestors and changed descendants only", () => {
  const store = createStore(initial());
  const name = watch(() => read(store, "user.name"));
  const email = watch(() => read(store, "user.email"));
  const user = watch(() => read(store, "user"));
  const filter = watch(() => read(store, "filter"));
  const all = watch(() => read(store));
  write(store, "user.name", "Grace");
  assert.equal(name.last(), "Grace");
  assert.deepEqual([name.runs(), email.runs(), user.runs(), filter.runs(), all.runs()], [2, 1, 2, 1, 2]);
  assert.equal(user.last().email, "ada@example.com");
  // Equal write: nothing runs.
  write(store, "user.name", "Grace");
  assert.deepEqual([name.runs(), user.runs(), all.runs()], [2, 2, 2]);
  // Replacing the parent refreshes children by value.
  write(store, "user", { name: "Grace", email: "g@example.com" });
  assert.deepEqual([name.runs(), email.runs(), user.runs()], [2, 2, 3]);
  assert.equal(email.last(), "g@example.com");
});

test("writes copy containers along the path and keep untouched subtrees shared", () => {
  const data = initial();
  const store = createStore(data);
  write(store, "todos.0.done", true);
  const next = read(store);
  assert.notEqual(next, data);
  assert.notEqual(next.todos, data.todos);
  assert.notEqual(next.todos[0], data.todos[0]);
  assert.equal(next.todos[1], data.todos[1]);
  assert.equal(next.user, data.user);
  assert.equal(data.todos[0]!.done, false, "the previous data is never mutated");
  assert.ok(Array.isArray(next.todos));
});

test("array writes: updaters, appends and per-index readers", () => {
  const store = createStore(initial());
  const first = watch(() => read(store, "todos.0.done"));
  const second = watch(() => read(store, "todos.1.title"));
  const length = watch(() => read(store, "todos").length);
  write(store, "todos", (todos) => [...todos, { id: 3, title: "c", done: false }]);
  assert.deepEqual([first.runs(), second.runs(), length.runs(), length.last()], [1, 1, 2, 3]);
  write(store, "todos", (todos) => todos.filter((todo) => todo.id !== 1));
  assert.deepEqual([first.last(), second.last(), length.last()], [true, "c", 2]);
  write(store, "todos.5.title", "far");
  assert.equal(read(store, "todos").length, 6);
  assert.equal(read(store, "todos.5.title"), "far");
});

test("missing containers are created; index segments create arrays", () => {
  const store = createStore<State>(initial());
  write(store, "meta.tags.0", "x");
  assert.deepEqual(read(store, "meta"), { tags: ["x"] });
  assert.ok(Array.isArray(read(store, "meta.tags")));
});

test("one write is one flush; batches combine writes", () => {
  const store = createStore(initial());
  const both = watch(() => read(store, "user.name") + read(store, "filter"));
  write(store, "user", (user) => ({ ...user, name: "B" }));
  assert.equal(both.runs(), 2);
  batch(() => {
    write(store, "user.name", "C");
    write(store, "filter", "done");
  });
  assert.deepEqual([both.runs(), both.last()], [3, "Cdone"]);
});

test("views read and write relative paths", () => {
  const store = createStore(initial());
  const row = at(store, "todos.1");
  assert.deepEqual(row, { s: store, p: "todos.1." });
  const done = watch(() => read(row, "done"));
  write(row, "done", false);
  assert.equal(done.last(), false);
  assert.equal(read(store, "todos.1.done"), false);
  write(row, (todo) => ({ ...todo, title: "B" }));
  assert.equal(read(store, "todos.1.title"), "B");
  assert.equal(read(at(row, "title")), "B");
  assert.equal(done.runs(), 2);
});

test("produce mutates a copy; reconcile keeps identity of equal subtrees", () => {
  const data = initial();
  const store = createStore(data);
  const user = watch(() => read(store, "user"));
  const second = watch(() => read(store, "todos.1"));
  write(
    store,
    produce((draft) => {
      draft.todos[0]!.done = true;
      draft.filter = "done";
    }),
  );
  assert.equal(data.todos[0]!.done, false);
  assert.equal(read(store, "todos.0.done"), true);
  assert.equal(read(store, "user"), data.user);
  assert.equal(read(store, "todos.1"), data.todos[1]);
  assert.deepEqual([user.runs(), second.runs()], [1, 1]);
  write(
    store,
    "todos",
    reconcile([
      { id: 1, title: "a", done: true },
      { id: 2, title: "b", done: true },
    ]),
  );
  assert.equal(read(store, "todos.1"), data.todos[1]);
  assert.equal(second.runs(), 1);
  // An equal reconcile is a no-op.
  const before = read(store);
  write(store, reconcile(structuredClone(before)));
  assert.equal(read(store), before);
});

test("computed reads track paths; writes inside a computed are rejected", () => {
  const store = createStore(initial());
  const open = computed(() => read(store, "todos").filter((todo) => !todo.done).length);
  assert.equal(open(), 1);
  write(store, "todos.1.done", false);
  assert.equal(open(), 2);
  const bad = computed(() => write(store, "filter", "done"));
  assert.throws(bad, /not allowed during computed/);
});

test("invalid paths are rejected", () => {
  const store = createStore(initial());
  for (const path of ["a..b", "__proto__", "user.constructor", "x."]) assert.throws(() => read(store, path as never), /Invalid store path/, path);
  assert.throws(() => write(store, "__proto__.x" as never, 1 as never), /Invalid store path/);
});

test("the store is a plain object of signals (resume-serializable shape)", () => {
  const store = createStore(initial());
  read(store, "user.name");
  assert.equal(Object.getPrototypeOf(store), Object.prototype);
  assert.deepEqual(Object.keys(store), ["v", "c"]);
  assert.equal(typeof store.v.set, "function");
  const name = store.c!.user!.c!.name!;
  assert.deepEqual(Object.keys(name), ["v"]);
  // Shared data: the child node's value is the object inside the root value.
  assert.equal(untracked(store.c!.user!), read(store).user);
});
const untracked = (node: Store<unknown>): unknown => node.v();

test("a store revived from its nodes (as resume does) keeps working", () => {
  const original = createStore(initial());
  read(original, "user.name");
  // Rebuild the node tree with fresh signals and shared data, like the resume decoder.
  const data = original.v();
  const revived = { v: signal(data), c: { user: { v: signal(data.user), c: { name: { v: signal(data.user.name) } } } } } as unknown as Store<State>;
  const name = watch(() => read(revived, "user.name"));
  write(revived, "user.name", "Zed");
  assert.deepEqual([name.runs(), name.last(), read(revived, "user.email")], [2, "Zed", "ada@example.com"]);
});

test("_debugStore lists read paths with values and observer counts", () => {
  const store = createStore(initial());
  watch(() => read(store, "user.name"));
  read(store, "filter");
  const tree = _debugStore(store as never);
  assert.equal(tree.path, "");
  assert.deepEqual(
    tree.children.map((child) => child.path),
    ["user", "filter"],
  );
  const name = tree.children[0]!.children[0]!;
  assert.deepEqual([name.path, name.value, name.observers], ["user.name", "Ada", 1]);
});

// Type-level checks (compile-time only).
const typed = createStore(initial());
const n: string = read(typed, "user.name");
const done: boolean = read(typed, "todos.0.done");
// @ts-expect-error unknown path
read(typed, "user.nope");
// @ts-expect-error wrong value type
write(typed, "todos.0.done", "yes");
write(typed, "todos.0.title", (title) => title.toUpperCase());
const path: StorePath<State> = "meta.tags.3";
type _Name = StoreValue<State, "user.name"> extends string ? true : never;
const _check: _Name = true;
void [n, done, path, _check];

test("development façade reports store.create with a lazy tree", async () => {
  const { HOOK } = await import("@rivetjs/reactivity/debug");
  const dev = await import("../store-dev.ts");
  const events: [string, Record<string, unknown>][] = [];
  const holder = globalThis as { [HOOK]?: unknown };
  const previous = holder[HOOK];
  holder[HOOK] = { v: 1, level: 1, stacks: false, emit: (type: string, data: Record<string, unknown>) => events.push([type, data]) };
  try {
    const store = dev.createStore({ a: { b: 1 } });
    dev.read(store, "a.b");
    const [type, data] = events.find(([t]) => t === "store.create")!;
    assert.equal(type, "store.create");
    assert.equal(data.store, store);
    assert.deepEqual(
      (data.tree as () => { children: { path: string }[] })().children.map((c) => c.path),
      ["a"],
    );
  } finally {
    holder[HOOK] = previous;
  }
});

test("produce copies only the touched path: untouched subtrees, class instances and functions keep identity", () => {
  class Point {
    x: number;
    constructor(x: number) {
      this.x = x;
    }
  }
  const when = new Date(0),
    point = new Point(1),
    format = (n: number) => String(n);
  const data = { a: { deep: { n: 1 } }, b: { m: 2 }, when, point, format, list: [{ v: 1 }, { v: 2 }, { v: 3 }] };
  const store = createStore(data);
  const b = watch(() => read(store, "b"));
  const pointRuns = watch(() => read(store, "point"));
  write(
    store,
    produce((draft) => {
      draft.a.deep.n = 5;
    }),
  );
  const next = read(store);
  assert.notEqual(next, data);
  assert.notEqual(next.a, data.a);
  assert.deepEqual(next.a, { deep: { n: 5 } });
  assert.equal(data.a.deep.n, 1);
  assert.equal(next.b, data.b);
  assert.equal(next.list, data.list);
  assert.equal(next.when, when);
  assert.equal(next.point, point);
  assert.ok(next.point instanceof Point);
  assert.equal(next.format, format);
  assert.deepEqual([b.runs(), pointRuns.runs()], [1, 1]);
  // Reads without writes, and writes of equal values, change nothing.
  write(
    store,
    produce((draft) => {
      void draft.a.deep.n;
      draft.b.m = 2;
      draft.b = { m: 2 };
    }),
  );
  assert.equal(read(store), next);
  // Array methods through the draft.
  write(
    store,
    "list",
    produce((list) => {
      list.push({ v: 4 });
      list.splice(0, 1);
      list[0]!.v = 20;
      list.reverse();
    }),
  );
  assert.deepEqual(read(store, "list"), [{ v: 4 }, { v: 3 }, { v: 20 }]);
  assert.ok(Array.isArray(read(store, "list")));
  assert.equal(read(store, "list.1"), data.list[2]);
  // New containers holding drafts, deletes and filter-assign.
  write(
    store,
    produce((draft) => {
      draft.b = { m: draft.a.deep.n } as never;
      (draft as { extra?: unknown }).extra = { inner: draft.a, rows: draft.list.filter((row) => row.v > 3) };
      delete (draft as { when?: Date }).when;
    }),
  );
  const last = read(store) as typeof next & { extra: { inner: unknown; rows: unknown[] } };
  assert.deepEqual(last.b, { m: 5 });
  assert.equal(last.extra.inner, last.a);
  assert.deepEqual(last.extra.rows, [{ v: 4 }, { v: 20 }]);
  assert.equal(last.extra.rows[0], last.list[0]);
  assert.equal("when" in last, false);
});

test("produce: shortening an array discards previously read or edited child drafts", () => {
  type State = { items: { n: number }[]; stable: { value: number } };
  const recipes: Record<string, (draft: State) => void> = {
    read: (draft) => {
      void draft.items[1]!.n;
      draft.items.length = 0;
    },
    edit: (draft) => {
      draft.items[1]!.n = 7;
      draft.items.length = 0;
    },
    detached: (draft) => {
      const removed = draft.items[1]!;
      draft.items.length = 0;
      removed.n = 7;
    },
    descriptor: (draft) => {
      void draft.items[1]!.n;
      Object.defineProperty(draft.items, "length", { value: 0 });
    },
  };
  for (const [name, mutate] of Object.entries(recipes)) {
    const initial: State = { items: [{ n: 1 }, { n: 2 }], stable: { value: 3 } };
    const store = createStore(initial);
    const length = watch(() => read(store, "items").length);
    write(store, produce(mutate));
    assert.deepEqual(read(store, "items"), [], name);
    assert.equal(length.last(), 0, name);
    assert.equal(length.runs(), 2, name);
    assert.deepEqual(initial.items, [{ n: 1 }, { n: 2 }], name + ": original state stays immutable");
    assert.equal(read(store, "stable"), initial.stable, name + ": untouched subtree keeps identity");
  }
});

test("produce: reads after truncation see deleted keys, and regrowing length preserves holes", () => {
  const store = createStore({ items: [{ n: 1 }, { n: 2 }] });
  write(
    store,
    produce((draft) => {
      void draft.items[0]!.n;
      void draft.items[1]!.n;
      draft.items.length = 0;
      assert.equal(draft.items[0], undefined);
      assert.equal(draft.items[1], undefined);
      draft.items.length = 2;
    }),
  );
  const items = read(store, "items");
  assert.equal(items.length, 2);
  assert.deepEqual(Object.keys(items), [], "regrowth creates holes instead of resurrecting the deleted objects");
});

test("produce: explicit reinsertion of a removed child draft is kept", () => {
  for (const edited of [false, true]) {
    const initial = { items: [{ n: 1 }], stable: { value: 3 } };
    const store = createStore(initial);
    write(
      store,
      produce((draft) => {
        const removed = draft.items[0]!;
        draft.items.length = 0;
        if (edited) removed.n = 7;
        draft.items[0] = removed;
        assert.equal(draft.items.length, 1, "an explicit assignment restores the array element");
      }),
    );
    assert.deepEqual(read(store, "items"), [{ n: edited ? 7 : 1 }]);
    assert.deepEqual(initial.items, [{ n: 1 }]);
    assert.equal(read(store, "stable"), initial.stable);
    if (!edited) assert.equal(read(store), initial, "restoring the same value is a semantic no-op");
  }
});

test("produce: a sparse array length change survives parent structural sharing", () => {
  const store = createStore({ items: new Array<{ n: number }>(3) });
  write(
    store,
    produce((draft) => {
      draft.items = draft.items.slice(0, 1);
    }),
  );
  assert.equal(read(store, "items").length, 1);
  assert.deepEqual(Object.keys(read(store, "items")), []);
});

test("produce: Map / Set / Date reached through the draft are copies; the draft is revoked afterwards", () => {
  const tags = new Map([["a", 1]]),
    seen = new Set([1]),
    other = new Map([["z", 0]]);
  const store = createStore({ tags, seen, other });
  let leaked: { tags: Map<string, number> } | null = null;
  write(
    store,
    produce((draft) => {
      draft.tags.set("b", 2);
      draft.seen.add(2);
      leaked = draft;
    }),
  );
  assert.deepEqual(
    [...read(store, "tags")],
    [
      ["a", 1],
      ["b", 2],
    ],
  );
  assert.deepEqual([...read(store, "seen")], [1, 2]);
  assert.deepEqual([...tags], [["a", 1]]);
  assert.deepEqual([...seen], [1]);
  assert.equal(read(store, "other"), other);
  assert.throws(() => leaked!.tags, TypeError);
});

test("refresh prunes unobserved nodes of removed keys; observed ones stay and see the key return", () => {
  const store = createStore({ rows: { a: { title: "A" }, b: { title: "B" }, c: { title: "C" } } as Record<string, { title: string } | undefined> });
  // Untracked reads create nodes without observers.
  read(store, "rows.a.title");
  read(store, "rows.b.title");
  const c = watch(() => read(store, "rows.c.title"));
  write(store, "rows", (rows) => ({ b: rows.b }));
  assert.deepEqual(Object.keys(store.c!.rows!.c!).sort(), ["b", "c"]);
  assert.equal(c.last(), undefined);
  write(store, "rows.c", { title: "C2" });
  assert.equal(c.last(), "C2");
  // A pruned path reads its current value again.
  assert.equal(read(store, "rows.a.title"), undefined);
  write(store, "rows.a", { title: "A2" });
  assert.equal(read(store, "rows.a.title"), "A2");
});
