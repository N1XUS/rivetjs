import { test } from "vitest";
import assert from "node:assert/strict";
import { createContext, provide, onCleanup, getOwner } from "@rivetjs/reactivity";
import { renderToString, renderToWriter, template } from "../server.ts";
import type { ServerValue } from "../server.ts";
import type { AsyncWork } from "../async.ts";
const api = (await import("../server-async.ts").catch(() => ({}))) as typeof import("../server-async.ts");
const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void, reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
test("server Async waits in output order with captured context and no fallback", async () => {
  assert.equal(typeof api.Async, "function");
  const token = createContext("none"),
    gate = deferred();
  let fallback = 0,
    cleanup = 0;
  const result = renderToString(() =>
    provide(token, "user", () =>
      template(
        ["before", "after"],
        [
          api.Async({
            load: async (work: AsyncWork) => {
              onCleanup(() => cleanup++);
              await gate.promise;
              assert.equal(getOwner(), null);
              return work.get(token);
            },
            children: (v: string) => v,
            fallback: () => {
              fallback++;
              return "pending";
            },
          }),
        ],
      ),
    ),
  );
  gate.resolve();
  assert.equal(await result, "beforeuserafter");
  assert.equal(fallback, 0);
  assert.equal(cleanup, 1);
});
test("server Async work handles share one class shape, frozen and destructurable", async () => {
  // A frozen object literal with the `signal` accessor was a dictionary-mode object with a fresh map per boundary
  // (old space; its getter closure kept the request graph alive across scavenges).
  const token = createContext("none");
  const works: AsyncWork[] = [];
  const load = (work: AsyncWork) => {
    works.push(work);
    const { get, run, signal } = work;
    return [get(token), run(() => getOwner() !== null), signal.aborted].join();
  };
  const html = await renderToString(() =>
    provide(token, "user", () => template(["", "|", ""], [api.Async({ load, children: (v: string) => v }), api.Async({ load, children: (v: string) => v })])),
  );
  assert.equal(html, "user,true,false|user,true,false");
  assert.equal(works.length, 2);
  const proto = Object.getPrototypeOf(works[0]);
  assert.notEqual(proto, Object.prototype);
  assert.equal(Object.getPrototypeOf(works[1]), proto);
  assert.ok(Object.isFrozen(works[0]) && Object.isFrozen(works[1]));
  assert.deepEqual(Object.keys(works[0]), ["get", "run"]);
});
test("server Async forwards request abort and suppresses late children and error callbacks", async () => {
  assert.equal(typeof api.Async, "function");
  const gate = deferred<string>(),
    controller = new AbortController();
  let work: AsyncWork | undefined,
    children = 0,
    errors = 0,
    cleanup = 0;
  const result = renderToString(
    () =>
      api.Async({
        load: (w: AsyncWork) => {
          work = w;
          onCleanup(() => cleanup++);
          return gate.promise;
        },
        children: () => {
          children++;
          return "late";
        },
        error: () => {
          errors++;
          return "error";
        },
      }),
    { signal: controller.signal },
  ) as Promise<string>;
  controller.abort(Error("stop"));
  await assert.rejects(result, /stop/);
  assert.equal(work!.signal.aborted, true);
  assert.equal(cleanup, 1);
  gate.resolve("data");
  await new Promise((r) => setImmediate(r));
  assert.equal(children, 0);
  assert.equal(errors, 0);
  assert.throws(() => work!.run(() => {}), /disposed|abort|stop/);
});
test("server Async handles load errors only; children encoding and writer failures escape", async () => {
  assert.equal(typeof api.Async, "function");
  let errors = 0;
  const error = () => {
    errors++;
    return "handled";
  };
  assert.equal(
    await renderToString(() =>
      api.Async({
        load: () => {
          throw Error("load");
        },
        children: (x: never) => x,
        error,
      }),
    ),
    "handled",
  );
  assert.equal(await renderToString(() => api.Async({ load: () => Promise.reject(Error("load")), children: (x: never) => x, error })), "handled");
  await assert.rejects(
    renderToString(() =>
      api.Async({
        load: () => 1,
        children: () => {
          throw Error("child");
        },
        error,
      }),
    ) as Promise<string>,
    /child/,
  );
  await assert.rejects(
    // Deliberately unsupported child output: the cast only hides it from the checker.
    renderToString(() => api.Async({ load: () => 1, children: () => ({}) as unknown as ServerValue, error })) as Promise<string>,
    /Unsupported/,
  );
  await assert.rejects(
    renderToWriter(() => api.Async({ load: () => 1, children: () => "ok", error }), {
      write() {
        throw Error("sink");
      },
    }) as Promise<void>,
    /sink/,
  );
  assert.equal(errors, 2);
});
test("lazyComponent shares module loading but never request output; clientOnly never imports on server", async () => {
  assert.equal(typeof api.lazyComponent, "function");
  let imports = 0,
    setups = 0,
    cleanup = 0;
  const C = api.lazyComponent(() => {
    imports++;
    return {
      default: (p: { name: string }) => {
        setups++;
        onCleanup(() => cleanup++);
        return p.name;
      },
    };
  });
  assert.deepEqual(await Promise.all([renderToString(() => C({ name: "A" })), renderToString(() => C({ name: "B" }))]), ["A", "B"]);
  assert.equal(imports, 1);
  assert.equal(setups, 2);
  assert.equal(cleanup, 2);
  const Only = api.clientOnly(
    () => {
      throw Error("browser imported");
    },
    () => {
      throw Error("selected");
    },
    { fallback: (p: { text: string }) => p.text },
  );
  assert.equal(
    renderToString(() => Only({ text: "<fallback>" })),
    "&lt;fallback&gt;",
  );
  assert.equal(
    renderToString(() =>
      api.clientOnly(() => {
        throw Error("browser");
      })({}),
    ),
    "",
  );
});

test("actual compiled TSX isolates async providers and defers client-only browser code", async () => {
  const { compile } = await import("@rivetjs/compiler");
  const source = `
 import {Provider, Async, clientOnly} from '@rivetjs/runtime/server';
 import {createContext,onCleanup,getOwner} from '@rivetjs/reactivity';
 import {captureAsyncContext} from '@rivetjs/runtime/async';
 const User=createContext('none');
 const Browser=clientOnly(()=>{throw Error('browser')},undefined,{fallback:p=><i>{p.name}</i>});
 export function Page({name,gate,events}) {
   onCleanup(()=>events.push('request-clean'));
   return <Provider token={User} value={name}>
     <Async load={async work=>{const own=captureAsyncContext();events.push('load:'+own.get(User));await gate; if(getOwner()!==null)throw Error('global owner leaked');return work.get(User)}} children={name=><section><b>{name}</b><Browser name={name}/></section>}/>
   </Provider>;
 }`;
  const result = compile(source, { target: "server", filename: "async.tsx" });
  assert.deepEqual(result.diagnostics, []);
  const code = result.code
    .replaceAll("@rivetjs/runtime/server", new URL("../server.ts", import.meta.url).href)
    .replaceAll("@rivetjs/runtime/slot", new URL("../slot.ts", import.meta.url).href)
    .replaceAll("@rivetjs/runtime/async", new URL("../async.ts", import.meta.url).href)
    .replaceAll("@rivetjs/reactivity", new URL("../../reactivity/index.ts", import.meta.url).href);
  const { Page } = (await import("data:text/javascript," + encodeURIComponent(code))) as {
    Page: (props: { name: string; gate: Promise<void>; events: string[] }) => ServerValue;
  };
  const a = deferred(),
    b = deferred(),
    eventsA: string[] = [],
    eventsB: string[] = [];
  const first = renderToString(() => Page({ name: "A", gate: a.promise, events: eventsA }));
  const second = renderToString(() => Page({ name: "B", gate: b.promise, events: eventsB }));
  b.resolve();
  assert.equal(await second, "<section><b>B</b><i>B</i></section>");
  assert.deepEqual(eventsB, ["load:B", "request-clean"]);
  assert.deepEqual(eventsA, ["load:A"]);
  a.resolve();
  assert.equal(await first, "<section><b>A</b><i>A</i></section>");
  assert.deepEqual(eventsA, ["load:A", "request-clean"]);
});

test("server abort before lazy completion never starts component setup", async () => {
  const gate = deferred<{ default: () => ServerValue }>(),
    controller = new AbortController();
  let setup = 0;
  const C = api.lazyComponent(() => gate.promise);
  const result = renderToString(() => C({}), { signal: controller.signal }) as Promise<string>;
  controller.abort(Error("stop"));
  await assert.rejects(result, /stop/);
  gate.resolve({
    default: () => {
      setup++;
      return "late";
    },
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(setup, 0);
  assert.equal(await renderToString(() => C({})), "late");
  assert.equal(setup, 1);
});
test("server Async treats promise assimilation failures as load failures", async () => {
  const thenable = Object.defineProperty({}, "then", {
    get() {
      throw Error("assimilation");
    },
  });
  assert.equal(
    await renderToString(() => api.Async({ load: () => thenable, children: () => "unexpected", error: (e: unknown) => (e as Error).message })),
    "assimilation",
  );
});

test("server Async assimilates load thenables with original receiver despite shadowed call", async () => {
  let reads = 0,
    calls = 0;
  const value = {
    get then() {
      reads++;
      return then;
    },
  };
  function then(this: unknown, resolve: (value: string) => void) {
    assert.equal(this, value);
    calls++;
    resolve("loaded");
  }
  (then as { call: unknown }).call = null;
  assert.equal(
    await renderToString(() =>
      api.Async({ load: () => value as unknown as PromiseLike<string>, children: (data: string) => data, error: () => "wrong load error" }),
    ),
    "loaded",
  );
  assert.equal(reads, 1);
  assert.equal(calls, 1);
});

test("server Async creates its AbortController only when the load reads work.signal", async () => {
  const Native = globalThis.AbortController;
  let created = 0;
  globalThis.AbortController = class extends Native {
    constructor() {
      super();
      created++;
    }
  };
  try {
    let stale: AsyncWork | undefined;
    const quiet = await renderToString(() =>
      api.Async({
        load: (work: AsyncWork) => ((stale = work), Promise.resolve("a")),
        children: (v: string) => v,
      }),
    );
    assert.equal(quiet, "a");
    assert.equal(created, 0);
    // Disposed without a read: work.get/run still fail with the abort, and a late read sees an aborted signal.
    assert.throws(() => stale!.run(() => 1), { name: "AbortError" });
    assert.equal(stale!.signal.aborted, true);
    assert.equal(created, 1);
    let read: AbortSignal | undefined;
    const reasons: unknown[] = [];
    const loud = await renderToString(() =>
      api.Async({
        load: (work: AsyncWork) => {
          read = work.signal;
          read.addEventListener("abort", () => reasons.push(read!.reason));
          return Promise.resolve("b");
        },
        children: (v: string) => v,
      }),
    );
    assert.equal(loud, "b");
    assert.equal(created, 2);
    assert.equal(read!.aborted, true);
    assert.equal(reasons.length, 1);
    assert.equal((reasons[0] as Error).name, "AbortError");
  } finally {
    globalThis.AbortController = Native;
  }
});

test("server Async keeps the request abort reason without a controller and materializes it on read", async () => {
  const request = new AbortController();
  const reason = new Error("client went away");
  let stale: AsyncWork | undefined;
  const gate = deferred<string>();
  const result = renderToString(
    () =>
      api.Async({
        load: (work: AsyncWork) => ((stale = work), gate.promise),
        children: (v: string) => v,
      }),
    { signal: request.signal },
  ) as Promise<string>;
  await Promise.resolve();
  request.abort(reason);
  await assert.rejects(result, (error: unknown) => error === reason);
  gate.resolve("late");
  assert.throws(
    () => stale!.get(createContext(0)),
    (error: unknown) => error === reason,
  );
  assert.equal(stale!.signal.reason, reason);
});

test("server Async disposal aborts a read signal with one shared AbortError (RA4: no DOMException per boundary)", async () => {
  const reasons: unknown[] = [];
  for (const value of ["a", "b"]) {
    const html = await renderToString(() =>
      api.Async({
        load: (work: AsyncWork) => {
          const read = work.signal;
          read.addEventListener("abort", () => reasons.push(read.reason));
          return Promise.resolve(value);
        },
        children: (v: string) => v,
      }),
    );
    assert.equal(html, value);
  }
  assert.equal(reasons.length, 2);
  assert.equal(reasons[0], reasons[1]);
  assert.ok(reasons[0] instanceof DOMException);
  assert.equal((reasons[0] as DOMException).name, "AbortError");
  assert.equal((reasons[0] as DOMException).message, "This operation was aborted");
});
