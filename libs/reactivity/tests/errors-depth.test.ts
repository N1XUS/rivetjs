// Error surfacing, cached computed failures, catchError scope, duplicate links and deep chains
// (round-2 review C9 / C17).
import { test, vi } from "vitest";
import assert from "node:assert/strict";
import { signal, computed, effect, batch, createRoot, createContext, provide, useContext, catchError, getOwner, onCleanup, _flush } from "@rivetjs/reactivity";
import * as dev from "../dev.ts";

/** Capture `_flush.report` calls (every failure of a multi-error flush / run / dispose). */
function reports<T>(fn: (seen: unknown[][]) => T): T {
  const previous = _flush.report,
    seen: unknown[][] = [];
  _flush.report = (errors) => void seen.push(errors.slice());
  try {
    return fn(seen);
  } finally {
    _flush.report = previous;
  }
}
const messages = (errors: unknown[]): string[] => errors.map((error) => (error as Error).message);

test("dispose: every cleanup error surfaces (first thrown, all reported)", () => {
  reports((seen) => {
    const root = createRoot(() => {
      onCleanup(() => {
        throw new Error("a");
      });
      effect(() =>
        onCleanup(() => {
          throw new Error("b");
        }),
      );
      onCleanup(() => {
        throw new Error("c");
      });
    });
    assert.throws(() => root.dispose(), /^Error: b$/);
    assert.deepEqual(seen.map(messages), [["b", "a", "c"]]);
  });
});

test("effect re-run: cleanup errors and the run's own error all surface", () => {
  reports((seen) => {
    const s = signal(0),
      caught: string[] = [];
    createRoot(() =>
      catchError(
        () =>
          effect(() => {
            const value = s();
            onCleanup(() => {
              throw new Error(`cleanup1 ${value}`);
            });
            onCleanup(() => {
              throw new Error(`cleanup2 ${value}`);
            });
            if (value === 1) throw new Error("run 1");
          }),
        (error) => caught.push((error as Error).message),
      ),
    );
    s.set(1);
    assert.deepEqual(caught, ["cleanup1 0"]);
    assert.deepEqual(seen.map(messages), [["cleanup1 0", "cleanup2 0", "run 1"]]);
  });
});

test("a failed computed caches its error: no recompute until a source changes", () => {
  const s = signal(1);
  let runs = 0;
  const c = computed(() => {
    runs++;
    if (s() % 2) throw new Error(`odd ${s()}`);
    return s();
  });
  assert.throws(c, /odd 1/);
  let first: unknown;
  try {
    c();
  } catch (error) {
    first = error;
  }
  try {
    c();
  } catch (error) {
    assert.equal(error, first);
  }
  assert.equal(runs, 1);
  s.set(2);
  assert.equal(c(), 2);
  assert.equal(runs, 2);
  s.set(3);
  assert.throws(c, /odd 3/);
  assert.throws(c, /odd 3/);
  assert.equal(runs, 3);
});

test("an effect reading a failed computed re-runs once per change, then recovers", () => {
  const s = signal(0),
    seen: (number | string)[] = [];
  let runs = 0;
  const c = computed(() => {
    runs++;
    if (s() === 1) throw new Error("bad");
    return s();
  });
  createRoot(() =>
    catchError(
      () => effect(() => seen.push(c())),
      (error) => seen.push((error as Error).message),
    ),
  );
  s.set(1);
  s.set(2);
  assert.deepEqual(seen, [0, "bad", 2]);
  assert.equal(runs, 3);
});

test("recovering to the pre-failure value still notifies", () => {
  const s = signal(0),
    seen: (number | string)[] = [];
  const c = computed(() => {
    if (s() === 1) throw new Error("bad");
    return s() > 1 ? 0 : s();
  });
  createRoot(() =>
    catchError(
      () => effect(() => seen.push(c())),
      (error) => seen.push((error as Error).message),
    ),
  );
  s.set(1);
  s.set(2);
  assert.deepEqual(seen, [0, "bad", 0]);
});

test("equals is called as a plain function (no `this` = internal node)", () => {
  const thisValues: unknown[] = [];
  function equals(this: unknown, a: number, b: number): boolean {
    thisValues.push(this);
    return a === b;
  }
  const s = signal<number>(1, { equals });
  const c = computed(() => s() * 2, { equals });
  effect(() => void c());
  s.set(2);
  assert.ok(thisValues.length >= 2);
  for (const value of thisValues) assert.equal(value, undefined);
});

test("catchError: a synchronous throw disposes the partly built subtree", () => {
  const s = signal(0),
    log: string[] = [];
  createRoot(() =>
    catchError(
      () => {
        effect(() => log.push(`effect ${s()}`));
        onCleanup(() => log.push("cleanup"));
        throw new Error("half built");
      },
      (error) => log.push((error as Error).message),
    ),
  );
  assert.deepEqual(log, ["effect 0", "cleanup", "half built"]);
  s.set(1);
  assert.deepEqual(log, ["effect 0", "cleanup", "half built"]);
});

test("catchError: the handler runs under the catchError scope during a flush", () => {
  const token = createContext("default"),
    s = signal(0);
  let handlerOwner: unknown = "unset",
    scope: unknown = null,
    context = "";
  createRoot(() =>
    provide(token, "provided", () =>
      catchError(
        () => {
          scope = getOwner();
          effect(() => {
            if (s()) throw new Error("x");
          });
        },
        () => {
          handlerOwner = getOwner();
          context = useContext(token);
        },
      ),
    ),
  );
  s.set(1);
  assert.equal(handlerOwner, scope);
  assert.equal(context, "provided");
});

test("development: catchError warns when fn returns a promise (its rejection is not observed)", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const rejected = Promise.reject(new Error("async"));
    rejected.catch(() => {});
    dev.createRoot(() =>
      dev.catchError(
        () => rejected,
        () => {},
      ),
    );
    assert.equal(warn.mock.calls.length, 1);
    assert.match(String(warn.mock.calls[0][0]), /promise/);
    dev.createRoot(() =>
      dev.catchError(
        () => 1,
        () => {},
      ),
    );
    assert.equal(warn.mock.calls.length, 1);
  } finally {
    warn.mockRestore();
  }
});

test("a source read before and after a nested run links once", () => {
  const s = signal(0);
  let runs = 0;
  createRoot(() =>
    effect(() => {
      runs++;
      s();
      // A computed evaluated inside this run reads the same source (newer epoch).
      computed(() => s())();
      s();
    }),
  );
  s.set(1);
  assert.equal(runs, 2);
  // Interleaved: read, nested read, another read, then the first again.
  const t = signal(0);
  let inner = 0;
  createRoot(() =>
    effect(() => {
      inner++;
      s();
      computed(() => s() + t())();
      t();
      s();
    }),
  );
  s.set(2);
  t.set(1);
  assert.equal(inner, 3);
  const internal = (s as unknown as Record<symbol, { observers: unknown }>)[Object.getOwnPropertySymbols(s).find((sym) => sym.description === "rivet.signal")!];
  const observers = internal.observers;
  const list = Array.isArray(observers) ? observers : [observers];
  // Two effects + one live nested computed each (re-created per run): no effect appears twice.
  assert.equal(new Set(list).size, list.length);
});

test("deep computed chains: write propagation and pull are iterative (no stack growth)", () => {
  const depth = 20000;
  const s = signal(0);
  let c: () => number = s;
  const chain: (() => number)[] = [];
  for (let i = 0; i < depth; i++) {
    const previous = c;
    c = computed(() => previous() + 1);
    chain.push(c);
  }
  // First reads bottom-up (each one level deep), then an effect on the tail: writes mark and pull
  // through the whole chain without recursion.
  for (const node of chain) node();
  let seen = 0;
  createRoot(() =>
    effect(() => {
      seen = c();
    }),
  );
  assert.equal(seen, depth);
  s.set(1);
  assert.equal(seen, depth + 1);
  batch(() => s.set(5));
  assert.equal(seen, depth + 5);
});

test("a lazy first read of a 1,000-deep chain evaluates (development wrappers included)", () => {
  const s = signal(0);
  let c: () => number = s;
  for (let i = 0; i < 1000; i++) {
    const previous = c;
    c = computed(() => previous() + 1);
  }
  assert.equal(c(), 1000);
});

test("createRoot attaches to the current owner (disposed with it — unlike Solid's detached roots)", () => {
  const log: string[] = [];
  const outer = createRoot(() => {
    createRoot(() => onCleanup(() => log.push("inner")));
  });
  outer.dispose();
  assert.deepEqual(log, ["inner"]);
});
