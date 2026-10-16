import { test } from "vitest";
import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { renderToString } from "../server.ts";
import { Picture, ImagePreload, pictureHtml, preloadHtml, preloadLink, cdn, urlTemplate, type ImageDescriptor } from "../image.ts";

const image: ImageDescriptor = {
  src: "/a-400.jpg", width: 400, height: 200, layout: "constrained", sizes: "(min-width: 400px) 400px, 100vw",
  sources: [
    { type: "image/avif", srcset: "/a-400.avif 400w, /a-800.avif 800w" },
    { type: "image/jpeg", srcset: "/a-400.jpg 400w, /a-800.jpg 800w" },
  ],
};

test("server Picture/ImagePreload render the shared markup", async () => {
  assert.equal(await renderToString(() => Picture({ image, alt: "a" })), pictureHtml({ image, alt: "a" }));
  assert.equal(await renderToString(() => ImagePreload({ image, media: "(min-width: 1px)" })), preloadHtml(preloadLink(image, { media: "(min-width: 1px)" })));
  const remote = cdn("p.jpg", { cdn: urlTemplate("https://c.test/{src}?w={width}", { autoFormat: true }), width: 100, height: 100 });
  assert.match(await renderToString(() => Picture({ image: remote, alt: "" })), /^<img src="https:\/\/c\.test\/p\.jpg\?w=100"/);
});

test("DOM Picture matches server markup in Chromium", async () => {
  const runtimeDir = new URL("../", import.meta.url);
  const reactivity = stripTypeScriptTypes(await readFile(new URL("../../reactivity/index.ts", import.meta.url), "utf8"));
  const fixture = stripTypeScriptTypes(await readFile(new URL("./image/dom-fixture.ts", import.meta.url), "utf8"))
    .replaceAll('"@rivetjs/runtime/dom"', '"/dom.ts"')
    .replaceAll('"@rivetjs/runtime/image/dom"', '"/image-dom.ts"');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route("http://rivet.test/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body = "<!doctype html><body></body>";
      if (path === "/reactivity.mjs") body = reactivity;
      else if (path === "/fixture.mjs") body = fixture;
      else if (/^\/(?:dev\/)?[\w-]+\.ts$/.test(path))
        body = stripTypeScriptTypes(await readFile(new URL("." + path, runtimeDir), "utf8"))
          .replaceAll('"@rivetjs/reactivity"', '"/reactivity.mjs"')
          // Production `#dev` (browsers have no package `imports` resolution).
          .replaceAll('"#dev"', '"/dev/off.ts"');
      await route.fulfill({ body, contentType: /\.(m?js|ts)$/.test(path) ? "text/javascript" : "text/html" });
    });
    await page.goto("http://rivet.test/");
    const result = await page.evaluate(async (img) => ((await import("/fixture.mjs" as string)) as { run(i: unknown): string }).run(img), image);
    assert.equal(result, "passed");
  } finally {
    await browser.close();
  }
});
