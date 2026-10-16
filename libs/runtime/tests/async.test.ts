import { test } from "vitest";
import assert from "node:assert/strict";
import { createRoot, createContext, provide, getOwner, onCleanup } from "@rivetjs/reactivity";
import type { Owner } from "@rivetjs/reactivity";
import { renderToString, renderToWriter, attribute, template } from "../server.ts";
import type { ServerValue } from "../server.ts";
import type { AsyncContext } from "../async.ts";
const api = (await import("../async.ts").catch(() => ({}))) as typeof import("../async.ts");
const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void, reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};

test("captured context reads after await without retaining global ownership", async () => {
  assert.equal(typeof api.captureAsyncContext, "function");
  const token = createContext("default");
  let captured: AsyncContext | undefined;
  const root = createRoot(() =>
    provide(token, "local", () => {
      captured = api.captureAsyncContext();
      return captured!.get(token);
    }),
  );
  assert.equal(root.value, "local");
  await Promise.resolve();
  assert.equal(getOwner(), null);
  assert.equal(captured!.get(token), "local");
  assert.equal(
    captured!.run(() => getOwner() !== null),
    true,
  );
  root.dispose();
  assert.throws(() => captured!.get(token), /disposed/);
  assert.throws(() => api.captureAsyncContext(), /owner|owned/);
});
test("request factories retain isolated owners through children and writer acknowledgments", async () => {
  assert.equal(typeof api.captureAsyncContext, "function");
  const token = createContext("none"),
    a = deferred(),
    b = deferred(),
    write = deferred();
  let cleanups = 0;
  const factory = (name: string, gate: ReturnType<typeof deferred<void>>) => () =>
    provide(token, name, async () => {
      onCleanup(() => cleanups++);
      const context = api.captureAsyncContext();
      await gate.promise;
      assert.equal(getOwner(), null);
      return context.get(token);
    });
  const chunks: string[] = [];
  const first = renderToWriter(factory("A", a), {
    write(v: string) {
      chunks.push(v);
      return write.promise;
    },
  });
  const second = renderToString(factory("B", b));
  b.resolve();
  assert.equal(await second, "B");
  assert.equal(cleanups, 1);
  a.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(cleanups, 1);
  write.resolve();
  await first;
  assert.deepEqual(chunks, ["A"]);
  assert.equal(cleanups, 2);
  assert.equal(getOwner(), null);
});
test("request cleanup occurs once on abort and primary errors survive cleanup failures", async () => {
  assert.equal(typeof api.captureAsyncContext, "function");
  let cleanups = 0;
  const controller = new AbortController();
  let captured: AsyncContext | undefined;
  const result = renderToString(
    () => {
      captured = api.captureAsyncContext();
      onCleanup(() => cleanups++);
      return new Promise<string>(() => {});
    },
    { signal: controller.signal },
  ) as Promise<string>;
  controller.abort(new Error("cancel"));
  await assert.rejects(result, /cancel/);
  assert.equal(cleanups, 1);
  assert.throws(() => captured!.run(() => {}), /disposed/);
  await assert.rejects(
    renderToString(() => {
      onCleanup(() => {
        throw Error("cleanup");
      });
      throw Error("primary");
    }) as Promise<string>,
    /primary/,
  );
  await assert.rejects(
    renderToString(() => {
      onCleanup(() => {
        throw Error("cleanup");
      });
      return "ok";
    }) as Promise<string>,
    /cleanup/,
  );
});
test("strict async authoring types retain context and lazy function/component arguments", async () => {
  const { default: ts } = await import("typescript");
  const program = ts.createProgram([new URL("./async-types.tsx", import.meta.url).pathname], {
    strict: true,
    noEmit: true,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: "@rivetjs/runtime",
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    allowImportingTsExtensions: true,
  });
  assert.deepEqual(
    ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    [],
  );
});
test("capture rejects an owner disposed during synchronous setup", () => {
  createRoot((dispose) => {
    dispose();
    assert.throws(() => api.captureAsyncContext(), /disposed/);
  });
});

test("request owners release on rejected children and synchronous/asynchronous sink failures", async () => {
  for (const scenario of ["child", "sync sink", "async sink"]) {
    let cleanup = 0;
    const factory = () => {
      onCleanup(() => cleanup++);
      return scenario === "child" ? Promise.reject(Error(scenario)) : "output";
    };
    const writer = {
      write() {
        if (scenario === "sync sink") throw Error(scenario);
        return Promise.reject(Error(scenario));
      },
    };
    await assert.rejects(renderToWriter(factory, writer) as Promise<void>, (error) => (error as Error).message === scenario);
    assert.equal(cleanup, 1);
  }
});

test("preformed static output does not gain an owner; function factories get distinct request owners", () => {
  let seen: Owner | null | undefined;
  const value = {
    toString() {
      seen = getOwner();
      return "value";
    },
  };
  assert.equal(renderToString(template(["<p", "></p>"], [attribute("title", value)])), '<p title="value"></p>');
  assert.equal(seen, null);
  const owners: (Owner | null)[] = [];
  renderToString(() => {
    owners.push(getOwner());
    return "A";
  });
  renderToString(() => {
    owners.push(getOwner());
    return "B";
  });
  assert.ok(owners[0]);
  assert.ok(owners[1]);
  assert.notEqual(owners[0], owners[1]);
});

test("server thenable children and writer acknowledgments read then exactly once", async () => {
  let childReads = 0;
  const child = {
    get then() {
      if (++childReads > 1) throw Error("child then read twice");
      return (resolve: (value: string) => void) => resolve("expected");
    },
  };
  assert.equal(await renderToString(() => child as unknown as PromiseLike<string>), "expected");
  assert.equal(childReads, 1);
  let writerReads = 0;
  const ack = {
    get then() {
      if (++writerReads > 1) throw Error("writer then read twice");
      return (resolve: () => void) => resolve();
    },
  };
  await renderToWriter(() => "output", {
    write() {
      return ack as unknown as PromiseLike<void>;
    },
  });
  assert.equal(writerReads, 1);
});

test("throwing then getters preserve ordered primary errors while observing later formed siblings", async () => {
  const { spawnSync } = await import("node:child_process");
  const runtime = new URL("../server.ts", import.meta.url).href;
  for (const form of [
    `() => [bad, later]`,
    `() => Async({load:()=>1, children:()=>[bad,later]})`,
    `() => template(['before','','after'],[bad,later])`,
    `() => [attribute('title',bad),later]`,
  ]) {
    const script = `import {renderToString,Async,template,attribute} from ${JSON.stringify(runtime)};
      let reads=0;const bad={get then(){reads++;throw Error('bad then getter')}};
      const later=new Promise((_,reject)=>setTimeout(()=>reject(Error('later sibling')),10));
      try { await renderToString(${form}); throw Error('expected failure'); }
      catch(error){if(error.message!=='bad then getter')throw error;}
      if(reads!==1)throw Error('getter read '+reads+' times');
      await new Promise(resolve=>setTimeout(resolve,30));console.log('alive');`;
    const result = spawnSync(process.execPath, ["--unhandled-rejections=strict", "--input-type=module", "-e", script], {
      encoding: "utf8",
      timeout: 3000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /alive/);
  }
});

test("late admission after abort disposes formed scopes beyond a throwing then getter", async () => {
  const { Provider } = await import("../server.ts");
  const gate = deferred<ServerValue>(),
    controller = new AbortController();
  let cleanup = 0;
  const result = renderToString(() => gate.promise, { signal: controller.signal }) as Promise<string>;
  controller.abort(Error("stop"));
  await assert.rejects(result, /stop/);
  const scope = Provider({
    token: createContext("none"),
    value: "local",
    children: () => {
      onCleanup(() => cleanup++);
      return "late";
    },
  });
  const bad = {
    get then() {
      throw Error("bad getter");
    },
  };
  gate.resolve([bad as unknown as PromiseLike<string>, scope]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cleanup, 1);
});

test("writer abort still observes its returned rejecting acknowledgment", async () => {
  const { spawnSync } = await import("node:child_process");
  const runtime = new URL("../server.ts", import.meta.url).href;
  const script = `import {renderToWriter} from ${JSON.stringify(runtime)};const controller=new AbortController();try{await renderToWriter(()=> 'output',{write(){controller.abort(Error('stop'));return Promise.reject(Error('late ack'));}},{signal:controller.signal});throw Error('expected failure')}catch(error){if(error.message!=='stop')throw error}await new Promise(resolve=>setTimeout(resolve,20));console.log('alive')`;
  const result = spawnSync(process.execPath, ["--unhandled-rejections=strict", "--input-type=module", "-e", script], {
    encoding: "utf8",
    timeout: 3000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /alive/);
});

test("reused writer thenables assimilate afresh for every write with deferred invocation and original this", async () => {
  const order: string[] = [];
  let reads = 0,
    calls = 0;
  const ack = {
    get then() {
      reads++;
      order.push("get");
      return function (this: unknown, resolve: () => void) {
        assert.equal(this, ack);
        calls++;
        order.push("then");
        resolve();
      };
    },
  };
  const result = renderToWriter(() => template(["a", "b", "c"], [null, null]), {
    write() {
      order.push("write");
      return ack as unknown as PromiseLike<void>;
    },
  });
  assert.deepEqual(order, ["write", "get"]);
  await result;
  assert.equal(reads, 3);
  assert.equal(calls, 3);
  assert.deepEqual(order, ["write", "get", "then", "write", "get", "then", "write", "get", "then"]);
});

test("getter discovery failures surface at their ordered slot without running later deferred children", async () => {
  const chunks: string[] = [];
  let runs = 0;
  const bad = {
    get then() {
      throw Error("getter");
    },
  };
  await assert.rejects(
    renderToWriter(
      () => [
        "before",
        bad as unknown as PromiseLike<string>,
        () => {
          runs++;
          return "after";
        },
      ],
      {
        write(chunk: string) {
          chunks.push(chunk);
        },
      },
    ) as Promise<void>,
    /getter/,
  );
  assert.deepEqual(chunks, ["before"]);
  assert.equal(runs, 0);
});

test("repeated formed thenables assimilate once; noncallable then getters do not invoke deferred children early", async () => {
  let reads = 0,
    calls = 0;
  const child = {
    get then() {
      reads++;
      return function (this: unknown, resolve: (value: string) => void) {
        assert.equal(this, child);
        calls++;
        resolve("value");
      };
    },
  };
  const formed = child as unknown as PromiseLike<string>;
  assert.equal(await renderToString(() => [formed, formed]), "valuevalue");
  assert.equal(reads, 1);
  assert.equal(calls, 1);
  let getterReads = 0,
    runs = 0;
  const gate = deferred();
  const fn = () => {
    runs++;
    return "deferred";
  };
  Object.defineProperty(fn, "then", {
    get() {
      getterReads++;
      return null;
    },
  });
  const chunks: string[] = [];
  const rendered = renderToWriter(() => ["before", fn, fn], {
    write(chunk: string) {
      chunks.push(chunk);
      if (chunk === "before") return gate.promise;
    },
  });
  assert.equal(getterReads, 1);
  assert.equal(runs, 0);
  assert.deepEqual(chunks, ["before"]);
  gate.resolve();
  await rendered;
  assert.equal(getterReads, 1);
  assert.equal(runs, 2);
  assert.deepEqual(chunks, ["before", "deferred", "deferred"]);
});

test("thenable normalization does not depend on prototype inspection or a shadowed call property", async () => {
  const then = (resolve: (value: string) => void) => resolve("value");
  then.call = () => {
    throw Error("shadowed call");
  };
  const child = new Proxy(
    { then },
    {
      getPrototypeOf() {
        throw Error("prototype inspected");
      },
    },
  );
  assert.equal(await renderToString(() => child as unknown as PromiseLike<string>), "value");
});
