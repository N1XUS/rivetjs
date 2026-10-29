import { test } from "vitest";
import assert from "node:assert/strict";
import { createHandler } from "../server/handler.ts";
import { withRouteRules } from "../server/route-cache.ts";
import { createShells } from "../server/shell-cache.ts";

// Framework middleware supplies locals; a generic descriptor reader must count like direct property access.
test.each(["descriptor", "prototype"])("shell loaders cannot cache a session obtained through a locals %s", async (access) => {
  const handler = createHandler({
    routes: [
      {
        id: "profile",
        pattern: "/profile",
        page: true,
        layouts: [
          async () => ({
            onRequest: (event) => {
              const session = event.cookies.get("session") ?? "anonymous";
              if (access === "prototype") Object.setPrototypeOf(event.locals, { session });
              else event.locals.session = session;
            },
            load: Object.assign(async () => "public hole", { [Symbol.for("rivet.defer")]: true }),
          }),
        ],
        server: async () => ({
          load: (event) =>
            access === "prototype" ? Object.getPrototypeOf(event.locals).session : Object.getOwnPropertyDescriptor(event.locals, "session")!.value,
        }),
      },
    ],
    render: (input) => {
      const identity = input.data[1];
      const hole = input.data[0] as PromiseLike<string>;
      input.headers.set("content-type", "text/html");
      return new Response(
        new ReadableStream({
          async start(controller) {
            const encode = (text: string) => new TextEncoder().encode(text);
            controller.enqueue(encode(`<!doctype html><body><p>${identity}</p><script type="rivet/boundaries">{}</script>`));
            controller.enqueue(encode(`<template data-a="4">${await hole}</template></body>`));
            controller.close();
          },
        }),
        { headers: input.headers },
      );
    },
  });
  const page = withRouteRules(
    handler,
    { "/profile": { shell: true } },
    { policy: () => false, hash: null },
    "",
    { origin: "http://local.test" },
    { createShells },
  );
  const request = (session?: string) => new Request("http://local.test/profile", { headers: session ? { cookie: `session=${session}` } : {} });
  const alice = await page(request("alice"));
  assert.match(await alice.text(), /<p>alice<\/p>/);
  const anonymous = await page(request());
  const body = await anonymous.text();
  assert.match(body, /<p>anonymous<\/p>/, "a shell must not reuse Alice's session-derived loader result");
  assert.doesNotMatch(body, /alice/);
  assert.equal(anonymous.headers.get("x-rivet-cache"), null);
});
