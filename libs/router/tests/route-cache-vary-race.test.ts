import { test } from "vitest";
import assert from "node:assert/strict";
import type { AppHandler } from "../server/handler.ts";
import { withRouteRules } from "../server/route-cache.ts";

test("a concurrent first fill cannot share a newly learned Vary representation with another tenant", async () => {
  let release!: () => void;
  let entered!: () => void;
  const waiting = new Promise<void>((done) => (entered = done));
  const gate = new Promise<void>((done) => (release = done));
  let alphaCalls = 0;
  const handler: AppHandler = async (request) => {
    const tenant = request.headers.get("x-tenant");
    if (tenant === "alpha" && ++alphaCalls === 1) {
      entered();
      await gate;
    }
    return new Response(`<p>${tenant}</p>`, { headers: { "content-type": "text/html", vary: "x-tenant" } });
  };
  const page = withRouteRules(handler, { "/report": { cache: { maxAge: 60 } } }, { policy: () => false, hash: null }, "", { origin: "http://local.test" });
  const request = (tenant: string) => new Request("http://local.test/report", { headers: { "x-tenant": tenant } });
  const alpha = page(request("alpha"));
  await waiting;
  const beta = page(request("beta"));
  release();
  const [a, b] = await Promise.all([alpha, beta]);
  assert.equal(await a.text(), "<p>alpha</p>");
  assert.equal(await b.text(), "<p>beta</p>", "the waiter must match Vary learned while its shared fill was pending");
  const hit = await page(request("alpha"));
  assert.equal(await hit.text(), "<p>alpha</p>");
  assert.equal(hit.headers.get("x-rivet-cache"), "HIT", "the matching representation remains cached");
  assert.equal(alphaCalls, 1);
  for (let i = 0; i < 3; i++) assert.equal(await (await page(request("beta"))).text(), "<p>beta</p>");
});
