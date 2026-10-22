// EXT-A item 4 (alpha.1 report): route `head` exports (title / meta / raw CSS) reached the browser bundle. Server /
// static client builds un-export `head` (`build/head-strip.ts`), so the bundler drops it with whatever only it uses;
// CSR builds keep it (the client applies route heads there).
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { unexportHead } from "../build/head-strip.ts";
import { withNodeEnv } from "./vite-env.ts";

const repo = fileURLToPath(new URL("../../../", import.meta.url));

test("unexportHead: drops the `export` of `head` only, at the same byte length", () => {
  // Expected outputs with whitespace runs collapsed (the blanked text keeps the byte length and newlines).
  const cases: [string, string | null][] = [
    ["export const head = { title: 'a' };\nexport default 1;", " const head = { title: 'a' }; export default 1;"],
    ["export function head({ data }) {\n  return data;\n}", " function head({ data }) { return data; }"],
    ["const h = 1;\nexport { h as head };", "const h = 1; "],
    ["const h = 1, d = 2;\nexport { d as default, h as head };", "const h = 1, d = 2; export { d as default };"],
    ["const h = 1, d = 2;\nexport { h as head, d as default };", "const h = 1, d = 2; export { d as default };"],
    ["export const head = 1, other = 2;", null],
    ["export const header = 1;", null],
    ["export const head: = 1", null],
  ];
  for (const [input, output] of cases) {
    const out = unexportHead(input);
    assert.equal(out?.replace(/\s+/g, " ") ?? null, output, input);
    if (out !== null) assert.equal(out.length, input.length);
    if (out !== null) assert.equal(out.split("\n").length, input.split("\n").length);
  }
});

test("client build: route `head` exports and code only they use are gone; csr keeps them", async () => {
  mkdirSync(join(repo, ".artifacts"), { recursive: true });
  const root = mkdtempSync(join(repo, ".artifacts", "router-head-strip-"));
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ name: "head-strip", type: "module" }),
    "vite.config.ts": `import { rivetRouter } from "@rivetjs/router/vite";\nexport default { plugins: [rivetRouter({ mode: process.env.HEAD_MODE })], logLevel: "silent" };\n`,
    "src/document.ts": `export default () => ({ start: "<!doctype html><head></head><div id=app>", end: "</div>" });\n`,
    "src/routes/_layout.tsx": `export const head = { titleTemplate: "%s · head-layout-marker" };\nexport default function Layout(props: { children?: unknown }) {\n  return <main>{props.children}</main>;\n}\n`,
    "src/routes/index.tsx": `const css = ".head-raw-css-marker{color:red}";\nexport const head = { title: "head-title-marker", styles: [{ css }] };\nexport default function Home() {\n  return <a href="/post">Post</a>;\n}\n`,
    "src/routes/post.tsx": `const describe = (url: URL) => "head-function-marker " + url.pathname;\nexport function head({ url }: { url: URL }) {\n  return { meta: [{ name: "description", content: describe(url) }] };\n}\nexport default function Post() {\n  return <h1>Post</h1>;\n}\n`,
    "src/routes/own.tsx": `export const head = { title: "head-kept-marker" };\nexport default function Own() {\n  return <h1>{head.title}</h1>;\n}\n`,
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  const client = () => {
    const out = join(root, "dist/client");
    return readdirSync(out, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".js"))
      .map((e) => readFileSync(join(e.parentPath, e.name), "utf8"))
      .join("\n");
  };
  const stripped = ["head-layout-marker", "head-raw-css-marker", "head-title-marker", "head-function-marker"];
  try {
    for (const mode of ["server", "static"]) {
      process.env.HEAD_MODE = mode;
      rmSync(join(root, "dist"), { recursive: true, force: true });
      await withNodeEnv("production", () => build({ root, configFile: join(root, "vite.config.ts"), logLevel: "silent" }));
      const code = client();
      for (const marker of stripped) assert.ok(!code.includes(marker), `${mode}: ${marker} in the client build`);
      // Read by the module's own component: kept (only un-exported).
      assert.match(code, /head-kept-marker/, mode);
    }
    process.env.HEAD_MODE = "csr";
    rmSync(join(root, "dist"), { recursive: true, force: true });
    await withNodeEnv("production", () => build({ root, configFile: join(root, "vite.config.ts"), logLevel: "silent" }));
    const code = client();
    for (const marker of stripped) assert.ok(code.includes(marker), `csr: ${marker} missing from the client build`);
  } finally {
    delete process.env.HEAD_MODE;
    rmSync(root, { recursive: true, force: true });
  }
});
