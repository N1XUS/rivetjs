import { test } from "vitest";
import { createServer } from "node:http";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build, type Plugin } from "vite";
import { rivet } from "@rivetjs/compiler/vite";
import { kit } from "@rivetjs/kit/vite";
import { vue } from "../vite.ts";

interface Manifest {
  islands?: Record<string, string>;
  deps?: Record<string, string[]>;
  css?: unknown;
}

async function verifyBrowser(root: string, html: string): Promise<void> {
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    try {
      if (path === "/") {
        response.setHeader("Content-Type", "text/html");
        response.end(html);
        return;
      }
      const file = resolve(root, "dist", "." + path);
      if (!file.startsWith(resolve(root, "dist") + "/")) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.setHeader("Content-Type", path.endsWith(".css") ? "text/css" : "text/javascript");
      response.end(await readFile(file));
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const url = `http://127.0.0.1:${address.port}/`;
    const staticContext = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await staticContext.newPage();
    await staticPage.goto(url);
    assert.deepEqual(
      await staticPage.locator(".vue-card").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).color)),
      ["rgb(12, 34, 56)", "rgb(12, 34, 56)"],
      "SSR styles apply before hydration, including the static island",
    );
    assert.equal(
      await staticPage.locator(".static-card").evaluate((node) => getComputedStyle(node).color),
      "rgb(65, 43, 21)",
      "a separate static-only SFC includes its own stylesheet before hydration",
    );
    assert.deepEqual(
      await staticPage.locator(".lazy-card").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).color)),
      ["rgb(7, 8, 9)", "rgb(7, 8, 9)"],
      "native dynamically imported async SFC children include scoped CSS in SSR without JavaScript",
    );
    await staticContext.close();
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/assets/*.js", async (route) => {
      await held;
      await route.continue().catch(() => {});
    });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const firstMeta = await page.$('head meta[name="vue-card-1"]'),
      secondMeta = await page.$('head meta[name="vue-card-2"]');
    assert.ok(firstMeta && secondMeta, "automatic generated facade head sink reaches document.head before JS");
    release();
    await page.waitForLoadState("networkidle");
    assert.equal(await page.evaluate((node) => document.head.querySelector('meta[name="vue-card-1"]') === node, firstMeta), true);
    assert.equal(await page.evaluate((node) => document.head.querySelector('meta[name="vue-card-2"]') === node, secondMeta), true);
    assert.equal(await page.locator('head meta[name^="vue-card-"]').count(), 2);
    await page.locator(".vue-card button").first().click();
    await page.waitForFunction(() => document.querySelector(".vue-card button")?.textContent === "1");
    assert.equal(await page.locator(".vue-card button").last().textContent(), "0", "static island never hydrates");
    assert.equal(await page.locator('head meta[name="vue-card-1"]').getAttribute("content"), "1");
    assert.equal(await page.locator('head meta[name="vue-card-2"]').getAttribute("content"), "0");
    assert.equal(await page.locator('head meta[name="unrelated"]').getAttribute("content"), "keep");
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise<void>((done) => server.close(() => done()));
  }
}

test("SFC production SSR + client build: scoped CSS collected for static islands, Vue deduped, setup on both sides", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/bridge-vue-build-"));
  try {
    await mkdir(resolve(root, "src"));
    await writeFile(resolve(root, "index.html"), "<!doctype html><p>static</p>");
    await writeFile(
      resolve(root, "src/Card.vue"),
      `<script setup lang="ts">
import { defineAsyncComponent, inject, ref, Teleport, useId } from "vue";
const AsyncChild = defineAsyncComponent(() => import("./Lazy.vue"));
defineProps<{ count: number }>();
const id = useId(), local = ref(0), value = inject("value");
</script>
<template><article :id="id" class="vue-card"><b>{{ count }}</b><em>{{ value }}</em><button @click="local++">{{ local }}</button><slot /><AsyncChild /><Teleport to="head"><meta :name="'vue-card-'+count" :content="String(local)" /></Teleport></article></template>
<style scoped>.vue-card { color: rgb(12, 34, 56); }</style>`,
    );
    await writeFile(
      resolve(root, "src/Lazy.vue"),
      '<template><p class="lazy-card">async child</p></template><style scoped>.lazy-card { color: rgb(7, 8, 9); }</style>',
    );
    await writeFile(
      resolve(root, "src/Static.vue"),
      '<template><aside class="static-card">static</aside></template><style scoped>.static-card { color: rgb(65, 43, 21); }</style>',
    );
    await writeFile(
      resolve(root, "src/setup.ts"),
      'import type { App } from "vue"; export default function setup(app: App) { app.provide("value", "provided"); }',
    );
    await writeFile(
      resolve(root, "src/page.tsx"),
      'import Card from "./Card.vue"; import Static from "./Static.vue"; export function Page() { return <main><Card count={1} client="load" /><Card count={2} /><Static /></main>; }',
    );
    await writeFile(
      resolve(root, "src/entry-server.tsx"),
      `import { createApp, headTags } from "@rivetjs/router/server";
import { Provider } from "@rivetjs/runtime/server";
import { ServerData } from "@rivetjs/router/client";
import { Page } from "./page.tsx";
const entry = {
  routes: [{ id: "p", pattern: "/*rest", page: true, layouts: [] }], universal: {}, headComponents: true,
  page: (input) => () => <Provider token={ServerData} value={input}><Page /></Provider>,
  document: (input) => ({ start: '<!doctype html><html><head><meta charset="utf-8"><meta name="unrelated" content="keep">' + headTags(input.head, input) + '</head><body>', end: '</body></html>' }),
};
export const render = async (manifest) => (await createApp({ entry, manifest, csp: false })(new Request("http://x/"))).text();`,
    );
    const chunks: { file: string; modules: string[]; code: string }[] = [];
    const record: Plugin = {
      name: "record-vue",
      generateBundle(_, bundle) {
        for (const out of Object.values(bundle))
          if (out.type === "chunk") chunks.push({ file: out.fileName, modules: Object.keys(out.modules), code: out.code });
      },
    };
    const plugins = () => [kit(), rivet({ resume: { modules: ["src/page.tsx"] }, bridges: [vue({ setup: "./src/setup.ts" })] })];
    await build({ configFile: false, root, logLevel: "silent", plugins: [...plugins(), record], build: { outDir: "dist", minify: true } });
    const manifest = JSON.parse(await readFile(resolve(root, "dist/.vite/rivet-resume.json"), "utf8")) as Manifest;
    assert.deepEqual(Object.keys(manifest.islands ?? {}).sort(), ["src/Card.vue#default", "src/Static.vue#default"]);
    const runtimeDirs = new Set(
      chunks
        .flatMap((chunk) => chunk.modules)
        .filter((id) => /\/node_modules\/@vue\/runtime-core\//.test(id))
        .map((id) => id.split("/dist/")[0]),
    );
    assert.equal(runtimeDirs.size, 1);
    assert.ok(
      chunks.some((chunk) => chunk.modules.some((id) => id.endsWith("/src/setup.ts"))),
      "client setup is bundled",
    );
    await build({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: plugins(),
      build: { outDir: "dist-server", ssr: "src/entry-server.tsx", minify: true },
    });
    const { render } = await import(pathToFileURL(resolve(root, "dist-server/entry-server.js")).href);
    const html = (await render(manifest)) as string;
    assert.match(html, /<!--rivet-head:vue:i\d+--><!--teleport start anchor--><meta name="vue-card-1" content="0"/);
    assert.equal((html.match(/name="vue-card-[12]"/g) ?? []).length, 2);
    assert.match(html, /<article id="i\d+-0" class="vue-card" data-v-[\w]+>/);
    assert.equal((html.match(/<em[^>]*>provided<\/em>/g) ?? []).length, 2);
    assert.match(html, /<link[^>]+rel="stylesheet"[^>]+href="[^\"]+\.css"|<link[^>]+href="[^\"]+\.css"[^>]+rel="stylesheet"/);
    const cssLinks = [...html.matchAll(/href="([^\"]+\.css)"/g)].map((match) => match[1]!);
    const css = (await Promise.all(cssLinks.map((link) => readFile(resolve(root, "dist", link.replace(/^\//, "")), "utf8")))).join("\n");
    assert.match(css, /\.vue-card\[data-v-/);
    assert.match(css, /12,\s*34,\s*56|#0c2238/);
    assert.match(css, /\.static-card\[data-v-/);
    assert.match(css, /\.lazy-card\[data-v-/);
    await verifyBrowser(root, html);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Vue ownership accepts SFCs and include patterns, excludes win", () => {
  const entry = vue({ include: ["src/vue/**"], exclude: ["**/ignored.vue"], plugin: false });
  entry.configure?.({ root: process.cwd(), command: "build" });
  assert.equal(entry.owns(resolve("src/Card.vue")), true);
  assert.equal(entry.owns(resolve("src/vue/widget.ts")), true);
  assert.equal(entry.owns(resolve("src/ignored.vue")), false);
  assert.equal(entry.owns(resolve("src/ordinary.tsx")), false);
});
