import { test } from "vitest";
import assert from "node:assert/strict";
import { _list, _listPlan, compiledTemplate, Provider, ErrorBoundary, Suspense, Async, renderToString, renderToWriter } from "../server.ts";
import type { ServerValue } from "../server.ts";
import { createRoot, createContext, effect, getOwner, onCleanup, provide, signal, useContext } from "@rivetjs/reactivity";

const plan = _listPlan(["<i>", "</i>"], [null]);
const root = (list: boolean, values: ServerValue[]): ServerValue =>
  list
    ? (_list(
        values,
        (value) => compiledTemplate(plan.fragments, [value as ServerValue]),
        plan,
        (tape, base, value) => {
          tape[base] = value;
        },
      ) as ServerValue)
    : compiledTemplate(
        Array.from({ length: values.length + 1 }, (_, i) => (i === 0 ? "<p>" : i === values.length ? "</p>" : "|")),
        values,
      );

for (const list of [false, true]) {
  const label = list ? "list" : "compiled";
  test(`${label} root admits thenables before output and restores ownership after a writer wait`, async () => {
    const context = createContext("outside"),
      log: string[] = [],
      chunks: string[] = [];
    let release: (() => void) | undefined,
      disposed = 0;
    const outer = createRoot(() =>
      provide(context, "parent", () => {
        onCleanup(() => disposed++);
        const thenable = {
          get then() {
            log.push("get:" + useContext(context));
            return function (this: unknown, resolve: (value: string) => void) {
              assert.equal(this, thenable);
              log.push("invoke");
              resolve("async");
            };
          },
        } as PromiseLike<string>;
        return renderToWriter(
          root(list, [
            thenable,
            () => {
              log.push("child:" + useContext(context));
              return "tail";
            },
          ]),
          {
            write(chunk) {
              chunks.push(chunk);
              log.push("write:" + useContext(context));
              if (chunks.length === 1)
                return new Promise<void>((done) => {
                  release = done;
                });
            },
          },
        );
      }),
    );
    assert.deepEqual(log, ["get:parent", "write:parent"]);
    assert.equal(getOwner(), null);
    await Promise.resolve();
    assert.deepEqual(log, ["get:parent", "write:parent", "invoke"]);
    release!();
    await outer.value;
    assert.equal(chunks.join(""), list ? "<i>async</i><i>tail</i>" : "<p>async|tail</p>");
    assert.equal(log.filter((entry) => entry === "get:parent").length, 1);
    assert.ok(log.includes("child:parent"));
    assert.ok(log.filter((entry) => entry.startsWith("write:")).every((entry) => entry === "write:parent"));
    assert.equal(disposed, 0, "a preformed root does not own the caller's scope");
    outer.dispose();
    assert.equal(disposed, 1);
    assert.equal(getOwner(), null);
  });

  test(`${label} root admits later rejections and disposes scopes before an earlier writer failure`, async () => {
    const log: string[] = [],
      unhandled: unknown[] = [];
    const listener = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", listener);
    try {
      const later = {
        get then() {
          log.push("get");
          return (_resolve: unknown, reject: (reason: unknown) => void) => {
            log.push("reject");
            reject(Error("later"));
          };
        },
      } as PromiseLike<string>;
      const scope = Provider({
        token: createContext(null),
        value: null,
        children: () => {
          onCleanup(() => log.push("dispose"));
          return "scoped";
        },
      });
      const rendered = renderToWriter(root(list, ["first", later, scope]), {
        write() {
          log.push("write");
          throw Error("writer failed");
        },
      });
      assert.deepEqual(log, ["get", "write", "dispose"]);
      await assert.rejects(rendered as Promise<void>, /writer failed/);
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.deepEqual(log, ["get", "write", "dispose", "reject"]);
      assert.deepEqual(unhandled, []);
    } finally {
      process.off("unhandledRejection", listener);
    }
  });

  test(`${label} root keeps initial admission tracked while writer callbacks are untracked`, () => {
    const admitted = signal(0),
      written = signal(0);
    let renders = 0;
    const value = {
      get then() {
        admitted();
        return undefined;
      },
    };
    const outer = createRoot(() =>
      effect(() => {
        renders++;
        const rendered = renderToWriter(root(list, [() => "child", value as unknown as ServerValue]), {
          write() {
            written();
            throw Error("stop before unsupported child");
          },
        });
        void (rendered as Promise<void>).catch(() => {});
      }),
    );
    assert.equal(renders, 1);
    written.set(1);
    assert.equal(renders, 1);
    admitted.set(1);
    assert.equal(renders, 2);
    outer.dispose();
  });
}

test("a reused list observes one rejection and disposes scopes once across error boundaries", async () => {
  const log: string[] = [],
    chunks: string[] = [];
  const scope = Provider({
    token: createContext(null),
    value: null,
    children: () => {
      onCleanup(() => log.push("dispose"));
      return "scope";
    },
  });
  const rejected = {
    get then() {
      log.push("get");
      return (_resolve: unknown, reject: (reason: unknown) => void) => {
        log.push("reject");
        reject(Error("shared failure"));
      };
    },
  } as PromiseLike<string>;
  const shared = root(true, ["partial", rejected, scope]);
  const boundary = (label: string) =>
    ErrorBoundary({
      children: () => shared,
      fallback: (error) => {
        assert.equal((error as Error).message, "shared failure");
        return label;
      },
    });
  await renderToWriter([boundary("first"), boundary("second")], { write: (chunk) => void chunks.push(chunk) });
  assert.equal(chunks.join(""), "firstsecond");
  assert.deepEqual(log, ["get", "reject", "dispose"]);
});

test("a reused list beneath Suspense awaits Async content for both visits", async () => {
  let resolve!: (value: string) => void,
    loads = 0,
    children = 0,
    disposed = 0,
    fallback = 0;
  const gate = new Promise<string>((done) => {
    resolve = done;
  });
  const value = Suspense({
    fallback: () => {
      fallback++;
      return "waiting";
    },
    children: () => {
      onCleanup(() => disposed++);
      const shared = root(true, [
        Async({
          load: () => {
            loads++;
            return gate;
          },
          children: (text) => {
            children++;
            return compiledTemplate(["<b>", "</b>"], [text]);
          },
        }),
      ]);
      return [shared, shared];
    },
  });
  const rendering = renderToString(value);
  assert.equal(loads, 1);
  assert.equal(children, 0);
  resolve("ready");
  assert.equal(await rendering, "<i><b>ready</b></i><i><b>ready</b></i>");
  assert.equal(children, 2);
  assert.equal(disposed, 1);
  assert.equal(fallback, 0);
});

test("a reused list still disposes scopes resolved after cancellation", async () => {
  const disposed: string[] = [];
  const makeScope = (label: string) =>
    Provider({
      token: createContext(null),
      value: null,
      children: () => {
        onCleanup(() => disposed.push(label));
        return label;
      },
    });
  let resolve!: (value: ServerValue) => void;
  const later = new Promise<ServerValue>((done) => {
    resolve = done;
  });
  const shared = root(true, ["head", makeScope("prepared"), later]);
  const controller = new AbortController();
  let writes = 0;
  const rendering = renderToWriter(
    [shared, shared],
    {
      write() {
        writes++;
        return new Promise(() => {});
      },
    },
    { signal: controller.signal },
  );
  controller.abort(Error("cancel shared list"));
  await assert.rejects(rendering as Promise<void>, /cancel shared list/);
  assert.equal(writes, 1);
  assert.deepEqual(disposed, ["prepared"]);
  resolve(makeScope("late"));
  await new Promise<void>((done) => setImmediate(done));
  assert.deepEqual(disposed, ["prepared", "late"]);
  assert.equal(writes, 1);
});

test("a reused list reads mutable public descendants at each visit", async () => {
  const values: ServerValue[] = ["first"];
  const shared = root(true, [values]);
  const chunks: string[] = [];
  let release!: () => void;
  const rendering = renderToWriter([shared, shared], {
    write(chunk) {
      chunks.push(chunk);
      if (chunks.length === 1)
        return new Promise<void>((done) => {
          release = done;
        });
    },
  });
  values[0] = "changed";
  release();
  await rendering;
  assert.equal(chunks.join(""), "<i>changed</i><i>changed</i>");
});

test("nested compiled records are admitted once: slot reads stay constant per level at any depth", () => {
  const fragments = Object.freeze(["<b>", "</b>"]);
  const depth = 40,
    reads: number[] = [];
  let value: ServerValue = "x";
  for (let level = 0; level < depth; level++) {
    const slots: ServerValue[] = [];
    const child = value;
    Object.defineProperty(slots, 0, { get: () => ((reads[level] = (reads[level] ?? 0) + 1), child), enumerable: true });
    slots.length = 1;
    value = compiledTemplate(fragments, slots);
  }
  for (const writer of ["string", "bytes"] as const) {
    reads.length = 0;
    const out: string[] = [];
    const sink =
      writer === "string"
        ? { write: (chunk: string) => void out.push(chunk) }
        : {
            write: (chunk: string) => void out.push(chunk),
            writeBytes: (bytes: Uint8Array) => void out.push(new TextDecoder().decode(bytes)),
            writeInteger: (n: number) => void out.push(String(n)),
          };
    assert.equal(renderToWriter(value, sink), undefined);
    assert.equal(out.join(""), "<b>".repeat(depth) + "x" + "</b>".repeat(depth));
    // One read by root admission, one by traversal (was: depth - level + 1 admission reads).
    assert.deepEqual(
      reads,
      Array.from({ length: depth }, () => 2),
      writer,
    );
  }
});
