// Recipe `apps/docs/content/recipes/render-with-data-from-another-server.md` end to end (EXT-B item 8): a production
// build loaded with `loadBuild` from `@rivetjs/router/node`, served by a custom `serve({ handler })` that turns a
// backend's JSON POST into a page render with seeded `locals`.
// Run: `npx vitest run --project router libs/router/tests/recipe-render.test.ts`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { build } from "vite";
import { loadBuild, readManifests, serve } from "../adapters/node.ts";

const root = new URL("./fixture-recipe/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";

test("render with data from another server: loadBuild + serve({ handler }) + seeded locals", async () => {
  await rm(root + "dist", { recursive: true, force: true });
  await build({ root, configFile, logLevel: "silent" });
  await build({ root, configFile, logLevel: "silent", build: { ssr: true } });
  const manifests = await readManifests(root + "dist");
  assert.equal(manifests.clients.length, 1);
  const { handler: app, client } = await loadBuild(root + "dist");
  const serving = await serve({
    port: 0,
    client,
    handler: async (request, context) => {
      if (request.method !== "POST") return app(request, context);
      const { template, viewModel } = (await request.json()) as { template: string; viewModel: unknown };
      const page = new Request(new URL(`/splash/${template}`, request.url), { headers: request.headers });
      return app(page, { ...context, locals: { viewModel } });
    },
  });
  try {
    const viewModel = { title: "Survey 7", questions: [{ id: "a", text: "First question" }] };
    const response = await fetch(serving.url + "/render", {
      method: "POST",
      headers: { "content-type": "application/json", origin: serving.url },
      body: JSON.stringify({ template: "survey", viewModel }),
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<h1>Survey 7<\/h1>/);
    assert.match(html, /<li>First question<\/li>/);
    assert.match(html, /<script type="rivet\/state"/);
    // The page's own scripts load from the build the custom server serves.
    const script = /"rt":"(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
    assert.ok(script, html);
    assert.equal((await fetch(serving.url + script)).status, 200);
    // Other requests reach the app as they are.
    assert.match(await (await fetch(serving.url + "/")).text(), /<h1>Home<\/h1>/);
  } finally {
    await serving.close();
    await rm(root + "dist", { recursive: true, force: true });
  }
});
