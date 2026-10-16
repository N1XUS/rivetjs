// DevTools wiring on the dev server: the panel route, the agent script ahead of app code in served HTML, the
// opt-out, and builds that never include either.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build, createServer, type InlineConfig } from "vite";
import { rivet } from "../vite.ts";

const AGENT = '<script type="module" src="/@id/@rivetjs/devtools/agent"></script>';

async function app(): Promise<string> {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-devtools-"));
  await writeFile(resolve(root, "index.html"), '<!doctype html><html><head><title>t</title></head><body><div id="app"></div><script type="module" src="/main.tsx"></script></body></html>');
  await writeFile(resolve(root, "main.tsx"), 'import {mount} from "@rivetjs/runtime/dom"; mount(() => <p>hi</p>, document.querySelector("#app"));');
  return root;
}

async function serve(root: string, plugin = rivet()) {
  const server = await createServer({ root, configFile: false, logLevel: "silent", plugins: [plugin], server: { port: 0 } });
  await server.listen();
  return { server, origin: server.resolvedUrls!.local[0]!.replace(/\/$/, "") };
}

test("vite serve: the agent loads first in served HTML and the panel is served under __rivet/devtools/", async () => {
  const root = await app();
  const { server, origin } = await serve(root);
  try {
    const html = await (await fetch(origin + "/")).text();
    assert.ok(html.indexOf(AGENT) !== -1, html);
    // Before any app module: the hook exists when the framework's development façades evaluate.
    assert.ok(html.indexOf(AGENT) < html.indexOf("/main.tsx"), "agent before the app entry");
    // The agent module resolves through Vite's bare-id route.
    const agent = await fetch(origin + "/@id/@rivetjs/devtools/agent");
    assert.equal(agent.status, 200);
    assert.match(await agent.text(), /rivet\.devtools|createHook/);
    // The panel: the prebuilt UI, or a hint when it was not built.
    const panel = await fetch(origin + "/__rivet/devtools/");
    if (panel.status === 200) assert.match(await panel.text(), /<title>Rivet DevTools<\/title>/);
    else {
      assert.equal(panel.status, 503);
      assert.match(await panel.text(), /nx run devtools:build/);
    }
    const redirect = await fetch(origin + "/__rivet/devtools", { redirect: "manual" });
    assert.equal(redirect.status, 301);
    assert.equal(redirect.headers.get("location"), "/__rivet/devtools/");
    assert.deepEqual((server.config.plugins.find((p) => p.name === "vite-plugin-rivet")!.api as { devtoolsScripts(): string[] }).devtoolsScripts(), ["/@id/@rivetjs/devtools/agent"]);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("rivet({ devtools: false }): no agent, no panel route", async () => {
  const root = await app();
  const plugin = rivet({ devtools: false });
  const { server, origin } = await serve(root, plugin);
  try {
    const html = await (await fetch(origin + "/")).text();
    assert.doesNotMatch(html, /devtools/);
    // SPA fallback: the app's own index.html, not the panel.
    assert.doesNotMatch(await (await fetch(origin + "/__rivet/devtools/")).text(), /Rivet DevTools/);
    assert.deepEqual((plugin.api as { devtoolsScripts(): string[] }).devtoolsScripts(), []);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("builds never include DevTools", async () => {
  const root = await app();
  try {
    for (const mode of ["production", "development"]) {
      // A dev server earlier in this process set NODE_ENV=development, which would pick `development` exports.
      delete process.env.NODE_ENV;
      const config: InlineConfig = { root, configFile: false, logLevel: "silent", mode, plugins: [rivet()], build: { outDir: "dist-" + mode, minify: false } };
      await build(config);
      const html = await readFile(resolve(root, "dist-" + mode, "index.html"), "utf8");
      assert.doesNotMatch(html, /devtools/);
      const js = await Promise.all((await readdir(resolve(root, "dist-" + mode, "assets"))).map((name) => readFile(resolve(root, "dist-" + mode, "assets", name), "utf8")));
      // Development builds keep the inert façades (they look up the hook); the agent is serve-only.
      assert.doesNotMatch(js.join(""), /rivet-devtools/);
      if (mode === "production") assert.doesNotMatch(js.join(""), /rivet\.devtools/);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
