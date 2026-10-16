import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { build, createBuilder, createLogger, createServer, type InlineConfig } from "vite";
import { rivet } from "../vite.ts";

async function project() {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-images-"));
  await sharp({ create: { width: 1600, height: 900, channels: 3, background: { r: 30, g: 120, b: 200 } } }).jpeg().toFile(resolve(root, "photo.jpg"));
  await sharp({ create: { width: 200, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.3 } } }).png().toFile(resolve(root, "logo.png"));
  await sharp({ create: { width: 800, height: 400, channels: 3, background: "#123456" } }).jpeg().toFile(resolve(root, "server-only.jpg"));
  await writeFile(resolve(root, "icon.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"/>');
  await writeFile(
    resolve(root, "view.tsx"),
    `import { Picture, ImagePreload } from "@rivetjs/runtime/image";
import photo from "./photo.jpg?image";
import logo from "./logo.png?layout=fixed&width=100&image";
import Icon from "./icon.svg?jsx";
export default () => <main><ImagePreload image={photo}/><Picture image={photo} alt="photo" priority/><Picture image={logo} alt=""/><Icon alt="icon"/></main>;`,
  );
  await writeFile(resolve(root, "client.tsx"), 'import { mount } from "@rivetjs/runtime/dom"; import App from "./view.tsx"; mount(App, document.querySelector("#app")!);');
  await writeFile(
    resolve(root, "server.tsx"),
    `import { renderToString } from "@rivetjs/runtime/server";
import { Picture } from "@rivetjs/runtime/image";
import App from "./view.tsx";
import only from "./server-only.jpg?image";
export const render = () => renderToString(() => [App(), Picture({ image: only, alt: "server" })]);`,
  );
  await writeFile(resolve(root, "index.html"), '<!doctype html><div id="app"></div><script type="module" src="/client.tsx"></script>');
  return root;
}
const urls = (html: string) => [...html.matchAll(/(?:src|srcset|imagesrcset)="([^"]+)"/g)].flatMap((m) => m[1]!.split(/,\s+/).map((part) => part.split(/\s+/)[0]!));
const appConfig = (root: string, extra: Partial<InlineConfig> = {}): InlineConfig => ({
  root,
  configFile: false,
  logLevel: "silent",
  plugins: [rivet({ images: { cacheDir: ".image-cache" } })],
  builder: {},
  environments: {
    client: { build: { outDir: "client-dist", rollupOptions: { input: resolve(root, "index.html") } } },
    ssr: { build: { outDir: "server-dist", rollupOptions: { input: resolve(root, "server.tsx") } } },
  },
  ...extra,
});

test("app build: every URL in SSR HTML exists in client output, incl. server-only images", async () => {
  const root = await project();
  try {
    await (await createBuilder(appConfig(root))).buildApp();
    const assets = new Set((await readdir(resolve(root, "client-dist/assets"))).map((n) => "/assets/" + n));
    const { render } = await import(pathToFileURL(resolve(root, "server-dist/server.js")).href);
    const html: string = await render();
    assert.match(html, /^<main><link rel="preload" as="image" href="\/assets\/photo-1600-[0-9a-f]{8}\.jpg" imagesrcset="[^"]+\.avif 640w/);
    assert.match(html, /<picture><source type="image\/avif"/);
    assert.match(html, /<img src="\/assets\/logo-100-[0-9a-f]{8}\.png" srcset="[^"]+ 1x, [^"]+ 2x" width="100" height="50" alt=""/);
    assert.match(html, /<img src="\/assets\/icon-24-[0-9a-f]{8}\.svg"/);
    assert.match(html, /alt="server"/);
    const referenced = urls(html);
    assert.ok(referenced.length > 20);
    for (const url of referenced) assert.ok(assets.has(url), `missing ${url}`);
    assert.ok([...assets].some((a) => /server-only-800-.*\.avif$/.test(a)), "server-only image emitted by client build");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rebuild hits the encode cache; separate builds warn about server-only images", async () => {
  const root = await project();
  try {
    await (await createBuilder(appConfig(root))).buildApp();
    const cached = (await readdir(resolve(root, ".image-cache"))).length;
    await (await createBuilder(appConfig(root))).buildApp();
    assert.equal((await readdir(resolve(root, ".image-cache"))).length, cached);
    const warnings: string[] = [];
    const logger = createLogger("warn");
    logger.warn = (msg) => void warnings.push(msg);
    await build({ root, configFile: false, customLogger: logger, plugins: [rivet({ images: { cacheDir: ".image-cache" } })], build: { ssr: resolve(root, "server.tsx"), outDir: "server-only-dist" } });
    assert.ok(warnings.some((w) => /image variants referenced from server code may be missing from the client build/.test(w)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zero-cost: a client chunk importing but not using ?image / ?jsx descriptors ships none of them", async () => {
  const root = await project();
  try {
    await writeFile(
      resolve(root, "client.tsx"),
      'import photo from "./photo.jpg?image"; import Logo from "./logo.png?jsx"; const unused = [photo, Logo]; document.title = "used";',
    );
    await build({ root, configFile: false, logLevel: "silent", plugins: [rivet({ images: { cacheDir: ".image-cache" } })], build: { outDir: "tree-dist" } });
    const dir = resolve(root, "tree-dist/assets");
    const code = (await Promise.all((await readdir(dir)).filter((n) => n.endsWith(".js")).map((n) => readFile(resolve(dir, n), "utf8")))).join("\n");
    assert.match(code, /document\.title\s*=\s*["`]used["`]/);
    assert.doesNotMatch(code, /\/assets\/(photo|logo)-|rivet\.image|Object\.freeze/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("bad directive fails the build with the module id", async () => {
  const root = await project();
  try {
    await writeFile(resolve(root, "server.tsx"), 'import bad from "./photo.jpg?bogus=1&image"; export const render = () => bad;');
    await assert.rejects(
      build({ root, configFile: false, logLevel: "silent", plugins: [rivet({ images: true })], build: { ssr: resolve(root, "server.tsx"), outDir: "x" } }),
      /unknown image directive "bogus"/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("dev: descriptor points at middleware; planned keys served with ETag, others 404; browser gets DOM entry", async () => {
  const root = await project();
  const server = await createServer({ root, configFile: false, logLevel: "silent", plugins: [rivet({ images: { cacheDir: ".image-cache" } })], server: { port: 0, host: "127.0.0.1" } });
  try {
    await server.listen();
    const port = (server.httpServer!.address() as { port: number }).port;
    const origin = `http://127.0.0.1:${port}`;
    const module = await (await fetch(`${origin}/photo.jpg?image&import`)).text();
    const url = /(\/@rivet\/image\/[0-9a-f]{64}\.avif) 640w/.exec(module)?.[1];
    assert.ok(url, module);
    const image = await fetch(origin + url);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("content-type"), "image/avif");
    assert.equal(image.headers.get("cache-control"), "no-cache");
    const etag = image.headers.get("etag")!;
    assert.equal((await fetch(origin + url, { headers: { "if-none-match": etag } })).status, 304);
    assert.equal((await fetch(`${origin}/@rivet/image/${"0".repeat(64)}.avif`)).status, 404);
    const view = await server.transformRequest("/view.tsx");
    assert.ok(view);
    const resolvedImage = await server.environments.client.pluginContainer.resolveId("@rivetjs/runtime/image", resolve(root, "view.tsx"));
    assert.match(resolvedImage!.id, /image-dom\.ts$/);
    // Descriptor modules are deep-frozen and branded: the runtime caches their markup (pictureHtml).
    const { default: photo } = (await server.ssrLoadModule("/photo.jpg?image")) as { default: Record<string | symbol, unknown> & { sources: object[] } };
    assert.equal(photo[Symbol.for("rivet.image")], true);
    assert.ok(Object.isFrozen(photo) && Object.isFrozen(photo.sources) && photo.sources.every((source) => Object.isFrozen(source)));
    const ssr = await server.ssrLoadModule("/server.tsx");
    assert.match(await ssr.render(), /\/@rivet\/image\/[0-9a-f]{64}\.avif 640w/);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("rivet() without images still returns one plugin", () => {
  assert.equal(Array.isArray(rivet()), false);
  const plugins = rivet({ images: true });
  assert.ok(Array.isArray(plugins));
  assert.deepEqual(plugins.map((p) => p.name), ["vite-plugin-rivet", "vite-plugin-rivet-images"]);
});

test("ambient image types check in strict TSX", async () => {
  const { default: ts } = await import("typescript");
  await mkdir(".artifacts", { recursive: true });
  const dir = await mkdtemp(resolve(".artifacts/image-types-"));
  try {
    const file = resolve(dir, "a.tsx");
    await writeFile(
      file,
      `/// <reference types="@rivetjs/compiler/images/client" />
import { Picture } from "@rivetjs/runtime/image";
import hero from "./h.jpg?layout=fixed&width=10&image";
import Logo from "./l.png?jsx";
const w: number = hero.width;
export const A = () => <div><Picture image={hero} alt="" /><Logo alt="x" sizes={{ md: "50vw" }} /></div>;
// @ts-expect-error alt is required
export const B = () => <Logo />;`,
    );
    const program = ts.createProgram([file], {
      strict: true, noEmit: true, jsx: ts.JsxEmit.Preserve, jsxImportSource: "@rivetjs/runtime",
      module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, target: ts.ScriptTarget.ES2022,
      allowImportingTsExtensions: true, types: [],
    });
    assert.deepEqual(ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
