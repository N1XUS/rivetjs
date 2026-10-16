import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { chromium } from "playwright";

test("every SSR page works without JavaScript and browser services use only REST", async () => {
  const browser = await chromium.launch({ headless: true });
  // The browser receives the service module exactly as Node runs it: TypeScript with types erased.
  const source = stripTypeScriptTypes(await readFile(new URL("../services/content.client.ts", import.meta.url), "utf8"));
  try {
    const endpoints = (process.env.SSR_BENCH_ENDPOINTS ??
      "http://127.0.0.1:18101,http://127.0.0.1:18102,http://127.0.0.1:18103,http://127.0.0.1:18104,http://127.0.0.1:18111,http://127.0.0.1:18112").split(",");
    for (const base of endpoints) {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(base + "/page?rows=2&token=browser");
      assert.equal(await page.locator("dd").count(), 20);
      assert.equal(await page.locator("main").getAttribute("data-token"), "browser");
      assert.equal(await page.locator("dd").last().innerText(), "109");
      await context.close();
      const active = await browser.newContext();
      const client = await active.newPage();
      const failures: string[] = [];
      const requests: string[] = [];
      client.on("response", (response) => {
        if (response.status() >= 400) failures.push(response.url());
      });
      client.on("pageerror", (error) => failures.push(error.message));
      client.on("request", (request) => requests.push(request.url()));
      await client.goto(base + "/page?rows=1&token=rest");
      const dto = await client.evaluate(async (code) => {
        const { contentClient } = (await import("data:text/javascript;base64," + code)) as typeof import("../services/content.client.ts");
        return contentClient().getArticle("performance");
      }, Buffer.from(source).toString("base64"));
      assert.match(dto.markdown, /^# Benchmark article/);
      assert.ok(requests.some((url) => url.endsWith("/api/articles/performance")));
      assert.ok(requests.every((url) => !url.includes("grpc") && !url.includes("rabbit")));
      assert.deepEqual(failures, []);
      await active.close();
    }
  } finally {
    await browser.close();
  }
});
