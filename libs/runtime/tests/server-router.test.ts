import { test } from "vitest";
import assert from "node:assert/strict";
import { onCleanup, createContext, provide } from "@rivetjs/reactivity";
import { renderToString } from "../server.ts";
import type * as RouterApi from "../server-router.ts";
import type { AsyncWork } from "../async.ts";

/** Renders here are asynchronous, so the `string | Promise` / `void | Promise` results are promises. */
const rejects = (value: unknown, error: Parameters<typeof assert.rejects>[1]): Promise<void> =>
  assert.rejects(value as Promise<unknown>, error);

type ServerValue = Parameters<typeof renderToString>[0];
type Routes = Parameters<typeof RouterApi.Router>[0]["routes"];
interface MatchView {
  readonly params: Readonly<Record<string, string>>;
  readonly url: URL;
}

const api = (await import("../server-router.ts").catch(() => ({}))) as typeof RouterApi;
const deferred = <T = void>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};
test("server router snapshots HTTP URL and renders synchronous routes or notFound", () => {
  assert.equal(typeof api.createRouter, "function");
  const source = new URL("https://routes.test/a?q=yes#hash"),
    router = api.createRouter(source);
  source.pathname = "/changed";
  router.location().pathname = "/changed";
  assert.equal(router.location().href, "https://routes.test/a?q=yes#hash");
  for (const invalid of ["/a", "file:///a", "javascript:alert(1)"]) assert.throws(() => api.createRouter(invalid));
  const routes = [
    api.defineRoute("/:id", { render: (data: unknown, match: MatchView) => `${match.params.id}:${match.url.search}:${String(data)}` }),
  ];
  assert.equal(
    renderToString(() => api.Router({ router, routes })),
    "a:?q=yes:undefined",
  );
  assert.equal(
    renderToString(() => api.Router({ router, routes: [], notFound: (u: URL) => u.pathname })),
    "/a",
  );
  assert.equal(
    renderToString(() => api.Router({ router, routes: [] })),
    "",
  );
});
test("compiled server routes isolate interleaved request URLs and captured providers", async () => {
  assert.equal(typeof api.Router, "function");
  const { compile } = await import("@rivetjs/compiler");
  const source = `
    import {Provider} from '@rivetjs/runtime/server';
    import {Router,createRouter,defineRoute} from '@rivetjs/runtime/router/server';
    import {createContext,getOwner,onCleanup} from '@rivetjs/reactivity';
    const User=createContext('none');
    export function Page({name,url,gate,events}) {
      onCleanup(()=>events.push('request-clean'));
      const router=createRouter(url);
      const routes=[defineRoute('/user/:id',{
        load:async(work,match)=>{onCleanup(()=>events.push('route-clean'));await gate;if(getOwner()!==null)throw Error('owner leak');return work.get(User)+':'+match.params.id+':'+match.url.search},
        render:(data,match)=><b>{data}</b>
      })];
      return <Provider token={User} value={name}><Router router={router} routes={routes}/></Provider>;
    }`;
  const result = compile(source, { target: "server", filename: "router.tsx" });
  assert.deepEqual(result.diagnostics, []);
  const code = result.code
    .replaceAll("@rivetjs/runtime/router/server", new URL("../server-router.ts", import.meta.url).href)
    .replaceAll("@rivetjs/runtime/server", new URL("../server.ts", import.meta.url).href)
    .replaceAll("@rivetjs/runtime/slot", new URL("../slot.ts", import.meta.url).href)
    .replaceAll("@rivetjs/reactivity", new URL("../../reactivity/index.ts", import.meta.url).href);
  const { Page } = (await import("data:text/javascript," + encodeURIComponent(code))) as {
    Page: (props: { name: string; url: string; gate: Promise<void>; events: string[] }) => ServerValue;
  };
  const a = deferred(),
    b = deferred(),
    ea: string[] = [],
    eb: string[] = [];
  const first = renderToString(() =>
    Page({ name: "A", url: "https://routes.test/user/1?q=a", gate: a.promise, events: ea }),
  );
  const second = renderToString(() =>
    Page({ name: "B", url: "https://routes.test/user/2?q=b", gate: b.promise, events: eb }),
  );
  b.resolve();
  assert.equal(await second, "<b>B:2:?q=b</b>");
  assert.deepEqual(eb, ["route-clean", "request-clean"]);
  assert.deepEqual(ea, []);
  a.resolve();
  assert.equal(await first, "<b>A:1:?q=a</b>");
  assert.deepEqual(ea, ["route-clean", "request-clean"]);
});
test("server route abort cancels loader and suppresses late rendering/errors with request cleanup", async () => {
  assert.equal(typeof api.Router, "function");
  const gate = deferred<string>(),
    controller = new AbortController(),
    token = createContext("none");
  let work: AsyncWork | undefined,
    renders = 0,
    errors = 0,
    cleanups = 0;
  const result = renderToString(
    () =>
      provide(token, "request", () =>
        api.Router({
          router: api.createRouter("https://routes.test/a"),
          routes: [
            api.defineRoute("/a", {
              load: (w: AsyncWork) => {
                work = w;
                onCleanup(() => cleanups++);
                return gate.promise;
              },
              render: () => {
                renders++;
                return "late";
              },
            }),
          ],
          error: () => {
            errors++;
            return "error";
          },
        }),
      ),
    { signal: controller.signal },
  );
  controller.abort(Error("stop route"));
  await rejects(result, /stop route/);
  assert.equal(work!.signal.aborted, true);
  assert.equal(cleanups, 1);
  gate.resolve("late");
  await new Promise((r) => setImmediate(r));
  assert.equal(renders, 0);
  assert.equal(errors, 0);
  assert.throws(() => work!.get(token));
});
test("server route handles load errors while render errors escape", async () => {
  assert.equal(typeof api.Router, "function");
  const router = api.createRouter("https://routes.test/a");
  const render = (routes: Routes) =>
    renderToString(() => api.Router({ router, routes, error: (e: unknown) => "caught:" + (e as Error).message }));
  assert.equal(
    await render([{ path: "/a", load: () => Promise.reject(Error("load")), render: () => "wrong" }]),
    "caught:load",
  );
  assert.equal(
    await render([
      {
        path: "/a",
        load: () => {
          throw Error("sync");
        },
        render: () => "wrong",
      },
    ]),
    "caught:sync",
  );
  await rejects(
    render([
      {
        path: "/a",
        render: () => {
          throw Error("render");
        },
      },
    ]),
    /render/,
  );
});
test("server router bundles without DOM or compiler imports", async () => {
  const { build } = await import("esbuild");
  const result = await build({
    entryPoints: [new URL("../server-router.ts", import.meta.url).pathname],
    bundle: true,
    platform: "node",
    write: false,
    metafile: true,
  });
  const inputs = Object.keys(result.metafile.inputs);
  assert.equal(
    inputs.some((p: string) => /runtime\/dom|libs\/compiler|node_modules/.test(p)),
    false,
    inputs.join("\n"),
  );
});
test("strict server route types preserve loader data and required renderer props", async () => {
  const { default: ts } = await import("typescript");
  const program = ts.createProgram([new URL("./server-router-types.tsx", import.meta.url).pathname], {
    noEmit: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    jsx: ts.JsxEmit.ReactJSX,
    jsxImportSource: "@rivetjs/runtime",
    skipLibCheck: false,
    allowImportingTsExtensions: true,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(
    diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    [],
  );
});

// FLOOR 2026-10-26: no URL parses the server does not need. A `URL` argument is read, not reparsed; every `location()`
// read is still a fresh copy.
test("createRouter reads a URL argument without aliasing it", () => {
  const input = new URL("https://example.com/a/b?q=1");
  const router = api.createRouter(input);
  const first = router.location();
  assert.notEqual(first, input);
  assert.notEqual(router.location(), first);
  first.pathname = "/changed";
  input.search = "?other";
  assert.equal(router.location().href, "https://example.com/a/b?q=1");
  assert.throws(() => api.createRouter(new URL("ftp://example.com/")), /absolute HTTP\(S\) URL/);
});
