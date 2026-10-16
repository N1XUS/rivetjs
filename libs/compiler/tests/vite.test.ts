import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build, createServer, type InlineConfig, type ViteDevServer } from "vite";
import { rivet } from "../vite.ts";

/** Plugin hooks may be declared as ObjectHook unions; the tests call them as plain functions. */
const hook = <T extends (...args: any[]) => any>(h: unknown) => h as T;
type Transform = (this: unknown, code: string, id: string, options?: { ssr?: boolean }) => { code: string } | null;

test("Vite transform selects targets and rejects diagnostics without handling asset imports", () => {
  const plugin = rivet();
  const transform = hook<Transform>(plugin.transform);
  const configResolved = hook<(this: unknown, config: unknown) => void>(plugin.configResolved);
  const ctx = {
    error(value: { message: string }) {
      throw Error(value.message);
    },
  };
  const source = "export default () => <p>hello</p>";
  assert.match(transform.call(ctx, source, "/app/a.tsx")!.code, /runtime\/dom/);
  assert.match(transform.call(ctx, source, "/app/a.tsx", { ssr: true })!.code, /runtime\/server/);
  configResolved.call(plugin, { build: { ssr: true } });
  assert.match(
    transform.call({ ...ctx, environment: { config: { consumer: "client" } } }, source, "/app/a.tsx")!.code,
    /runtime\/dom/,
  );
  assert.match(
    transform.call({ ...ctx, environment: { config: { consumer: "server" } } }, source, "/app/a.tsx")!.code,
    /runtime\/server/,
  );
  assert.equal(transform.call(ctx, source, "/app/a.tsx?raw"), null);
  assert.equal(transform.call(ctx, source, "/app/a.tsx?url"), null);
  assert.equal(transform.call(ctx, source, "/app/node_modules/lib/a.tsx"), null);
  assert.equal(transform.call(ctx, source, "\0virtual.tsx"), null);
  assert.throws(() => transform.call(ctx, "<p>{...props}</p>", "/app/bad.tsx"), /spread/i);
});

test("actual Vite production and dev graphs compile JSX, extract CSS and erase browser-only server imports", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-integration-"));
  let server: ViteDevServer | undefined;
  try {
    await writeFile(
      resolve(root, "index.html"),
      '<!doctype html><div id="app"></div><script type="module" src="/client.tsx"></script>',
    );
    await writeFile(resolve(root, "main.css"), ".rivet-proof { color: rgb(12, 34, 56) }");
    await writeFile(resolve(root, "lazy.css"), ".lazy-proof { font-weight: 700 }");
    await writeFile(
      resolve(root, "browser.tsx"),
      'import "./lazy.css"; window.__browserOnly = true; export default () => <strong class="lazy-proof">deferred</strong>',
    );
    await writeFile(
      resolve(root, "view.tsx"),
      'import {clientOnly} from "@rivetjs/runtime/dom"; import "./main.css"; const Browser = clientOnly(() => import("./browser.tsx"), undefined, {fallback: () => <span>fallback</span>}); export default () => <main class="rivet-proof"><h1>compiled</h1><Browser/></main>',
    );
    await writeFile(
      resolve(root, "client.tsx"),
      'import {mount} from "@rivetjs/runtime/dom"; import App from "./view.tsx"; mount(App,document.querySelector("#app"));',
    );
    await writeFile(
      resolve(root, "server.tsx"),
      'import {renderToString} from "@rivetjs/runtime/server"; import App from "./view.tsx"; export const render = () => renderToString(App);',
    );
    const common: InlineConfig = { root, configFile: false, logLevel: "silent", plugins: [rivet()] };
    await build({ ...common, build: { outDir: "client-dist", minify: true, manifest: true } });
    const names = await readdir(resolve(root, "client-dist/assets"));
    const css = await Promise.all(
      names.filter((n) => n.endsWith(".css")).map((n) => readFile(resolve(root, "client-dist/assets", n), "utf8")),
    );
    assert.equal(css.length, 2);
    assert.match(css.join(""), /rivet-proof/);
    assert.match(css.join(""), /lazy-proof/);
    const js = (
      await Promise.all(
        names.filter((n) => n.endsWith(".js")).map((n) => readFile(resolve(root, "client-dist/assets", n), "utf8")),
      )
    ).join("");
    assert.match(js, /__browserOnly/);
    assert.doesNotMatch(js, /typescript|createSourceFile|renderToWriter|node:fs/);
    // The client entry chunk (minified) starts with V8's eager-compile hint; the lazily imported chunk stays lazy.
    const clientManifest = JSON.parse(await readFile(resolve(root, "client-dist/.vite/manifest.json"), "utf8"));
    const chunkCode = (key: string) => readFile(resolve(root, "client-dist", clientManifest[key].file), "utf8");
    assert.ok((await chunkCode("index.html")).startsWith("//# allFunctionsCalledOnLoad\n"));
    assert.ok(!(await chunkCode("browser.tsx")).includes("allFunctionsCalledOnLoad"));
    await build({ ...common, build: { ssr: resolve(root, "server.tsx"), outDir: "server-dist", minify: true } });
    const serverCode = await readFile(resolve(root, "server-dist/server.js"), "utf8");
    assert.doesNotMatch(serverCode, /__browserOnly|lazy-proof|browser\.tsx|window\.|allFunctionsCalledOnLoad/);
    const mod = await import(pathToFileURL(resolve(root, "server-dist/server.js")).href);
    assert.equal(await mod.render(), '<main class="rivet-proof"><h1>compiled</h1><span>fallback</span></main>');
    server = await createServer({ ...common, server: { middlewareMode: true }, appType: "custom" });
    const transformed = await server.transformRequest("/view.tsx");
    assert.match(transformed!.code, /runtime\/dom/);
    const ssr = await server.ssrLoadModule("/server.tsx");
    assert.equal(await ssr.render(), '<main class="rivet-proof"><h1>compiled</h1><span>fallback</span></main>');
  } finally {
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("source maps: dev always, builds with build.sourcemap only", () => {
  type Mapped = (this: unknown, code: string, id: string) => { code: string; map: string | null } | null;
  const ctx = { error: (value: { message: string }) => { throw Error(value.message); } };
  const source = "export const answer = 42;\nexport default () => <p>{answer}</p>;\n";
  const run = (config: unknown) => {
    const plugin = rivet();
    hook<(this: unknown, config: unknown) => void>(plugin.configResolved).call(plugin, config);
    return hook<Mapped>(plugin.transform).call(ctx, source, "/app/a.tsx")!;
  };
  const dev = run({ command: "serve", build: {} });
  assert.equal(JSON.parse(dev.map!).sources[0], "/app/a.tsx");
  assert.equal(run({ command: "build", build: {} }).map, null);
  const mapped = run({ command: "build", build: { sourcemap: true } });
  assert.ok(mapped.map);
  assert.equal(mapped.code, run({ command: "build", build: {} }).code);
});
