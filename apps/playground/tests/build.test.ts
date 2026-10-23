import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import ts from "typescript";
import { createPlaygroundServer } from "../server.ts";

test("example authoring passes strict JSX TypeScript checks", () => {
  const path = new URL("../tsconfig.json", import.meta.url).pathname;
  const config = ts.readConfigFile(path, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, new URL("../", import.meta.url).pathname);
  assert.ok(
    parsed.fileNames.some((file) => file.endsWith("_layout.tsx")),
    "shared JSX source must exist",
  );
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  assert.deepEqual(
    ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    [],
  );
});
test("production build emits Tailwind CSS and excludes compiler/server code from browser scripts", async () => {
  const files = await readdir(new URL("../dist/client/assets/", import.meta.url));
  const css = (
    await Promise.all(files.filter((f) => f.endsWith(".css")).map((f) => readFile(new URL("../dist/client/assets/" + f, import.meta.url), "utf8")))
  ).join("");
  assert.match(css, /tailwindcss/);
  assert.match(css, /\.text-/);
  assert.doesNotMatch(css, /@import\s+["']tailwindcss/);
  const js = (
    await Promise.all(files.filter((f) => f.endsWith(".js")).map((f) => readFile(new URL("../dist/client/assets/" + f, import.meta.url), "utf8")))
  ).join("");
  assert.doesNotMatch(js, /createSourceFile|renderToWriter|node:http|createServerServices/);
});
test("server-rendered hero image: every variant exists in the client output", async () => {
  const files = new Set(await readdir(new URL("../dist/client/assets/", import.meta.url)));
  const app = await createPlaygroundServer({ port: 0 });
  try {
    const html = await (await fetch(app.url + "/")).text();
    assert.match(html, /<link rel="preload" as="image"[^>]+type="image\/avif" fetchpriority="high">/);
    assert.match(html, /<picture[^>]*><source type="image\/avif"[^>]+><source type="image\/webp"[^>]+><img src="\/assets\/hero-/);
    assert.match(html, /<img [^>]*width="\d+" height="\d+" alt="[^"]*" loading="eager" decoding="async" fetchpriority="high"/);
    const urls = [...html.matchAll(/(?:src|srcset|imagesrcset)="([^"]+)"/g)]
      .flatMap((m) => m[1]!.split(/,\s+/).map((p) => p.split(/\s+/)[0]!))
      .filter((u) => u.includes("/hero-"));
    assert.ok(urls.length >= 10);
    for (const url of urls) assert.ok(files.has(url.replace("/assets/", "")), `missing ${url}`);
    const image = await fetch(app.url + urls.find((u) => u.endsWith(".avif"))!);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("content-type"), "image/avif");
  } finally {
    await app.close();
  }
});
