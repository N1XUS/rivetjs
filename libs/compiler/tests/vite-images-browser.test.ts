import { test } from "vitest";
import assert from "node:assert/strict";
import { createServer as createHttp } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { createBuilder } from "vite";
import { chromium } from "playwright";
import { rivet } from "../vite.ts";

const TYPES: Record<string, string> = { ".html": "text/html", ".avif": "image/avif", ".webp": "image/webp", ".jpg": "image/jpeg", ".js": "text/javascript" };

test("Chromium picks AVIF at the width matching viewport × DPR, with zero layout shift", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/images-browser-"));
  const http = createHttp(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url!, "http://x").pathname);
      const path = pathname === "/" ? "/page.html" : pathname;
      const body = await readFile(resolve(root, "client-dist", "." + path));
      res.setHeader("Content-Type", TYPES[extname(path)] ?? "application/octet-stream");
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });
  const browser = await chromium.launch({ headless: true });
  try {
    await sharp({ create: { width: 1600, height: 900, channels: 3, background: { r: 10, g: 140, b: 90 } } }).jpeg().toFile(resolve(root, "photo.jpg"));
    await writeFile(resolve(root, "index.html"), "<!doctype html><p>client</p>");
    await writeFile(
      resolve(root, "server.tsx"),
      `import { renderToString } from "@rivetjs/runtime/server";
import { Picture } from "@rivetjs/runtime/image";
import photo from "./photo.jpg?image";
export const render = () => renderToString(() => <main><p>above</p><Picture image={photo} alt="photo" priority /><p id="below">below</p></main>);`,
    );
    await (
      await createBuilder({
        root, configFile: false, logLevel: "silent", builder: {},
        plugins: [rivet({ images: { cacheDir: ".image-cache" } })],
        environments: {
          client: { build: { outDir: "client-dist", rollupOptions: { input: resolve(root, "index.html") } } },
          ssr: { build: { outDir: "server-dist", rollupOptions: { input: resolve(root, "server.tsx") } } },
        },
      })
    ).buildApp();
    const { render } = await import(pathToFileURL(resolve(root, "server-dist/server.js")).href);
    await writeFile(
      resolve(root, "client-dist/page.html"),
      `<!doctype html><meta name="viewport" content="width=device-width"><style>body{margin:0}img{max-width:100%;height:auto}</style>${await render()}`,
    );
    await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
    const origin = `http://127.0.0.1:${(http.address() as { port: number }).port}/`;
    const check = async (deviceScaleFactor: number) => {
      const context = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor });
      const page = await context.newPage();
      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) (window as unknown as { __cls: number }).__cls += (entry as unknown as { value: number }).value;
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(origin);
      await page.waitForFunction(() => (document.querySelector("img") as HTMLImageElement).complete);
      const result = await page.evaluate(() => ({ src: (document.querySelector("img") as HTMLImageElement).currentSrc, cls: (window as unknown as { __cls: number }).__cls }));
      await context.close();
      return result;
    };
    const one = await check(1);
    assert.match(one.src, /\/assets\/photo-1024-[0-9a-f]{8}\.avif$/);
    assert.equal(one.cls, 0);
    const two = await check(2);
    assert.match(two.src, /\/assets\/photo-1600-[0-9a-f]{8}\.avif$/);
    assert.equal(two.cls, 0);
  } finally {
    await browser.close();
    http.close();
    await rm(root, { recursive: true, force: true });
  }
});
