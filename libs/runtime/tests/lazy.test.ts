import { test } from "vitest";
import assert from "node:assert/strict";
import type { LazyFunction } from "../lazy.ts";
// An import failure leaves `api` empty; each test then fails on its typeof assertion.
const api = (await import("../lazy.ts").catch(() => ({}))) as typeof import("../lazy.ts");
const deferred = <T>() => {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
interface Echo {
  default: (x: string) => string;
}
test("lazy calls share imports but execute separately with supplied arguments", async () => {
  assert.equal(typeof api.lazyFunction, "function");
  let imports = 0,
    calls = 0;
  const gate = deferred<Echo>();
  const fn = api.lazyFunction(() => {
    imports++;
    return gate.promise;
  });
  const a = fn("A"),
    b = fn.invoke(["B"]);
  gate.resolve({
    default: (x) => {
      calls++;
      return x;
    },
  });
  assert.deepEqual(await Promise.all([a, b]), ["A", "B"]);
  assert.equal(imports, 1);
  assert.equal(calls, 2);
  assert.equal(await fn("C"), "C");
  assert.equal(imports, 1);
});
test("failed importer and invalid selection retry without caching application failures", async () => {
  assert.equal(typeof api.lazyFunction, "function");
  let attempts = 0;
  const fn = api.lazyFunction(
    () => {
      attempts++;
      if (attempts === 1) throw Error("import");
      return {
        named: () => {
          throw Error("application");
        },
      };
    },
    (m) => m.named,
  );
  await assert.rejects(fn(), /import/);
  await assert.rejects(fn(), /application/);
  await assert.rejects(fn(), /application/);
  assert.equal(attempts, 2);
  let selects = 0;
  // Typed selector: tsc 5.9 and tsgo report the mismatch on the same line (inline, they differ).
  // @ts-expect-error the first selection deliberately returns a non-function
  const select: () => () => number = () => (++selects === 1 ? null : () => 42);
  const invalid: LazyFunction<[], number> = api.lazyFunction(() => ({}), select);
  await assert.rejects(invalid.load(), /function/);
  assert.equal(await invalid(), 42);
});
test("abort cancels only one waiter and prevents that invocation", async () => {
  assert.equal(typeof api.lazyFunction, "function");
  let imports = 0,
    calls = 0;
  const gate = deferred<Echo>();
  const fn = api.lazyFunction(() => {
    imports++;
    return gate.promise;
  });
  const pre = new AbortController();
  pre.abort(Error("pre"));
  await assert.rejects(fn.load({ signal: pre.signal }), /pre/);
  assert.equal(imports, 0);
  const controller = new AbortController();
  const a = fn.invoke(["A"], { signal: controller.signal }),
    b = fn("B");
  controller.abort(Error("stop"));
  await assert.rejects(a, /stop/);
  gate.resolve({
    default: (x) => {
      calls++;
      return x;
    },
  });
  assert.equal(await b, "B");
  assert.equal(calls, 1);
  assert.equal(imports, 1);
  assert.equal(await fn("C"), "C");
});
test("abort after invocation observes the late application rejection", async () => {
  assert.equal(typeof api.lazyFunction, "function");
  const gate = deferred<unknown>(),
    controller = new AbortController();
  let started!: () => void;
  const start = new Promise<void>((r) => (started = r));
  const fn = api.lazyFunction(() => ({
    default: () => {
      started();
      return gate.promise;
    },
  }));
  const result = fn.invoke([], { signal: controller.signal });
  await start;
  controller.abort(Error("stop"));
  await assert.rejects(result, /stop/);
  gate.reject(Error("late"));
  await new Promise((r) => setImmediate(r));
});
test("all cancelled import waiters observe late failure and next caller retries", async () => {
  const gate = deferred<{ default: () => number }>();
  let imports = 0;
  const fn = api.lazyFunction(() => (++imports === 1 ? gate.promise : { default: () => 42 }));
  const a = new AbortController(),
    b = new AbortController();
  const first = fn.load({ signal: a.signal }),
    second = fn.load({ signal: b.signal });
  a.abort(Error("A"));
  b.abort(Error("B"));
  await assert.rejects(first, /A/);
  await assert.rejects(second, /B/);
  gate.reject(Error("late import"));
  await new Promise((r) => setImmediate(r));
  assert.equal(await fn(), 42);
  assert.equal(imports, 2);
});

test("peek returns the selected function only after a load resolved, without importing", async () => {
  let imports = 0;
  const reference = api.lazyFunction(async () => (imports++, { default: (x: number) => x * 2 }));
  assert.equal(reference.peek(), undefined);
  assert.equal(imports, 0);
  await reference.load();
  assert.equal(reference.peek()!(2), 4);
  assert.equal(imports, 1);
});
