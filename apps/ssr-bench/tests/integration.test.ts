import { test } from "vitest";
import assert from "node:assert/strict";

const endpoints = (
  process.env.SSR_BENCH_ENDPOINTS ??
  "http://127.0.0.1:18101,http://127.0.0.1:18102,http://127.0.0.1:18103,http://127.0.0.1:18104,http://127.0.0.1:18111,http://127.0.0.1:18112"
).split(",");

for (const url of endpoints) {
  test(`${url} emits complete isolated RPC-backed pages with all fields`, async () => {
    const bodies = await Promise.all(
      ["first", "second", "third"].map(async (token) => {
        const response = await fetch(`${url}/page?rows=2&token=${token}`, { signal: AbortSignal.timeout(10000) });
        assert.equal(response.status, 200);
        return response.text();
      }),
    );
    for (const [i, token] of ["first", "second", "third"].entries()) {
      assert.match(bodies[i]!, new RegExp(`data-token="${token}"`));
      assert.equal((bodies[i]!.match(/<dd\b/g) ?? []).length, 20);
      assert.match(bodies[i]!.replace(/<!--[^]*?-->/g, ""), /<dd\b[^>]*>109<\/dd>/);
      assert.match(bodies[i]!, /<!--complete-->/);
      assert.doesNotMatch(bodies[i]!, /<script>alert/);
    }
  });
  test(`${url} exposes a REST DTO and renders article content`, async () => {
    const response = await fetch(`${url}/api/articles/performance`);
    assert.equal(response.status, 200);
    const dto = (await response.json()) as { id: string; markdown: string };
    assert.equal(dto.id, "performance");
    assert.match(dto.markdown, /^# Benchmark article/);
    const article = await fetch(`${url}/page?rows=0&article=1&token=article`);
    assert.match(await article.text(), /<h1[^>]*>Benchmark article<\/h1>/);
    assert.equal((await fetch(`${url}/api/articles/missing`)).status, 404);
  });
  test(`${url} rejects invalid workloads without returning successful empty HTML`, async () => {
    assert.equal((await fetch(`${url}/page?rows=5001`)).status, 400);
    assert.equal((await fetch(`${url}/page?rows=invalid`)).status, 400);
  });
  test(`${url} cancels a delayed backend call and recovers`, async () => {
    await assert.rejects(fetch(`${url}/page?rows=1&delay_ms=2000`, { signal: AbortSignal.timeout(100) }));
    assert.equal((await fetch(`${url}/page?rows=1&token=recovered`)).status, 200);
  });
}
