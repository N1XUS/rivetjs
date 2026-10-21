// Deferred loaders (`load(fn, { defer: true })`, shell-cache spec T1): the handler starts them with the request, renders
// without awaiting them (the data slot is a per-request `Deferred` handle that follows the loader's promise),
// data requests await them; deferred loaders cannot set headers / cookies; dev reads of the handle throw. Handler units
// here; the built fixture (stream order, resume, client navigation) in `deferred-app.test.ts`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createDecoder, createEncoder } from "@rivetjs/runtime/resume-format";
import { createHandler, type AppRoute, type RenderInput, type ServerModule } from "../server/handler.ts";
import { load } from "../shared/server-exports.ts";
import { notFound } from "../shared/errors.ts";

const mod = (module: ServerModule) => () => Promise.resolve(module);
const decode = async (response: Response): Promise<unknown> => {
  const { t, r } = JSON.parse(await response.text()) as { t: unknown[]; r: number };
  return createDecoder(t).get(r);
};
/** A gate the test opens: the deferred loader's work. */
function gate<T>(value: T): { promise: Promise<T>; open(): void; fail(cause: unknown): void } {
  let open!: () => void, fail!: (cause: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => ((open = () => resolve(value)), (fail = reject)));
  return { promise, open, fail };
}
test("document request: the deferred slot is a handle, the render does not wait, the handle follows the loader", async () => {
  const user = gate({ name: "ann" });
  let rendered: RenderInput | undefined;
  const route: AppRoute = {
    id: "index",
    pattern: "/",
    page: true,
    layouts: [mod({ load: load(() => user.promise, { defer: true }) })],
    server: mod({ load: load(() => ({ title: "page" })) }),
  };
  const handler = createHandler({ routes: [route], render: (input) => ((rendered = input), new Response("ok", { headers: input.headers })) });
  const response = await handler(new Request("http://x/"));
  assert.equal(await response.text(), "ok", "answered while the deferred loader is pending");
  assert.ok(rendered);
  assert.equal(rendered.deferred, true);
  assert.deepEqual(rendered.data[1], { title: "page" });
  const handle = rendered.data[0] as PromiseLike<{ name: string }>;
  assert.equal(typeof handle.then, "function");
  assert.ok(Object.isFrozen(handle));
  assert.deepEqual(Object.keys(handle), [], "no enumerable fields: the resume encoder writes an empty object");
  const encoder = createEncoder();
  encoder.ref(handle);
  assert.deepEqual(encoder.table, [{ o: [] }]);
  // Every await form: `then`, `await`, `Promise.all` (outside any owner).
  const values = Promise.all([handle, (async () => await handle)(), new Promise((resolve) => handle.then(resolve))]);
  user.open();
  assert.deepEqual(await values, [{ name: "ann" }, { name: "ann" }, { name: "ann" }]);
  // Each request gets its own handle, following its own loader run.
  const again = gate({ name: "bob" });
  (route as { layouts: AppRoute["layouts"] }).layouts = [mod({ load: load(() => again.promise, { defer: true }) })];
  const first = rendered;
  await handler(new Request("http://x/"));
  assert.notEqual(rendered!.data[0], first.data[0]);
  again.open();
  assert.deepEqual(await (rendered!.data[0] as PromiseLike<unknown>), { name: "bob" });
  assert.deepEqual(await handle, { name: "ann" });
});

test("a deferred loader starts with the request, before the render, and runs once", async () => {
  const log: string[] = [];
  const handler = createHandler({
    routes: [
      {
        id: "index",
        pattern: "/",
        page: true,
        layouts: [],
        server: mod({
          load: load(
            () => {
              log.push("load");
              return 1;
            },
            { defer: true },
          ),
        }),
      },
    ],
    render: () => (log.push("render"), new Response("ok")),
  });
  await handler(new Request("http://x/"));
  assert.deepEqual(log, ["load", "render"]);
});

test("data request: deferred loaders are awaited, the answer carries their values", async () => {
  const late = gate({ n: 2, at: new Date(5) });
  const handler = createHandler({
    routes: [{ id: "index", pattern: "/", page: true, layouts: [], server: mod({ load: load(() => late.promise, { defer: true }) }) }],
    render: () => new Response("html"),
  });
  const answer = handler(new Request("http://x/?_rivet=data"));
  let settled = false;
  void answer.then(() => (settled = true));
  await new Promise((done) => setTimeout(done, 10));
  assert.equal(settled, false, "waits for the deferred loader");
  late.open();
  assert.deepEqual(await decode(await answer), { data: [{ n: 2, at: new Date(5) }], status: 200 });
});

test("a deferred loader cannot set headers or cookies; reading cookies works; its failure is not an unhandled rejection", async () => {
  const seen: string[] = [];
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    const handler = createHandler({
      routes: [
        {
          id: "index",
          pattern: "/",
          page: true,
          layouts: [],
          server: mod({
            load: load(
              async (event) => {
                seen.push("cookie " + event.cookies.get("user"));
                for (const write of [
                  () => event.setHeader("x", "1"),
                  () => event.setHeaders({ x: "1" }),
                  () => event.cookies.set("a", "1"),
                  () => event.cookies.delete("a"),
                ])
                  try {
                    write();
                  } catch (error) {
                    seen.push((error as Error).name);
                  }
                throw notFound();
              },
              { defer: true },
            ),
          }),
        },
      ],
      render: (input) => new Response("html", { headers: input.headers }),
    });
    const response = await handler(new Request("http://x/", { headers: { cookie: "user=ann" } }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x"), null);
    assert.equal(response.headers.get("set-cookie"), null);
    await new Promise((done) => setTimeout(done, 20));
    assert.deepEqual(seen, ["cookie ann", "TypeError", "TypeError", "TypeError", "TypeError"]);
    assert.deepEqual(unhandled, []);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});

test("dev: reading a deferred handle's field throws DeferredDataError; then / encoding still work", async () => {
  let rendered: RenderInput | undefined;
  const handler = createHandler({
    dev: true,
    routes: [{ id: "index", pattern: "/", page: true, layouts: [], server: mod({ load: load(() => ({ title: "t" }), { defer: true }) }) }],
    render: (input) => ((rendered = input), new Response("ok")),
  });
  await handler(new Request("http://x/"));
  const handle = rendered!.data[0] as { title?: string } & PromiseLike<{ title: string }>;
  assert.throws(() => handle.title, { name: "DeferredDataError", message: /data\.title.*<Async load=\{\(\) => data\}>.*#deferred-loaders/s });
  assert.equal(typeof handle.then, "function");
  assert.equal(JSON.stringify(handle), "{}");
  const encoder = createEncoder();
  encoder.ref(handle);
  assert.deepEqual(encoder.table, [{ o: [] }]);
  assert.deepEqual(await handle, { title: "t" });
});

test("no deferred loader: the render input has no `deferred` and the data is the loaders' values", async () => {
  let rendered: RenderInput | undefined;
  const handler = createHandler({
    routes: [{ id: "index", pattern: "/", page: true, layouts: [], server: mod({ load: load(() => 1) }) }],
    render: (input) => ((rendered = input), new Response("ok")),
  });
  await handler(new Request("http://x/"));
  assert.equal("deferred" in rendered!, false);
  assert.deepEqual(rendered!.data, [1]);
});
