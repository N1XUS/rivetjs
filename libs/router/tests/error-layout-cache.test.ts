import { test } from "vitest";
import assert from "node:assert/strict";
import { createHandler, type ServerModule } from "@rivetjs/router/server";
import { deny } from "@rivetjs/router";

test("cookies set by error-page layout loaders make the response private", async () => {
  const mod = (module: ServerModule) => async () => module;
  let loads = 0;
  const handler = createHandler({
    routes: [
      {
        id: "private",
        pattern: "/private",
        page: true,
        layouts: [
          mod({
            load(event) {
              loads++;
              event.cookies.set("visitor", "synthetic-alice");
              event.setHeader("cache-control", "public, s-maxage=600, max-age=60");
              return { visitor: "synthetic-alice" };
            },
          }),
        ],
        server: mod({
          guard() {
            throw deny(403);
          },
        }),
      },
    ],
    render: () => {
      assert.fail("the denied page must not render");
    },
    renderError: ({ status, headers, layouts }) => new Response(JSON.stringify(layouts), { status, headers }),
  });

  // JSON errors never load layouts just to render an error document.
  const data = await handler(new Request("http://fixture.test/private?_rivet=data"));
  assert.equal(data.status, 403);
  assert.equal(loads, 0);
  assert.deepEqual(data.headers.getSetCookie(), []);
  await data.text();

  const response = await handler(new Request("http://fixture.test/private"));
  assert.equal(response.status, 403);
  assert.equal(loads, 1);
  assert.deepEqual(await response.json(), [{ visitor: "synthetic-alice" }]);
  assert.match(response.headers.getSetCookie()[0]!, /^visitor=synthetic-alice;/);
  assert.equal(
    response.headers.get("cache-control"),
    "private, max-age=60",
    "error-layout cookies must remove public and s-maxage after fallback loaders finish",
  );
});
