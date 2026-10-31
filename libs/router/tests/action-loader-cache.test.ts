import { test } from "vitest";
import assert from "node:assert/strict";
import { createHandler, type ServerModule } from "@rivetjs/router/server";
import { redirect } from "@rivetjs/router";
import { createDecoder } from "@rivetjs/runtime/resume-format";

test("enhanced action loader cookies finalize cache privacy after revalidation", async () => {
  for (const cookieSource of ["loader", "action", "none"] as const) {
    let loads = 0;
    const module: ServerModule = {
      actions: {
        save(event) {
          if (cookieSource === "action") event.cookies.set("visitor", "synthetic-alice");
          return { saved: true };
        },
        back(event) {
          if (cookieSource === "action") event.cookies.set("visitor", "synthetic-alice");
          return redirect("/form");
        },
      },
      async load(event) {
        await Promise.resolve();
        loads++;
        if (cookieSource === "loader") event.cookies.set("visitor", "synthetic-alice");
        event.setHeader("cache-control", "public, s-maxage=600, max-age=60");
        return { visitor: "synthetic-alice" };
      },
    };
    const handler = createHandler({
      routes: [{ id: "form", pattern: "/form", page: true, layouts: [], server: async () => module }],
      render: () => {
        assert.fail("enhanced actions must return JSON without rendering a document");
      },
    });
    for (const name of ["save", "back"]) {
      const response = await handler(
        new Request("http://fixture.test/form?/" + name, {
          method: "POST",
          headers: { origin: "http://fixture.test", accept: "application/json", "x-rivet-revalidate": "1" },
        }),
      );
      assert.equal(response.status, 200);
      const wire = (await response.json()) as { t: unknown[]; r: number };
      assert.deepEqual(createDecoder(wire.t).get(wire.r), {
        ...(name === "back" ? { redirect: "/form", status: 303 } : { action: { name: "save", result: { saved: true } } }),
        data: [{ visitor: "synthetic-alice" }],
      });
      if (cookieSource === "none") {
        assert.deepEqual(response.headers.getSetCookie(), []);
        assert.equal(response.headers.get("cache-control"), "public, s-maxage=600, max-age=60", "cookie-free revalidation preserves the loader policy");
      } else {
        assert.match(response.headers.getSetCookie()[0]!, /^visitor=synthetic-alice;/);
        assert.equal(
          response.headers.get("cache-control"),
          "private, max-age=60",
          "enhanced action revalidation must finalize cookie privacy after loader headers",
        );
      }
    }
    assert.equal(loads, 2, "each enhanced action awaits exactly one fresh load");
  }
});
