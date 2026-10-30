import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build, type Plugin } from "vite";
import { rivet } from "@rivetjs/compiler/vite";
import { svelte } from "../vite.ts";

async function verifyProduction(root: string, html: string): Promise<void> {
  const { preview } = await import("vite");
  const { chromium } = await import("playwright");
  await writeFile(resolve(root, "dist/index.html"), "<!doctype html><html><head></head><body>" + html + "</body></html>");
  const server = await preview({ configFile: false, root, logLevel: "silent", preview: { host: "127.0.0.1", port: 0 } });
  const browser = await chromium.launch({ headless: true });
  try {
    const origin = server.resolvedUrls!.local[0]!;
    const context = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await context.newPage();
    await staticPage.goto(origin);
    assert.deepEqual(await staticPage.locator("button.counter").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).color)), [
      "rgb(255, 0, 0)",
      "rgb(255, 0, 0)",
    ]);
    assert.equal(await staticPage.locator("aside").evaluate((node) => getComputedStyle(node).color), "rgb(65, 43, 21)");
    await context.close();
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin, { waitUntil: "networkidle" });
    await page.locator("button.counter").first().click();
    await page.waitForFunction(() => document.querySelector("button.counter")?.textContent === "2:1");
    const slot = await page.locator(".rivet-slot-button").elementHandle();
    await page.locator(".rivet-slot-button").click();
    await page.waitForFunction(() => document.querySelector("button.counter")?.textContent === "3:1");
    assert.equal(await page.locator(".rivet-slot-button").textContent(), "1");
    assert.ok(await page.evaluate((node) => node === document.querySelector(".rivet-slot-button"), slot));
    assert.equal(await page.locator("button.counter").last().textContent(), "3:0");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise<void>((done) => server.httpServer.close(() => done()));
  }
}

test("SFC and rune production SSR/client builds collect scoped CSS for static islands", async () => {
  const root = await mkdtemp(resolve("libs/bridge-svelte/tests/.build-"));
  try {
    await mkdir(resolve(root, "src"));
    await writeFile(resolve(root, "index.html"), "<!doctype html><p>static</p>");
    await writeFile(resolve(root, "src/state.svelte.ts"), "export const model = $state({ initial: 1 });");
    await writeFile(
      resolve(root, "src/Counter.svelte"),
      `<script>import { model } from './state.svelte.ts'; let { count = model.initial, children } = $props(); let local = $state(0);</script><button class="counter" onclick={() => local++}>{count}:{local}</button>{@render children?.()}<style>button { color: red; }</style>`,
    );
    await writeFile(
      resolve(root, "src/page.tsx"),
      'import { signal } from "@rivetjs/reactivity"; import Counter from "./Counter.svelte"; import Static from "./Static.svelte"; export function Page() { const hits = signal(0); return <main><Counter client="load" count={hits() + 2}><button class="rivet-slot-button" onClick={() => hits.set(hits() + 1)}>{hits()}</button></Counter><Counter count={3} /><Static /></main>; }',
    );
    await writeFile(resolve(root, "src/Static.svelte"), '<aside class="static-card">static</aside><style>.static-card { color: rgb(65, 43, 21); }</style>');
    await writeFile(
      resolve(root, "src/entry-server.tsx"),
      'import { resumableToString } from "@rivetjs/runtime/server-resume"; import { Page } from "./page.tsx"; export const render = (manifest: never) => resumableToString(() => <Page />, { manifest });',
    );
    const plugins = () => [rivet({ resume: { modules: ["src/page.tsx"] }, bridges: [svelte({ plugin: { configFile: false } })] })];
    const chunks: { file: string; modules: string[]; code: string; css: string[] }[] = [];
    const record: Plugin = {
      name: "record-svelte-chunks",
      generateBundle(_, bundle) {
        for (const out of Object.values(bundle))
          if (out.type === "chunk")
            chunks.push({ file: out.fileName, modules: Object.keys(out.modules), code: out.code, css: [...(out.viteMetadata?.importedCss ?? [])] });
      },
    };
    await build({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: [...plugins(), record],
      build: { outDir: "dist", minify: false },
    });
    const manifest = JSON.parse(await readFile(resolve(root, "dist/.vite/rivet-resume.json"), "utf8"));
    assert.deepEqual(Object.keys(manifest.islands ?? {}).sort(), ["src/Counter.svelte#default", "src/Static.svelte#default"]);
    const modules = chunks.flatMap((chunk) => chunk.modules);
    assert.ok(modules.some((id) => id.endsWith("/state.svelte.ts")));
    const runtimeDirs = new Set(modules.map((id) => id.match(/^(.*\/node_modules\/svelte)\//)?.[1]).filter(Boolean));
    assert.equal(runtimeDirs.size, 1);
    assert.ok(chunks.some((chunk) => chunk.modules.some((id) => id.endsWith("/props.svelte.ts"))));
    assert.ok(!chunks.some((chunk) => chunk.code.includes("$state(")), "runes must be compiled");
    const island = manifest.islands["src/Counter.svelte#default"] as string;
    const closure = [island, ...(manifest.deps?.[island] ?? [])] as string[];
    const css = chunks.filter((chunk) => closure.some((file) => file.endsWith(chunk.file))).flatMap((chunk) => chunk.css);
    assert.ok(css.length > 0, "scoped CSS must be attached to a chunk in the island dependency closure");
    const sheet = await readFile(resolve(root, "dist", css[0]!), "utf8");
    assert.match(sheet, /button\.svelte-/);
    assert.doesNotMatch(chunks.map((chunk) => chunk.code).join("\n"), /append_styles/);
    await build({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: plugins(),
      build: { outDir: "dist-server", ssr: "src/entry-server.tsx", minify: false },
    });
    const { render } = await import(pathToFileURL(resolve(root, "dist-server/entry-server.js")).href);
    const html = (await render(manifest)) as string;
    const links = [...html.matchAll(/href="([^\"]+\.css)"/g)].map((match) => match[1]!);
    assert.ok(links.length > 0, "SSR must link scoped CSS before static island hydration");
    const styles = (await Promise.all(links.map((file) => readFile(resolve(root, "dist", file.replace(/^\//, "")), "utf8")))).join("\n");
    assert.match(styles, /button\.svelte-/);
    assert.match(styles, /\.static-card\.svelte-/);
    await verifyProduction(root, html);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("published package hydrates production native head and compiles props.svelte.js under node_modules", async () => {
  const { buildPackage } = await import("../../../scripts/package/build.ts");
  const { preview } = await import("vite");
  const { chromium } = await import("playwright");
  const root = await mkdtemp(resolve("libs/bridge-svelte/tests/.package-build-"));
  let previewServer: Awaited<ReturnType<typeof preview>> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await writeFile(resolve(root, "package.json"), JSON.stringify({ name: "svelte-package-consumer", private: true, type: "module" }));
    const pkg = resolve(root, "node_modules/@rivetjs/bridge-svelte");
    const packed = buildPackage("libs/bridge-svelte", pkg, { typecheck: false });
    assert.deepEqual(packed.warnings, []);
    assert.ok(
      (await readFile(resolve(pkg, "props.svelte.js"), "utf8")).includes("$state("),
      "package intentionally preserves rune source for the consumer compiler",
    );
    await mkdir(resolve(root, "src"));
    const filename = resolve(root, "src/Counter.svelte");
    const componentSource =
      '<script>let { count, label = "fallback" } = $props(); let local = $state(0);</script><svelte:head><title>{label}</title><meta name="svelte-package-head" content={count}/><link rel="canonical" href="https://svelte.example/"/></svelte:head><article><b>{count}</b><em>{label}</em><button onclick={() => local++}>{local}</button></article>';
    await writeFile(filename, componentSource);
    const { compile } = await import("svelte/compiler");
    const serverFile = resolve(root, "src/Counter.server.mjs");
    await writeFile(serverFile, compile(componentSource, { filename, generate: "server", css: "external" }).js.code);
    const { default: ServerCounter } = await import(pathToFileURL(serverFile).href);
    const { adapter: serverAdapter } = await import(pathToFileURL(resolve(pkg, "server.js")).href);
    const rendered = await serverAdapter.render(
      ServerCounter,
      { count: 1, label: "initial" },
      {},
      { id: "i0", nonce: undefined, signal: new AbortController().signal, slot: (name: string) => ({ name, html: "" }) },
    );
    assert.equal(typeof rendered, "object");
    const { headTags, rankMerge } = await import("../../router/shared/head.ts");
    const head = headTags(rankMerge([{ level: 0, phase: 1, seq: 0, head: rendered.head }]));
    assert.ok(head.includes("<!--rivet-head:svelte:i0-->"));
    await writeFile(
      resolve(root, "index.html"),
      `<!doctype html><html><head>${head}</head><body><button id="update">update</button><button id="dispose">dispose</button><div id="island">${rendered.html}</div><script>window.__svelteHeadSSR=document.querySelector('meta[name="svelte-package-head"]')</script><script type="module" src="/src/main.ts"></script></body></html>`,
    );
    await writeFile(
      resolve(root, "src/main.ts"),
      `import { adapter } from '@rivetjs/bridge-svelte/client'; import Counter from './Counter.svelte'; const handle = await adapter.hydrate(document.querySelector('#island'), Counter, {count:1,label:'initial'}, {}, {id:'i0'}); document.querySelector('#update').onclick = () => adapter.update(handle, {count:3}); document.querySelector('#dispose').onclick = () => adapter.unmount(handle);`,
    );
    const modules: string[] = [],
      code: string[] = [];
    const record: Plugin = {
      name: "record-packaged-svelte",
      generateBundle(_, bundle) {
        for (const out of Object.values(bundle))
          if (out.type === "chunk") {
            modules.push(...Object.keys(out.modules));
            code.push(out.code);
          }
      },
    };
    await build({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: [...svelte({ plugin: { configFile: false } }).plugins!(), record],
      build: { outDir: "dist", minify: false },
    });
    assert.ok(
      modules.some((id) => id.endsWith("/node_modules/@rivetjs/bridge-svelte/props.svelte.js")),
      "consumer must compile the emitted package rather than workspace source",
    );
    assert.ok(
      code.every((chunk) => !chunk.includes("$state(")),
      "no uncompiled runes reach the browser",
    );
    previewServer = await preview({ configFile: false, root, logLevel: "silent", preview: { host: "127.0.0.1", port: 0 } });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(previewServer.resolvedUrls!.local[0]!);
    await page.locator("article button").click();
    assert.equal(await page.locator('meta[name="svelte-package-head"]').count(), 1);
    assert.equal(await page.locator('link[rel="canonical"][href="https://svelte.example/"]').count(), 1);
    assert.equal(await page.title(), "initial");
    assert.ok(
      await page.evaluate(
        () => (window as Window & { __svelteHeadSSR?: Element }).__svelteHeadSSR === document.querySelector('meta[name="svelte-package-head"]'),
      ),
    );
    await page.waitForFunction(() => document.querySelector("article button")?.textContent === "1");
    await page.locator("#update").click();
    await page.waitForFunction(() => document.querySelector("article b")?.textContent === "3");
    assert.equal(await page.locator("article em").textContent(), "fallback");
    assert.equal(await page.title(), "fallback");
    assert.equal(await page.locator('meta[name="svelte-package-head"]').getAttribute("content"), "3");
    assert.ok(
      await page.evaluate(
        () => (window as Window & { __svelteHeadSSR?: Element }).__svelteHeadSSR === document.querySelector('meta[name="svelte-package-head"]'),
      ),
    );
    assert.equal(await page.locator("article button").textContent(), "1");
    await page.locator("#dispose").click();
    await page.waitForFunction(() => document.querySelector("article") === null);
    assert.equal(await page.locator('meta[name="svelte-package-head"]').count(), 0);
    assert.equal(await page.locator('link[rel="canonical"][href="https://svelte.example/"]').count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    if (previewServer) await new Promise<void>((done) => previewServer!.httpServer.close(() => done()));
    await rm(root, { recursive: true, force: true });
  }
});
