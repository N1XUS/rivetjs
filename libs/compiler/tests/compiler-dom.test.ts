import "./compiler-dom/compiler.test.ts";
import { stripTypeScriptTypes } from "node:module";
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { compile } from "../index.ts";
test("actual compiled DOM fixture retains native identities and owned bindings", async () => {
  const source = await readFile(new URL("./compiler-dom/fixture.tsx", import.meta.url), "utf8");
  const result = compile(source, { target: "dom", filename: "fixture.tsx" });
  assert.deepEqual(result.diagnostics, []);
  const runtime = stripTypeScriptTypes(await readFile(new URL("../../runtime/dom.ts", import.meta.url), "utf8"));
  const reactivity = stripTypeScriptTypes(await readFile(new URL("../../reactivity/index.ts", import.meta.url), "utf8"));
  const lazy = stripTypeScriptTypes(await readFile(new URL("../../runtime/lazy.ts", import.meta.url), "utf8"));
  const routerFiles: Record<string, string> = {
    "/dom-router.ts": stripTypeScriptTypes(await readFile(new URL("../../runtime/dom-router.ts", import.meta.url), "utf8")),
    "/dom-suspense.ts": stripTypeScriptTypes(await readFile(new URL("../../runtime/dom-suspense.ts", import.meta.url), "utf8")),
    "/async-coordinator.ts": stripTypeScriptTypes(await readFile(new URL("../../runtime/async-coordinator.ts", import.meta.url), "utf8")),
    "/dom-resource.ts": stripTypeScriptTypes(await readFile(new URL("../../runtime/dom-resource.ts", import.meta.url), "utf8")),
    "/resource.ts": stripTypeScriptTypes(await readFile(new URL("../../runtime/resource.ts", import.meta.url), "utf8")),
    "/router.ts": stripTypeScriptTypes(await readFile(new URL("../../runtime/router.ts", import.meta.url), "utf8")),
    "/url.ts": stripTypeScriptTypes(await readFile(new URL("../../runtime/url.ts", import.meta.url), "utf8")),
    "/lazy-rows.ts": stripTypeScriptTypes(await readFile(new URL("../../runtime/lazy-rows.ts", import.meta.url), "utf8")),
    "/dom-v2.ts": stripTypeScriptTypes(await readFile(new URL("../../runtime/dom-v2.ts", import.meta.url), "utf8")),
    "/dom-v2-spread.ts": stripTypeScriptTypes(await readFile(new URL("../../runtime/dom-v2-spread.ts", import.meta.url), "utf8")),
    "/dom-v2-controls.ts": stripTypeScriptTypes(await readFile(new URL("../../runtime/dom-v2-controls.ts", import.meta.url), "utf8")),
    "/dom-svg.ts": stripTypeScriptTypes(await readFile(new URL("../../runtime/dom-svg.ts", import.meta.url), "utf8")),
    "/dom-adopt.ts": stripTypeScriptTypes(await readFile(new URL("../../runtime/dom-adopt.ts", import.meta.url), "utf8")),
    "/slot.ts": stripTypeScriptTypes(await readFile(new URL("../../runtime/slot.ts", import.meta.url), "utf8")),
    "/props.ts": stripTypeScriptTypes(await readFile(new URL("../../runtime/props.ts", import.meta.url), "utf8")),
    // `dom.ts` → `style.ts` (spread `style` keys) → `#dev` (production build).
    "/style.ts": stripTypeScriptTypes(await readFile(new URL("../../runtime/style.ts", import.meta.url), "utf8")).replaceAll('"#dev"', '"/dev/off.ts"'),
    "/dev/off.ts": stripTypeScriptTypes(await readFile(new URL("../../runtime/dev/off.ts", import.meta.url), "utf8")),
  };
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route("http://rivet.test/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const rewrite = (code: string) =>
        code
          .replaceAll("@rivetjs/runtime/dom", "/dom.ts")
          .replaceAll("@rivetjs/runtime/slot", "/slot.ts")
          .replaceAll("@rivetjs/runtime/props", "/props.ts")
          .replaceAll("@rivetjs/reactivity", "/reactivity.mjs");
      const body =
        routerFiles[path]?.replaceAll("@rivetjs/reactivity", "/reactivity.mjs") ??
        (path === "/fixture.mjs"
          ? rewrite(result.code)
          : path === "/dom.ts"
            ? rewrite(runtime)
            : path === "/reactivity.mjs"
              ? reactivity
              : path === "/lazy.ts"
                ? lazy
                : '<div id="host"><i>unrelated</i></div>');
      await route.fulfill({ body, contentType: /\.(m?js|ts)$/.test(path) ? "text/javascript" : "text/html" });
    });
    await page.goto("http://rivet.test/");
    assert.equal(await page.evaluate(async () => (await import("/fixture.mjs" as string)).run()), "passed");
    const ssr = compile(
      `const model=()=>"\\nmodeled";export const value=<div><textarea>{"\\nleading"}</textarea><textarea model:value={model}/><textarea>static</textarea><title>{"<&title>"}</title></div>`,
      { target: "server" },
    );
    assert.deepEqual(ssr.diagnostics, []);
    const serverURL = new URL("../../runtime/server.ts", import.meta.url).href;
    const module = await import(
      "data:text/javascript," +
        encodeURIComponent(
          ssr.code.replaceAll("@rivetjs/runtime/server", serverURL).replaceAll("@rivetjs/runtime/slot", serverURL.replace("server.ts", "slot.ts")),
        )
    );
    const { renderToString } = await import("../../runtime/server.ts");
    const html = await renderToString(module.value);
    assert.deepEqual(
      await page.evaluate((html) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        return [...doc.querySelectorAll("textarea")].map((node) => node.value);
      }, html),
      ["\nleading", "\nmodeled", "static"],
    );
  } finally {
    await browser.close();
  }
});
test("DOM modules defer document access and bundles exclude compiler/server dependencies", async () => {
  const result = compile(
    `import {mount} from '@rivetjs/runtime/dom';import {signal} from '@rivetjs/reactivity';export const App=()=>{const count=signal(0);return <section><button onClick={()=>count.update(n=>n+1)}>{count()}</button></section>};export const start=host=>mount(()=><App/>,host)`,
    { target: "dom" },
  );
  assert.deepEqual(result.diagnostics, []);
  const code = result.code
    .replaceAll("@rivetjs/runtime/dom", new URL("../../runtime/dom.ts", import.meta.url).href)
    .replaceAll("@rivetjs/runtime/slot", new URL("../../runtime/slot.ts", import.meta.url).href)
    .replaceAll("@rivetjs/runtime/props", new URL("../../runtime/props.ts", import.meta.url).href)
    .replaceAll("@rivetjs/reactivity", new URL("../../reactivity/index.ts", import.meta.url).href);
  const module = await import("data:text/javascript," + encodeURIComponent(code));
  assert.equal(typeof module.App, "function");
  assert.throws(() => module.App(), /construct DOM inside mount/i);
  const { build } = await import("esbuild");
  const bundle = await build({
    stdin: { contents: result.code, resolveDir: process.cwd(), sourcefile: "fixture.mjs" },
    bundle: true,
    platform: "browser",
    format: "esm",
    write: false,
    metafile: true,
  });
  const inputs = Object.keys(bundle.metafile.inputs).join("\n");
  assert.doesNotMatch(inputs, /typescript|entities|runtime\/server|compiler\/|node:/);
  assert.match(inputs, /runtime\/dom.ts/);
  assert.match(inputs, /reactivity\/index.ts/);
});
