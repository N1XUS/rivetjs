// Form-action prerequisites: failure status, 303 redirects, JSON answers for enhanced submits, dev flag.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createDecoder } from "@rivetjs/runtime/resume-format";
import { createHandler, type AppRoute, type RenderInput, type RequestEvent, type ServerModule } from "../server/handler.ts";
import { error, fail, isActionFailure, redirect } from "../index.ts";

const mod = (module: ServerModule) => () => Promise.resolve(module);
const decode = async (response: Response): Promise<unknown> => {
  const { t, r } = JSON.parse(await response.text()) as { t: unknown[]; r: number };
  return createDecoder(t).get(r);
};
const page = (input: RenderInput) =>
  new Response(JSON.stringify({ data: input.data, action: input.action, status: input.status }), {
    status: input.status,
    headers: { ...Object.fromEntries(input.headers), "content-type": "text/html" },
  });

function app(server: ServerModule, dev = false) {
  const routes: AppRoute[] = [{ id: "form", pattern: "/form", page: true, layouts: [], server: mod(server) }];
  return createHandler({
    routes,
    dev,
    render: page,
    renderError: ({ status, message }) => new Response(`error ${status} ${message}`, { status }),
    onError: () => {},
  });
}
const post = (handler: ReturnType<typeof app>, name: string, headers: Record<string, string> = {}) =>
  handler(new Request("http://x/form?/" + name, { method: "POST", body: new URLSearchParams({ a: "1" }), headers: { origin: "http://x", ...headers } }));

test("fail(): status on the page render (loaders still run) and on the JSON answer", async () => {
  let loads = 0;
  const handler = app({
    load: () => ++loads,
    actions: { save: () => fail(400, { ok: false, issues: { email: [{ key: "errors.email" }] } }) },
  });
  const html = await post(handler, "save");
  assert.equal(html.status, 400);
  assert.deepEqual(JSON.parse(await html.text()), {
    data: [1],
    status: 400,
    action: { name: "save", result: { ok: false, issues: { email: [{ key: "errors.email" }] } }, status: 400 },
  });
  const json = await post(handler, "save", { accept: "application/json" });
  assert.equal(json.status, 400);
  assert.equal(json.headers.get("x-content-type-options"), "nosniff");
  assert.equal(json.headers.get("cache-control"), "no-store");
  assert.deepEqual(await decode(json), { action: { name: "save", result: { ok: false, issues: { email: [{ key: "errors.email" }] } }, status: 400 } });
  // Failed validation changed nothing: the JSON answer skips loaders.
  assert.equal(loads, 1);
  assert.equal(isActionFailure(fail(422, null)), true);
  assert.equal(isActionFailure({ status: 400, data: null }), false);
  assert.throws(() => fail(200, null), RangeError);
});

test("single flight: a successful enhanced form submit carries the re-run loaders' data", async () => {
  let loads = 0;
  const handler = app({
    load: () => ({ count: ++loads }),
    actions: { save: () => ({ ok: true }), invalid: () => fail(400, { ok: false }) },
  });
  const form = { accept: "application/json", "x-rivet-revalidate": "1" };
  assert.deepEqual(await decode(await post(handler, "save", form)), { action: { name: "save", result: { ok: true } }, data: [{ count: 1 }] });
  // A failed action changed nothing: no loaders. JSON posts not asking (field checks, drafts) skip them.
  assert.deepEqual(await decode(await post(handler, "invalid", form)), { action: { name: "invalid", result: { ok: false }, status: 400 } });
  assert.deepEqual(await decode(await post(handler, "save", { accept: "application/json" })), { action: { name: "save", result: { ok: true } } });
  assert.equal(loads, 1);
});

test("single flight: a redirect back to the page itself carries the re-run loaders' data", async () => {
  let loads = 0;
  const handler = app({
    load: ({ url }) => ({ count: ++loads, search: url.search }),
    actions: {
      back: () => redirect("/form"),
      thrown: () => {
        throw redirect("http://x/form", 302);
      },
      query: () => redirect("/form?saved"),
      away: () => redirect("/done"),
      external: () => redirect("http://y/form", { external: true }),
    },
  });
  const form = { accept: "application/json", "x-rivet-revalidate": "1" };
  const back = await post(handler, "back", form);
  assert.equal(back.status, 200);
  assert.equal(back.headers.get("cache-control"), "no-store");
  assert.deepEqual(await decode(back), { redirect: "/form", status: 303, data: [{ count: 1, search: "" }] });
  assert.deepEqual(await decode(await post(handler, "thrown", form)), { redirect: "http://x/form", status: 302, data: [{ count: 2, search: "" }] });
  // Another URL (a query, another path, another origin), or not asking: the redirect alone.
  assert.deepEqual(await decode(await post(handler, "query", form)), { redirect: "/form?saved", status: 303 });
  assert.deepEqual(await decode(await post(handler, "away", form)), { redirect: "/done", status: 303 });
  assert.deepEqual(await decode(await post(handler, "external", form)), { redirect: "http://y/form", status: 303 });
  assert.deepEqual(await decode(await post(handler, "back", { accept: "application/json" })), { redirect: "/form", status: 303 });
  assert.equal(loads, 2);
});

test("action redirects default to 303; an explicit status is kept", async () => {
  const handler = app({
    actions: {
      go: () => redirect("/done"),
      thrown: () => {
        throw redirect("/thrown");
      },
      explicit: () => redirect("/kept", 307),
    },
  });
  const go = await post(handler, "go");
  assert.equal(go.status, 303);
  assert.equal(go.headers.get("location"), "/done");
  const thrown = await post(handler, "thrown");
  assert.equal(thrown.status, 303);
  assert.equal((await post(handler, "explicit")).status, 307);
  // Outside actions the default stays 302.
  const guarded = app({ guard: () => redirect("/login") });
  assert.equal((await guarded(new Request("http://x/form"))).status, 302);
});

test("enhanced (JSON) action requests get redirects and errors as JSON", async () => {
  const handler = app({
    actions: {
      go: () => redirect("/done"),
      broken: () => error(409, "Conflict here"),
      crash: () => {
        throw new Error("secret");
      },
    },
  });
  const accept = { accept: "application/json" };
  const go = await post(handler, "go", accept);
  assert.equal(go.status, 200);
  assert.deepEqual(await decode(go), { redirect: "/done", status: 303 });
  const broken = await post(handler, "broken", accept);
  assert.equal(broken.status, 409);
  assert.deepEqual(await decode(broken), { error: { status: 409, message: "Conflict here" } });
  const crash = await post(handler, "crash", accept);
  assert.equal(crash.status, 500);
  const body = (await decode(crash)) as { error: { status: number; message: string } };
  assert.equal(body.error.status, 500);
  assert.match(body.error.message, /^Internal Server Error \(digest [0-9a-f]+\)$/);
  const crossSite = await post(handler, "go", { ...accept, origin: "http://evil" });
  assert.equal(crossSite.status, 403);
  assert.deepEqual(await decode(crossSite), { error: { status: 403, message: "Cross-site request rejected" } });
  // Non-JSON requests keep the HTML error page.
  assert.equal(await (await post(handler, "broken")).text(), "error 409 Conflict here");
});

test("RequestEvent.dev mirrors the handler's dev option", async () => {
  const seen: (boolean | undefined)[] = [];
  const server: ServerModule = { actions: { probe: (event: RequestEvent) => void seen.push(event.dev) } };
  await post(app(server), "probe");
  await post(app(server, true), "probe");
  assert.deepEqual(seen, [false, true]);
});

test("the action result reaches the page factory, the dev embed and actionResult()", async () => {
  const { createApp } = await import("../server/app.ts");
  const { generate } = await import("../build/codegen.ts");
  const { routeTable } = await import("../build/routes.ts");
  const { provide } = await import("@rivetjs/reactivity");
  const { ServerData, actionResult } = await import("../client/route-context.ts");
  const seen: unknown[] = [];
  const entry = {
    routes: [{ id: "form", pattern: "/form", page: true, layouts: [], server: mod({ actions: { save: () => fail(400, { ok: false }) } }) }],
    universal: {},
    page: (input: { action?: unknown }) => {
      seen.push(input.action);
      return () => "page";
    },
    document: () => ({ start: "<body>", end: "</body>" }),
  };
  const submit = () => new Request("http://x/form?/save", { method: "POST", body: "", headers: { origin: "http://x" } });
  const response = await createApp({ entry, csp: false })(submit());
  assert.equal(response.status, 400);
  assert.equal(await response.text(), "<body>page</body>");
  assert.deepEqual(seen, [{ name: "save", result: { ok: false }, status: 400 }]);
  // Dev pages embed it for the client mount.
  const html = await (await createApp({ entry, csp: false, devScripts: [] })(submit())).text();
  assert.match(html, /"action"/);
  // Generated server entry and dev mount pass it through ServerData.
  const files = generate(routeTable(["index.tsx"]), { routesDir: "src/routes" }).files;
  assert.match(files["entry.server.tsx"]!, /\.\.\.\(input\.action \? \{ action: input\.action \} : \{\}\)/);
  assert.match(files["dev-mount.tsx"]!, /\.\.\.\(body\.action \? \{ action: body\.action \} : \{\}\)/);
  // actionResult(): by name; on the server every call answers, in the browser once per action.
  const server = { data: [], url: new URL("http://x/form"), action: { name: "save", result: 1 } };
  assert.deepEqual(
    provide(ServerData, server, () => [actionResult("save"), actionResult("save"), actionResult("other"), actionResult()]),
    [server.action, server.action, undefined, server.action],
  );
  assert.equal(
    provide(ServerData, null, () => actionResult()),
    undefined,
  );
  (globalThis as { document?: unknown }).document = {};
  try {
    assert.deepEqual(
      provide(ServerData, server, () => [actionResult("save"), actionResult("save")]),
      [server.action, undefined],
    );
  } finally {
    delete (globalThis as { document?: unknown }).document;
  }
});

test("single flight: the fresh data carries the loaders' depends() keys", async () => {
  const handler = app({ load: (e: RequestEvent) => (e.depends("cart"), 1), actions: { save: () => ({ ok: true }) } });
  const form = { accept: "application/json", "x-rivet-revalidate": "1" };
  assert.deepEqual(await decode(await post(handler, "save", form)), { action: { name: "save", result: { ok: true } }, data: [1], deps: [["cart"]] });
});
