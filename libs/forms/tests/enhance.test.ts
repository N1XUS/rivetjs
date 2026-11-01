// Enhanced submit (`enhance.ts` `send`) after the server accepted the action: a failing follow-up (the
// revalidation or the redirect's navigation) is not a network failure of the submit, so the user is not
// told to resubmit an action that already ran (r3-errors #2).
import { test } from "vitest";
import assert from "node:assert/strict";
import { untrack } from "@rivetjs/reactivity";
import { createHandler, type AppRoute, type ServerModule } from "../../router/server/handler.ts";
import { redirect } from "../../router/index.ts";
import { createForm, defineForm, formIssues, lastResult, submitting } from "../index.ts";
import { send } from "../enhance.ts";
import { fd, schema } from "./fixtures.ts";

const ROUTER = Symbol.for("rivet.router");

async function withServer(server: ServerModule, go: (url: URL) => Promise<void>, run: (form: (name: string) => HTMLFormElement) => Promise<void>) {
  const routes: AppRoute[] = [{ id: "form", pattern: "/form", page: true, layouts: [], server: () => Promise.resolve(server) }];
  const handler = createHandler({ routes, render: () => new Response("page"), renderError: ({ status }) => new Response("e", { status }), onError: () => {} });
  const g = globalThis as Record<PropertyKey, unknown>;
  const saved = { fetch: g.fetch, location: g.location, router: g[ROUTER], reportError: g.reportError, document: g.document };
  const reported: unknown[] = [];
  g.fetch = (async (url: string, init: RequestInit) =>
    handler(new Request(url, { ...init, headers: { ...(init.headers as Record<string, string>), origin: "http://x" } }))) as typeof fetch;
  g.location = new URL("http://x/form");
  // No router announcement on the page, no form elements to reset: the installed router answers at once.
  g.document = { querySelector: () => null, getElementById: () => null };
  g[ROUTER] = { clear() {}, go };
  g.reportError = (error: unknown) => reported.push(error);
  try {
    const form = (name: string) => ({ getAttribute: (attr: string) => (attr === "action" ? "http://x/form?/" + name : null) }) as unknown as HTMLFormElement;
    await run(form);
  } finally {
    Object.assign(g, saved);
    if (saved.router === undefined) delete g[ROUTER];
  }
  return reported;
}

test("a throwing revalidation after a successful action keeps the success: no errors.network, reported once", async () => {
  let runs = 0;
  const failure = new Error("chunk failed");
  const def = defineForm({ name: "contact", schema: schema<{ email: string }>(() => []) });
  const form = createForm(def);
  const reported = await withServer(
    { actions: { save: () => (runs++, { ok: true, data: "saved" }) } },
    () => Promise.reject(failure),
    async (element) => {
      assert.equal(await send(def, form, element("save"), fd([["email", "a@b.c"]])), true);
      assert.equal(runs, 1);
      assert.deepEqual(
        untrack(() => formIssues(form)),
        [],
      );
      assert.equal(
        untrack(() => lastResult(form)),
        "saved",
      );
      assert.equal(
        untrack(() => submitting(form)),
        false,
      );
    },
  );
  assert.deepEqual(reported, [failure]);
});

test("a throwing redirect navigation after a successful action is reported, not shown as a network failure", async () => {
  const failure = new Error("route chunk failed");
  const targets: string[] = [];
  const def = defineForm({ name: "contact", schema: schema<{ email: string }>(() => []) });
  const form = createForm(def);
  const reported = await withServer(
    { actions: { save: () => redirect("/done") } },
    (url) => (targets.push(url.pathname), Promise.reject(failure)),
    async (element) => {
      assert.equal(await send(def, form, element("save"), fd([["email", "a@b.c"]])), true);
      assert.deepEqual(
        untrack(() => formIssues(form)),
        [],
      );
    },
  );
  assert.deepEqual(reported, [failure]);
  assert.deepEqual(targets, ["/done"]);
});

test("a failing POST still shows errors.network", async () => {
  const def = defineForm({ name: "contact", schema: schema<{ email: string }>(() => []) });
  const form = createForm(def);
  const g = globalThis as Record<PropertyKey, unknown>;
  const saved = g.fetch;
  g.fetch = (async () => {
    throw new TypeError("Failed to fetch");
  }) as typeof fetch;
  try {
    const element = { getAttribute: (attr: string) => (attr === "action" ? "http://x/form?/save" : null) } as unknown as HTMLFormElement;
    assert.equal(await send(def, form, element, fd([["email", "a@b.c"]])), false);
    assert.deepEqual(
      untrack(() => formIssues(form)).map((issue) => issue.key),
      ["errors.network"],
    );
  } finally {
    g.fetch = saved;
  }
});
