// SVG through the Vite image plugin: `?image` / `?jsx` emit svgo-optimised hashed assets with intrinsic
// width / height; `?svg` compiles to an inline component per environment (build + dev); types.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createBuilder, createServer, type InlineConfig } from "vite";
import { rivet } from "../vite.ts";

const LOGO = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40" onload="alert(1)">
  <!-- editor comment -->
  <script>alert(2)</script>
  <defs><linearGradient id="g"><stop offset="0" stop-color="#123456"/></linearGradient></defs>
  <rect x="0" y="0" width="10.000001" height="10" fill="#ff0000"/>
  <path d="M 10 10 L 20 20 L 30 30" stroke="url(#g)"/>
</svg>
`;
async function project() {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-images-svg-"));
  await writeFile(resolve(root, "logo.svg"), LOGO);
  await writeFile(
    resolve(root, "view.tsx"),
    `import { Picture } from "@rivetjs/runtime/image";
import logo from "./logo.svg?image";
import LogoImg from "./logo.svg?jsx";
import Logo from "./logo.svg?currentColor&svg";
export default () => <main><Picture image={logo} alt="logo" /><LogoImg alt="jsx" /><Logo class="inline" size={24} /></main>;`,
  );
  await writeFile(
    resolve(root, "client.tsx"),
    'import { mount } from "@rivetjs/runtime/dom"; import App from "./view.tsx"; mount(App, document.querySelector("#app")!);',
  );
  await writeFile(
    resolve(root, "server.tsx"),
    'import { renderToString } from "@rivetjs/runtime/server"; import App from "./view.tsx"; export const render = () => renderToString(() => App());',
  );
  await writeFile(resolve(root, "index.html"), '<!doctype html><div id="app"></div><script type="module" src="/client.tsx"></script>');
  return root;
}
const appConfig = (root: string): InlineConfig => ({
  root,
  configFile: false,
  logLevel: "silent",
  plugins: [rivet({ images: { cacheDir: ".image-cache" } })],
  builder: {},
  environments: {
    client: { build: { outDir: "client-dist", rollupOptions: { input: resolve(root, "index.html") } } },
    ssr: { build: { outDir: "server-dist", rollupOptions: { input: resolve(root, "server.tsx") } } },
  },
});

test("app build: ?image / ?jsx SVG = optimised hashed asset with intrinsic size; ?svg = inline static template", async () => {
  const root = await project();
  try {
    await (await createBuilder(appConfig(root))).buildApp();
    const files = await readdir(resolve(root, "client-dist/assets"));
    const svg = files.filter((name) => name.endsWith(".svg"));
    assert.equal(svg.length, 1, files.join(", "));
    assert.match(svg[0]!, /^logo-120-[0-9a-f]{8}\.svg$/);
    const asset = await readFile(resolve(root, "client-dist/assets", svg[0]!), "utf8");
    assert.ok(asset.length < LOGO.length * 0.8, asset);
    assert.doesNotMatch(asset, /<script|onload|<!--|<\?xml/);
    assert.match(asset, /viewBox="0 0 120 40"/);
    assert.match(asset, /id="g"/);
    const { render } = await import(pathToFileURL(resolve(root, "server-dist/server.js")).href);
    const html: string = await render();
    const img = `<img src="/assets/${svg[0]}" width="120" height="40"`;
    assert.ok(html.includes(img + ' alt="logo"'), html);
    assert.ok(html.includes(img + ' alt="jsx"'), html);
    assert.match(
      html,
      /<svg viewBox="0 0 120 40" fill="currentColor" class="inline" width="24" height="24" aria-hidden="true"><defs><linearGradient id="logo-[0-9a-f]{5}_g">/,
    );
    assert.match(html, /<path fill="currentColor" d="M0 0h10v10H0z"><\/path>/);
    assert.doesNotMatch(html, /script|onload/);
    // Client: the inline component is a DOM v2 template (static markup cloned, one spread).
    const js = (await Promise.all(files.filter((f) => f.endsWith(".js")).map((f) => readFile(resolve(root, "client-dist/assets", f), "utf8")))).join("\n");
    assert.match(js, /<svg><!--?-->?<defs><linearGradient id=\\?"logo-[0-9a-f]{5}_g\\?"|<svg><!><defs>/);
    assert.doesNotMatch(js, /alert\(/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("dev: ?svg compiles per environment (DOM v2 client, server SSR); ?image SVG served optimised by the middleware", async () => {
  const root = await project();
  const server = await createServer({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [rivet({ images: { cacheDir: ".image-cache" } })],
    server: { port: 0, host: "127.0.0.1" },
  });
  try {
    await server.listen();
    const origin = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}`;
    const client = await server.transformRequest("/logo.svg?currentColor&svg");
    assert.ok(client);
    assert.match(client.code, /__rivet_tpl\("<svg>/);
    assert.match(client.code, /@rivetjs\/runtime\/dom|runtime\/(dev\/)?dom\.ts/);
    const module = await (await fetch(`${origin}/logo.svg?image&import`)).text();
    const url = /"src":"(\/@rivet\/image\/[0-9a-f]{64}\.svg)"/.exec(module)?.[1];
    assert.ok(url, module);
    const response = await fetch(origin + url);
    assert.equal(response.headers.get("content-type"), "image/svg+xml");
    assert.doesNotMatch(await response.text(), /<script/);
    const ssr = await server.ssrLoadModule("/server.tsx");
    assert.match(await ssr.render(), /<svg viewBox="0 0 120 40" fill="currentColor" class="inline" width="24" height="24"/);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("ambient ?svg types: svg attributes + size / title on the component", async () => {
  const { default: ts } = await import("typescript");
  await mkdir(".artifacts", { recursive: true });
  const dir = await mkdtemp(resolve(".artifacts/svg-types-"));
  try {
    const file = resolve(dir, "a.tsx");
    await writeFile(
      file,
      `/// <reference types="@rivetjs/compiler/images/client" />
import Logo from "./l.svg?svg";
import Mono from "./m.svg?currentColor&svg";
export const A = () => <div><Logo class="x" size={24} title="Brand" style={{ color: "red" }} aria-label="b" /><Mono /></div>;
// @ts-expect-error unknown prop
export const B = () => <Logo bogus={1} />;`,
    );
    const program = ts.createProgram([file], {
      strict: true,
      noEmit: true,
      jsx: ts.JsxEmit.Preserve,
      jsxImportSource: "@rivetjs/runtime",
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
      allowImportingTsExtensions: true,
      types: [],
    });
    assert.deepEqual(
      ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
      [],
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
