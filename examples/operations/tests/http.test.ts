import { beforeAll, afterAll, test, expect } from "vitest";
import assert from "node:assert/strict";
import { startApp, type AppFixture } from "./_support.ts";
let app: AppFixture;
let base: string;
beforeAll(async () => {
  app = await startApp("http");
  base = app.base;
});
afterAll(async () => {
  await app?.close();
});
function check(name: string, fn: () => unknown | Promise<unknown>) {
  test(name, fn);
}
check("ssr-dashboard-is-real-html", async () => {
  const r = await fetch(base);
  const text = await r.text();
  assert.equal(r.status, 200);
  assert.match(text, /Incident operations/);
  assert.match(text, /Incident 001/);
  return { status: r.status, bytes: Buffer.byteLength(text) };
});
check("ssr-request-isolation-40-concurrent-users", async () => {
  const names = Array.from({ length: 40 }, (_, i) => `USER_${String(i).padStart(3, "0")}_END`);
  const pages = await Promise.all(names.map(async (u) => (await fetch(`${base}/identity?user=${u}`)).text()));
  for (let i = 0; i < pages.length; i++) {
    assert.ok(pages[i].includes(names[i]));
    for (let j = 0; j < names.length; j++) if (i !== j) assert.ok(!pages[i].includes(names[j]), `${names[j]} leaked to ${names[i]}`);
  }
  return { users: 40 };
});
check("ssr-escapes-attacker-text", async () => {
  const attack = '<img src=x onerror="globalThis.pwned=1">';
  const text = await (await fetch(`${base}/identity?user=${encodeURIComponent(attack)}`)).text();
  assert.ok(!text.includes(attack));
  assert.match(text, /&lt;img/);
  return { escaped: true };
});
check("cross-origin-post-rejected", async () => {
  const r = await fetch(`${base}/api/tasks`, {
    method: "POST",
    headers: { origin: "https://attacker.invalid", "content-type": "application/json" },
    body: '{"title":"pwn"}',
  });
  assert.equal(r.status, 403);
  return { status: r.status };
});
check("same-origin-ajax-cas-conflict", async () => {
  const token = `http-${Date.now()}`;
  const post = (version: number) =>
    fetch(`${base}/api/tasks?token=${token}`, {
      method: "POST",
      headers: { origin: base, "content-type": "application/json" },
      body: JSON.stringify({ version, title: "edited" }),
    });
  assert.equal((await post(0)).status, 200);
  assert.equal((await post(0)).status, 409);
  return { conflict: 409 };
});
check("sse-delivers-in-order", async () => {
  const text = await (await fetch(`${base}/api/events?limit=8&ms=5`)).text();
  const ids = [...text.matchAll(/^id: (\d+)/gm)].map((m) => Number(m[1]));
  assert.deepEqual(ids, [1, 2, 3, 4, 5, 6, 7, 8]);
  return { ids };
});
check("sse-disconnect-disposes-producer", async () => {
  const controller = new AbortController();
  const r = await fetch(`${base}/api/events?limit=10000&ms=10`, { signal: controller.signal });
  const reader = r.body!.getReader();
  await reader.read();
  controller.abort();
  await expect.poll(async () => (await (await fetch(base + "/api/stats")).json()).sseActive, { timeout: 5000 }).toBe(0);
  const stats = await (await fetch(`${base}/api/stats`)).json();
  assert.equal(stats.sseActive, 0);
  return stats;
});
check("progressive-form-without-javascript", async () => {
  const r = await fetch(`${base}/?/add`, {
    method: "POST",
    redirect: "manual",
    headers: { origin: base, "content-type": "application/x-www-form-urlencoded" },
    body: "title=from-native-form",
  });
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("location"), "/");
  return { status: r.status };
});
