// The enhanced-submit wire (review round 2, X3): forms decodes the router's `ActionAnswer` (one type,
// exported by @rivetjs/router) and sends no custom form header (the form id travels in `_form`).
import { test, expectTypeOf } from "vitest";
import assert from "node:assert/strict";
import type { ActionAnswer } from "@rivetjs/router";
import { createHandler, type AppRoute, type ServerModule } from "../../router/server/handler.ts";
import { fail } from "../../router/index.ts";
import { post } from "../transport.ts";

test("post(): accept JSON (+ x-rivet-revalidate on request) only, answers decoded as the router's ActionAnswer", async () => {
  const server: ServerModule = { actions: { save: () => ({ ok: true }), bad: () => fail(422, { issues: { a: [] } }) } };
  const routes: AppRoute[] = [{ id: "form", pattern: "/form", page: true, layouts: [], server: () => Promise.resolve(server) }];
  const handler = createHandler({ routes, render: () => new Response("page"), renderError: ({ status }) => new Response("e", { status }), onError: () => {} });
  const sent: Headers[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const request = new Request(url, { ...init, headers: { ...(init.headers as Record<string, string>), origin: "http://x" } });
    sent.push(new Headers(init.headers));
    return handler(request);
  }) as typeof fetch;
  try {
    const form = (name: string) =>
      ({ action: "http://x/form?/" + name, enctype: "application/x-www-form-urlencoded", getAttribute: () => null }) as unknown as HTMLFormElement;
    const data = new FormData();
    data.set("a", "1");
    const ok = await post(form("save"), data, undefined, true);
    expectTypeOf(ok.answer).toEqualTypeOf<ActionAnswer>();
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.answer.action, { name: "save", result: { ok: true } });
    assert.deepEqual(ok.answer.data, [undefined]);
    const bad = await post(form("bad"), data);
    assert.equal(bad.status, 422);
    assert.deepEqual(bad.answer, { action: { name: "bad", result: { issues: { a: [] } }, status: 422 } });
    assert.deepEqual(
      sent.map((headers) => [...headers.keys()].sort()),
      [["accept", "x-rivet-revalidate"], ["accept"]],
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});
