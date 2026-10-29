import { test } from "vitest";
import assert from "node:assert/strict";
import type { AppHandler } from "../server/handler.ts";
import { withRouteRules } from "../server/route-cache.ts";

for (const [name, value] of [
  ["vary", "x-tenant"],
  ["vary", "*"],
  ["cache-control", "private, no-store"],
  ["set-cookie", "session=alpha; HttpOnly"],
  ["content-type", "application/json"],
]) {
  test(`stream completion rechecks ${name}: ${value} before sharing`, async () => {
    let calls = 0;
    const handler: AppHandler = async (request) => {
      calls++;
      const tenant = request.headers.get("x-tenant");
      const response = new Response(
        new ReadableStream(
          {
            pull(controller) {
              response.headers.set(name!, name === "set-cookie" ? `session=${tenant}; HttpOnly` : value!);
              controller.enqueue(new TextEncoder().encode(`<p>${tenant}</p>`));
              controller.close();
            },
          },
          { highWaterMark: 0 },
        ),
        { headers: { "content-type": "text/html" } },
      );
      return response;
    };
    const page = withRouteRules(handler, { "/report": { cache: { maxAge: 60 } } }, { policy: () => false, hash: null }, "", { origin: "http://local.test" });
    const request = (tenant: string) => new Request("http://local.test/report", { headers: { "x-tenant": tenant } });
    const alpha = await page(request("alpha"));
    assert.equal(await alpha.text(), "<p>alpha</p>");
    const beta = await page(request("beta"));
    assert.equal(await beta.text(), "<p>beta</p>", "a late header cannot expose a previous visitor's representation");
    if (name === "set-cookie") assert.equal(beta.headers.get("set-cookie"), "session=beta; HttpOnly");
    assert.equal(alpha.headers.get(name!), name === "set-cookie" ? "session=alpha; HttpOnly" : value!);
    if (name === "vary" && value === "x-tenant") {
      const hit = await page(request("alpha"));
      assert.equal(await hit.text(), "<p>alpha</p>");
      assert.equal(hit.headers.get("x-rivet-cache"), "HIT", "late Vary still permits the matching public representation");
      assert.equal(calls, 2);
    } else assert.equal(beta.headers.get("x-rivet-cache"), null);
  });
}

test("late credential Vary returns the original visitor's response without sharing", async () => {
  let calls = 0;
  const handler: AppHandler = async (request) => {
    calls++;
    const response = new Response(
      new ReadableStream(
        {
          pull(controller) {
            response.headers.set("vary", "cookie");
            controller.enqueue(new TextEncoder().encode(request.headers.get("cookie") ?? "anonymous"));
            controller.close();
          },
        },
        { highWaterMark: 0 },
      ),
      { headers: { "content-type": "text/html" } },
    );
    return response;
  };
  const page = withRouteRules(handler, { "/profile": { cache: { maxAge: 60, cookies: true } } }, { policy: () => false, hash: null }, "", {
    origin: "http://local.test",
  });
  const alice = await page(new Request("http://local.test/profile", { headers: { cookie: "session=alice" } }));
  assert.equal(await alice.text(), "session=alice");
  assert.equal(alice.headers.get("vary"), "cookie");
  assert.equal(alice.headers.get("x-rivet-cache"), null);
  assert.equal(calls, 2, "anonymous fill falls back to the visitor's original request");
  const anonymous = await page(new Request("http://local.test/profile"));
  assert.equal(await anonymous.text(), "anonymous");
});
