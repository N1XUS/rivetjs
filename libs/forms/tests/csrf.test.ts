// CSRF token mode: cookie nonce + HMAC field, session binding, through the router handler.
import { test } from "vitest";
import assert from "node:assert/strict";
import { z } from "zod";
import { createHandler, type AppRoute, type RenderInput, type ServerModule } from "../../router/server/handler.ts";
import { defineForm } from "../index.ts";
import { action } from "../server/index.ts";
import { csrfToken, verifyCsrf } from "../csrf.ts";

const note = defineForm({ name: "note", schema: z.object({ text: z.string() }) });
const options = { secret: "x".repeat(32), session: () => "user-1" };
let token = "";
const server: ServerModule = {
  load: (event) => (token = csrfToken(event, options)),
  actions: { note: action(note, () => "saved", { csrf: verifyCsrf(options) }) },
};
const routes: AppRoute[] = [{ id: "n", pattern: "/n", page: true, layouts: [], server: () => Promise.resolve(server) }];
const page = (input: RenderInput) => new Response(JSON.stringify({ action: input.action }), { status: input.status, headers: input.headers });
const handler = createHandler({ routes, render: page, renderError: ({ status }) => new Response(String(status), { status }), onError: () => {} });

test("token round trip; wrong token, missing cookie or another session → 403", async () => {
  const get = await handler(new Request("http://x/n"));
  const cookie = get.headers.get("set-cookie")!.split(";")[0]!;
  assert.match(get.headers.get("set-cookie")!, /HttpOnly/i);
  assert.match(get.headers.get("set-cookie")!, /SameSite=Lax/i);
  const post = (fields: Record<string, string>, headers: Record<string, string>) =>
    handler(new Request("http://x/n?/note", { method: "POST", body: new URLSearchParams(fields), headers: { origin: "http://x", ...headers } }));
  assert.equal((await post({ text: "a", _csrf: token }, { cookie })).status, 200);
  assert.equal((await post({ text: "a", _csrf: token.slice(1) + "A" }, { cookie })).status, 403);
  assert.equal((await post({ text: "a", _csrf: token }, {})).status, 403);
  assert.equal((await post({ text: "a" }, { cookie })).status, 403);
  const other = verifyCsrf({ ...options, session: () => "user-2" });
  const data = new FormData();
  data.set("_csrf", token);
  const event = { cookies: { get: () => cookie.split("=")[1] }, url: new URL("http://x/n"), dev: false } as never;
  assert.equal(other(event, data), false);
  assert.equal(verifyCsrf(options)(event, data), true);
  assert.throws(() => csrfToken(event, { secret: "short" }), RangeError);
});
