// A shared authentication boundary must also run before raw page handlers, which precede layout guards.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createHandler, type AppRoute, type ServerModule } from "../server/handler.ts";
import { deny } from "../shared/errors.ts";
import { createDecoder } from "@rivetjs/runtime/resume-format";

const mod = (module: ServerModule) => () => Promise.resolve(module);

test.each(["GET", "POST"])("layout onRequest protects handlers and loaders, including kept-layout data requests (%s)", async (method) => {
  const privateMarker = "synthetic-private-response";
  const observed: unknown[] = [];
  let layoutLoads = 0;
  const layout = mod({
    onRequest(event) {
      // Fixed token stands in for a real server-side session validator in this isolated unit fixture.
      if (event.request.headers.get("authorization") !== "Bearer fixture-session") throw deny(401);
      event.locals.actor = "alice";
    },
    load: () => (++layoutLoads, "layout data"),
  });
  const payload: NonNullable<ServerModule["onGet"]> = (event) => {
    observed.push(event.locals.actor);
    return new Response(privateMarker);
  };
  const routes: AppRoute[] = [
    { id: "private/page", pattern: "/private/page", page: true, layouts: [layout], keys: ["/private"], server: mod({ onGet: payload, onPost: payload }) },
    { id: "private/api", pattern: "/private/api", page: false, layouts: [layout], keys: ["/private"], server: mod({ onGet: payload, onPost: payload }) },
    {
      id: "private/loader",
      pattern: "/private/loader",
      page: true,
      layouts: [layout],
      keys: ["/private"],
      server: mod({
        load: (event) => {
          observed.push(event.locals.actor);
          return privateMarker;
        },
      }),
    },
  ];
  const handler = createHandler({
    routes,
    render: (input) => Response.json(input.data),
    renderError: ({ status }) => new Response("Denied", { status }),
  });
  for (const route of routes)
    for (const query of ["", "?_rivet=data&_rivet_keep=/private"])
      for (const authorization of ["", "Bearer forged-session"]) {
        const response = await handler(
          new Request("http://local.test" + route.pattern + query, { method, headers: { origin: "http://local.test", authorization } }),
        );
        assert.equal(response.status, 401, route.id + query);
        assert.ok(!(await response.text()).includes(privateMarker));
      }
  assert.deepEqual(observed, [], "denied requests cannot reach handlers or loaders");
  assert.equal(layoutLoads, 0);
  for (const route of routes) {
    const response = await handler(
      new Request("http://local.test" + route.pattern, { method, headers: { origin: "http://local.test", authorization: "Bearer fixture-session" } }),
    );
    assert.equal(response.status, method === "POST" && route.id.endsWith("/loader") ? 405 : 200);
    if (response.status === 200) assert.ok((await response.text()).includes(privateMarker));
  }
  for (const route of routes) {
    const response = await handler(
      new Request("http://local.test" + route.pattern + "?_rivet=data&_rivet_keep=/private", {
        method,
        headers: { origin: "http://local.test", authorization: "Bearer fixture-session" },
      }),
    );
    assert.equal(response.status, method === "POST" && route.id.endsWith("/loader") ? 405 : 200, "valid data/query requests remain usable");
    if (method === "GET" && route.id.endsWith("/loader")) {
      const wire = (await response.json()) as { t: unknown[]; r: number };
      const answer = createDecoder(wire.t).get(wire.r) as { keep?: number[] };
      assert.deepEqual(answer.keep, [0], "the real layout loader is kept while authentication still runs");
    }
  }
  assert.equal(layoutLoads, method === "GET" ? 1 : 0, "only the unkept document request loads layout data");
  assert.deepEqual(observed, Array(method === "GET" ? 6 : 4).fill("alice"), "validated identity reaches every permitted operation");
});
