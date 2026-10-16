// Server pipeline through the real router handler: CSRF, encodings, limits, intents, echo, JSON.
import { test } from "vitest";
import assert from "node:assert/strict";
import { z } from "zod";
import { createDecoder } from "@rivetjs/runtime/resume-format";
import { createHandler, type AppRoute, type RenderInput, type ServerModule } from "../../router/server/handler.ts";
import { redirect } from "@rivetjs/router";
import { defineForm } from "../index.ts";
import { action, invalid, parse, safeRedirect } from "../server/index.ts";

const signup = defineForm({
  name: "signup",
  schema: z.object({ email: z.string().email(), password: z.string().min(8), age: z.number().int().optional() }),
  coerce: { age: "number" },
  fields: { email: { server: true, validate: (value) => (value === "taken@x.co" ? "errors.taken" : undefined) } },
});
const items = defineForm({ name: "items", schema: z.object({ items: z.array(z.object({ sku: z.string().min(1) })) }) });

const decode = async (response: Response): Promise<any> => {
  const { t, r } = JSON.parse(await response.text()) as { t: unknown[]; r: number };
  return createDecoder(t).get(r);
};
const page = (input: RenderInput) =>
  new Response(JSON.stringify({ action: input.action, status: input.status }), { status: input.status, headers: { "content-type": "text/html" } });
function app(server: ServerModule, dev = false) {
  const routes: AppRoute[] = [{ id: "form", pattern: "/form", page: true, layouts: [], server: () => Promise.resolve(server) }];
  return createHandler({
    routes,
    dev,
    render: page,
    renderError: ({ status, message }) => new Response(`error ${status} ${message}`, { status }),
    onError: () => {},
  });
}
const body = (fields: Record<string, string>) => new URLSearchParams(fields);
const post = (handler: ReturnType<typeof app>, name: string, fields: Record<string, string>, headers: Record<string, string> = { origin: "http://x" }) =>
  handler(new Request("http://x/form?/" + name, { method: "POST", body: body(fields), headers }));

let saved: unknown[] = [];
const handler = app({
  actions: {
    signup: action(
      signup,
      (value) => {
        if (value.email === "boss@x.co") return invalid({ email: "errors.reserved" }, "errors.nope");
        saved.push(value);
        return value.email === "go@x.co" ? redirect("/welcome") : { welcome: value.email };
      },
      { checks: { password: (value) => (value === "password123" ? "errors.weak" : undefined) } },
    ),
    items: action(items, (value) => value.items.length),
  },
});
const valid = { email: "a@b.co", password: "s3cret-pass", age: "30" };

test("success: typed output to the handler, { ok, id, data } as the action result", async () => {
  saved = [];
  const response = await post(handler, "signup", { ...valid, _form: "signup-2" });
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(await response.text()).action, { name: "signup", result: { ok: true, id: "signup-2", data: { welcome: "a@b.co" } } });
  assert.deepEqual(saved, [{ email: "a@b.co", password: "s3cret-pass", age: 30 }]);
  const json = await post(handler, "signup", valid, { origin: "http://x", accept: "application/json" });
  assert.deepEqual((await decode(json)).action.result, { ok: true, id: "signup", data: { welcome: "a@b.co" } });
});

test("invalid: 400 with issues, echoed values (password never echoed), handler not run", async () => {
  saved = [];
  const response = await post(handler, "signup", { email: "nope", password: "x", age: "7" });
  assert.equal(response.status, 400);
  const result = JSON.parse(await response.text()).action.result;
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.issues).sort(), ["email", "password"]);
  assert.deepEqual(result.values, { email: "nope", age: "7" });
  assert.deepEqual(saved, []);
  // Server checks: definition (`server: true`) and action options.
  const checked = JSON.parse(await (await post(handler, "signup", { email: "taken@x.co", password: "password123" })).text()).action.result;
  assert.deepEqual(checked.issues, { email: [{ key: "errors.taken" }], password: [{ key: "errors.weak" }] });
  // invalid() from the handler: issues + form issues + echo.
  const denied = JSON.parse(await (await post(handler, "signup", { ...valid, email: "boss@x.co" })).text()).action.result;
  assert.deepEqual(denied, {
    ok: false,
    id: "signup",
    issues: { email: [{ key: "errors.reserved" }] },
    form: [{ key: "errors.nope" }],
    values: { email: "boss@x.co", age: "30" },
  });
});

test("echo.exclude adds to the default secret filter (never replaces it)", async () => {
  const profile = defineForm({
    name: "profile",
    schema: z.object({ nick: z.string().min(5), password: z.string(), apiSecret: z.string(), note: z.string() }),
    echo: { exclude: ["note"] },
  });
  const local = app({ actions: { profile: action(profile, () => "ok") } });
  const result = JSON.parse(await (await post(local, "profile", { nick: "x", password: "hunter22", apiSecret: "k", note: "private" })).text()).action.result;
  assert.equal(result.ok, false);
  assert.deepEqual(result.values, { nick: "x" });
});

test("redirect from the handler: 303 (no JS) and JSON redirect (enhanced)", async () => {
  const response = await post(handler, "signup", { ...valid, email: "go@x.co" });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/welcome");
  const json = await post(handler, "signup", { ...valid, email: "go@x.co" }, { origin: "http://x", accept: "application/json" });
  assert.equal((await decode(json)).redirect, "/welcome");
});

test("CSRF: strict rejects missing provenance in production, allows it in dev; cross-site always rejected", async () => {
  assert.equal((await post(handler, "signup", valid, {})).status, 403);
  assert.equal((await post(handler, "signup", valid, { "sec-fetch-site": "same-origin" })).status, 200);
  assert.equal((await post(handler, "signup", valid, { origin: "http://evil" })).status, 403);
  const dev = app({ actions: { signup: action(signup, () => 1) } }, true);
  assert.equal((await post(dev, "signup", valid, {})).status, 200);
  // "lax": no checks beyond the router's, which rejects provenance-less form posts outside dev.
  const lax = app({ actions: { signup: action(signup, () => 1, { csrf: "lax" }) } });
  assert.equal((await post(lax, "signup", valid, {})).status, 403);
  assert.equal((await post(lax, "signup", valid, { "sec-fetch-site": "same-origin" })).status, 200);
  const laxDev = app({ actions: { signup: action(signup, () => 1, { csrf: "lax" }) } }, true);
  assert.equal((await post(laxDev, "signup", valid, {})).status, 200);
  const token = app({ actions: { signup: action(signup, () => 1, { csrf: (_event, data) => data.get("_csrf") === "t" }) } });
  assert.equal((await post(token, "signup", valid)).status, 403);
  assert.equal((await post(token, "signup", { ...valid, _csrf: "t" })).status, 200);
});

test("encodings and limits: 415, 413 (declared and streamed), multipart accepted", async () => {
  const json = await handler(
    new Request("http://x/form?/signup", { method: "POST", body: "{}", headers: { origin: "http://x", "content-type": "application/json" } }),
  );
  assert.equal(json.status, 415);
  const small = app({ actions: { signup: action(signup, () => 1, { limits: { urlencoded: 20 } }) } });
  assert.equal((await post(small, "signup", valid)).status, 413);
  const multipart = new FormData();
  for (const [k, v] of Object.entries(valid)) multipart.set(k, v);
  const response = await handler(new Request("http://x/form?/signup", { method: "POST", body: multipart, headers: { origin: "http://x" } }));
  assert.equal(response.status, 200);
  // Files: per-file cap (413), decoded as File, never echoed.
  const upload = defineForm({
    name: "upload",
    schema: z.object({ title: z.string().min(3), avatar: z.instanceof(File).optional() }),
    coerce: { avatar: "file" },
  });
  let received: unknown;
  const files = app({ actions: { upload: action(upload, (value) => ((received = value.avatar), 1), { limits: { file: 10 } }) } });
  const send = (bytes: number, title: string) => {
    const data = new FormData();
    data.set("title", title);
    data.set("avatar", new File([new Uint8Array(bytes)], "a.png", { type: "image/png" }));
    return files(new Request("http://x/form?/upload", { method: "POST", body: data, headers: { origin: "http://x" } }));
  };
  assert.equal((await send(11, "ok title")).status, 413);
  assert.equal((await send(5, "ok title")).status, 200);
  assert.ok(received instanceof File && received.size === 5);
  const echoed = JSON.parse(await (await send(5, "x")).text()).action.result;
  assert.deepEqual(echoed.values, { title: "x" });
  // Over-deep names are a 400, not a crash.
  assert.equal((await post(handler, "signup", { ...valid, "a.b.c.d.e.f.g.h.i.j": "1" })).status, 400);
});

test("intents: validate:<path> answers one field without the handler; array intents re-render", async () => {
  saved = [];
  const remote = await decode(
    await post(handler, "signup", { email: "taken@x.co", _intent: "validate:email" }, { origin: "http://x", accept: "application/json" }),
  );
  assert.deepEqual(remote.action.result, { ok: false, id: "signup", intent: "validate:email", issues: { email: [{ key: "errors.taken" }] } });
  const fine = await decode(
    await post(handler, "signup", { email: "free@x.co", _intent: "validate:email" }, { origin: "http://x", accept: "application/json" }),
  );
  assert.deepEqual(fine.action.result.issues, {});
  assert.deepEqual(saved, []);
  const inserted = JSON.parse(await (await post(handler, "items", { "items.0.sku": "a", "items.1.sku": "b", _intent: "insert:items" })).text());
  assert.equal(inserted.status, 200);
  assert.deepEqual(inserted.action.result, {
    ok: false,
    id: "items",
    intent: "insert:items",
    values: { "items.0.sku": "a", "items.1.sku": "b" },
    rows: { items: 3 },
  });
  const removed = JSON.parse(await (await post(handler, "items", { "items.0.sku": "a", "items.1.sku": "b", _intent: "remove:items:0" })).text());
  assert.deepEqual(removed.action.result.values, { "items.0.sku": "b" });
  const moved = JSON.parse(
    await (await post(handler, "items", { "items.0.sku": "a", "items.1.sku": "b", "items.2.sku": "c", _intent: "move:items:0:2" })).text(),
  );
  assert.deepEqual(moved.action.result.values, { "items.0.sku": "b", "items.1.sku": "c", "items.2.sku": "a" });
});

test("parse() and safeRedirect()", async () => {
  const data = new FormData();
  data.set("email", "a@b.co");
  data.set("password", "longenough");
  assert.deepEqual(await parse(signup, data), { ok: true, value: { email: "a@b.co", password: "longenough" } });
  data.set("email", "x");
  const failed = await parse(signup, data);
  assert.equal(failed.ok, false);
  assert.equal(safeRedirect("/a?b#c"), "/a?b#c");
  for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "/a\nb", 42]) assert.equal(safeRedirect(bad, "/home"), "/home");
});
