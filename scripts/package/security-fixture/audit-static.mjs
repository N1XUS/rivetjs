import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { build } from "vite";
import { prerenderBuild } from "@rivetjs/router/static";
import { chromium } from "playwright";

export async function staticCases({ root, check, hostile, forbidden }) {
  const app = join(root, "static");
  await mkdir(join(app, "src/routes"), { recursive: true });
  for (const file of ["document.ts", "private.server.ts"]) await writeFile(join(app, "src", file), await readFile(join(root, "src", file)));
  await writeFile(
    join(app, "src/routes/index.tsx"),
    `
    import { signal } from "@rivetjs/reactivity";
    import { load } from "@rivetjs/router";
    import { Title, JsonLd } from "@rivetjs/kit";
    import { privateToken } from "../private.server";
    export const prerender = true;
    export const loader = load(() => ({ payload: ${JSON.stringify(hostile)}, ready: privateToken.length > 0 }));
    export default function Static({data}) { const n = signal(0); return <main><Title>{data.payload}</Title><JsonLd data={{name:data.payload}}/><p id="static-text">{data.payload}</p><button id="static-count" onClick={() => n.update(v => v + 1)}>{n()}</button></main>; }
  `,
  );
  const configFile = join(app, "vite.config.ts");
  await writeFile(
    configFile,
    'import { kit } from "@rivetjs/kit/vite"; import { rivetRouter } from "@rivetjs/router/vite"; export default { plugins: [kit(), rivetRouter({mode:"static",clientRouter:true,devtools:false})],build:{sourcemap:true} };',
  );
  const dist = join(app, "dist");
  await build({ root: app, configFile, logLevel: "warn", build: { outDir: join(dist, "client") } });
  await build({ root: app, configFile, logLevel: "warn", build: { ssr: true, outDir: join(dist, "server") } });
  const rendered = await prerenderBuild({ dist, origin: "http://static.test", csp: false, progress: false });
  const client = join(dist, "client");
  await check("static: production prerender writes the expected page", async () => {
    assert.ok(rendered.pages.includes("/"));
    const html = await readFile(join(client, "index.html"), "utf8");
    assert.ok(!html.includes(forbidden[0]));
    assert.ok(!html.includes('<img id="injected"'));
  });
  await check("static: emitted browser sources and data omit the server-only canary", async () => {
    const files = await readdir(client, { recursive: true });
    assert.ok(files.some((f) => f.endsWith(".js")));
    assert.ok(
      files.some((f) => f.endsWith(".js.map")),
      "actual static maps must be inspected",
    );
    for (const file of files) {
      if (!/\.(?:js|map|json|html)$/.test(file)) continue;
      assert.ok(!(await readFile(join(client, file), "utf8")).includes(forbidden[0]), file);
    }
  });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    await check("static: text/JSON-LD stays inert and the installed runtime resumes", async () => {
      const page = await browser.newPage();
      page.setDefaultTimeout(10000);
      page.setDefaultNavigationTimeout(15000);
      // Serve the actual prerendered bytes/assets through browser interception; no SSR handler can replace them.
      await page.route("http://static.test/**", async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        const file = resolve(client, "." + (pathname === "/" ? "/index.html" : pathname));
        assert.ok(file.startsWith(client + "/"));
        try {
          await route.fulfill({
            body: await readFile(file),
            contentType: file.endsWith(".js") ? "text/javascript" : file.endsWith(".json") ? "application/json" : "text/html",
          });
        } catch {
          await route.fulfill({ status: 404, body: "missing fixture asset" });
        }
      });
      await page.goto("http://static.test/");
      assert.equal(await page.locator('meta[http-equiv="Content-Security-Policy" i]').count(), 0, "static escaping probe must not be masked by CSP");
      assert.equal(await page.locator("#static-text").textContent(), hostile);
      assert.equal(await page.locator("#injected").count(), 0);
      assert.equal(await page.evaluate(() => globalThis.__auditXss), undefined);
      assert.equal(JSON.parse(await page.locator('script[type="application/ld+json"]').textContent()).name, hostile);
      await page.locator("#static-count").click();
      await page.waitForFunction(() => document.querySelector("#static-count")?.textContent === "1");
      assert.equal(await page.evaluate(() => globalThis.__auditXss), undefined);
    });
  } finally {
    await browser.close();
  }
}
