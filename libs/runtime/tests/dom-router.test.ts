import { test } from "vitest";
import { stripTypeScriptTypes } from "node:module";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { compile } from "@rivetjs/compiler";

/** Exports of the compiled ./dom-router/fixture.tsx, served as /fixture.mjs; each scenario resolves "passed". */
type Fixture = Record<string, (host: Element) => Promise<string>>;

test("owned browser router navigates history and cancels route work", async () => {
  const source = await readFile(new URL("./dom-router/fixture.tsx", import.meta.url), "utf8");
  const compiled = compile(source, { target: "dom" });
  assert.deepEqual(compiled.diagnostics, []);
  const files: Record<string, string> = { "/fixture.mjs": compiled.code };
  for (const name of [
    "dom",
    "dom-v2",
    "dom-v2-spread",
    "dom-v2-controls",
    "dom-svg",
    "dom-adopt",
    "dom-router",
    "dom-suspense",
    "async-coordinator",
    "dom-resource",
    "resource",
    "router",
    "lazy",
    "url",
    "lazy-rows",
    "derived",
    "slot",
    "props",
    "style",
    "dev/off",
  ])
    files[`/${name}.ts`] = stripTypeScriptTypes(await readFile(new URL(`../${name}.ts`, import.meta.url), "utf8")).replaceAll('"#dev"', '"/dev/off.ts"');
  files["/reactivity.mjs"] = stripTypeScriptTypes(await readFile(new URL("../../reactivity/index.ts", import.meta.url), "utf8"));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("http://rivet.test/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      await route.fulfill({
        body: (files[path] ?? '<div id="host"></div>')
          .replaceAll("@rivetjs/runtime/router/dom", "/dom-router.ts")
          .replaceAll("@rivetjs/runtime/dom", "/dom.ts")
          .replaceAll("@rivetjs/runtime/slot", "/slot.ts")
          .replaceAll("@rivetjs/runtime/props", "/props.ts")
          .replaceAll("@rivetjs/reactivity", "/reactivity.mjs"),
        contentType: /\.(m?js|ts)$/.test(path) ? "text/javascript" : "text/html",
      });
    });
    await page.goto("http://rivet.test/");
    for (const name of ["navigation", "routes", "reentrant", "lateLazy", "holdSwap", "hashOnly", "indexFile"])
      assert.equal(
        await page.evaluate(async (name) => ((await import("/fixture.mjs" as string)) as Fixture)[name](document.querySelector("#host")!), name),
        "passed",
      );
    await page.evaluate(() => new Promise<void>((done) => setTimeout(done, 0)));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test("browser router dependency graph excludes server and compiler", async () => {
  const seen = new Set<string>();
  async function visit(url: URL): Promise<void> {
    if (seen.has(url.href)) return;
    seen.add(url.href);
    const source = await readFile(url, "utf8");
    // Type-only imports are erased: they are not part of the browser graph.
    const code = stripTypeScriptTypes(source);
    assert.doesNotMatch(code, /node\.ts|@rivetjs\/compiler|server\.ts|server-router/);
    for (const [, specifier] of code.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)) {
      if (specifier.startsWith(".")) await visit(new URL(specifier, url));
      else assert.ok(specifier === "@rivetjs/reactivity" || specifier === "#dev", specifier);
    }
  }
  await visit(new URL("../dom-router.ts", import.meta.url));
  const { build } = await import("esbuild");
  const bundle = await build({
    entryPoints: [new URL("../dom-router.ts", import.meta.url).pathname],
    bundle: true,
    platform: "browser",
    write: false,
    metafile: true,
  });
  assert.equal(
    Object.keys(bundle.metafile.inputs).some((path) => /server|compiler|node_modules/.test(path)),
    false,
  );
});

test("strict DOM route definitions infer loader data", async () => {
  const { default: ts } = await import("typescript");
  const program = ts.createProgram([new URL("./dom-router/types.tsx", import.meta.url).pathname], {
    strict: true,
    noEmit: true,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: "@rivetjs/runtime",
    allowImportingTsExtensions: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
  });
  assert.deepEqual(
    ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    [],
  );
});
