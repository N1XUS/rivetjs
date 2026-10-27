import { test } from "vitest";
import { stripTypeScriptTypes } from "node:module";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { compile } from "@rivetjs/compiler";

type Scenario = "render" | "plain" | "update" | "async" | "nested" | "unhandled";

test("compiled ErrorBoundary catches render, effect and Async failures in the browser and resets", async () => {
  const source = await readFile(new URL("./dom-boundary/fixture.tsx", import.meta.url), "utf8");
  const result = compile(source, { target: "dom" });
  assert.deepEqual(result.diagnostics, []);
  const files: Record<string, string> = {
    "/fixture.mjs": result.code,
    "/dom-router.ts": stripTypeScriptTypes(await readFile(new URL("../dom-router.ts", import.meta.url), "utf8")),
    "/dom-suspense.ts": stripTypeScriptTypes(await readFile(new URL("../dom-suspense.ts", import.meta.url), "utf8")),
    "/dom-async.ts": stripTypeScriptTypes(await readFile(new URL("../dom-async.ts", import.meta.url), "utf8")),
    "/async-coordinator.ts": stripTypeScriptTypes(await readFile(new URL("../async-coordinator.ts", import.meta.url), "utf8")),
    "/dom-resource.ts": stripTypeScriptTypes(await readFile(new URL("../dom-resource.ts", import.meta.url), "utf8")),
    "/resource.ts": stripTypeScriptTypes(await readFile(new URL("../resource.ts", import.meta.url), "utf8")),
    "/router.ts": stripTypeScriptTypes(await readFile(new URL("../router.ts", import.meta.url), "utf8")),
    "/dom.ts": stripTypeScriptTypes(await readFile(new URL("../dom.ts", import.meta.url), "utf8")),
    "/reactivity.mjs": stripTypeScriptTypes(await readFile(new URL("../../reactivity/index.ts", import.meta.url), "utf8")),
    "/lazy.ts": stripTypeScriptTypes(await readFile(new URL("../lazy.ts", import.meta.url), "utf8")),
    "/url.ts": stripTypeScriptTypes(await readFile(new URL("../url.ts", import.meta.url), "utf8")),
    "/dom-base.ts": stripTypeScriptTypes(await readFile(new URL("../dom-base.ts", import.meta.url), "utf8")),
    "/dom-attr.ts": stripTypeScriptTypes(await readFile(new URL("../dom-attr.ts", import.meta.url), "utf8")),
    "/dom-events.ts": stripTypeScriptTypes(await readFile(new URL("../dom-events.ts", import.meta.url), "utf8")),
    "/lazy-rows.ts": stripTypeScriptTypes(await readFile(new URL("../lazy-rows.ts", import.meta.url), "utf8")),
    "/derived.ts": stripTypeScriptTypes(await readFile(new URL("../derived.ts", import.meta.url), "utf8")),
    "/dom-v2.ts": stripTypeScriptTypes(await readFile(new URL("../dom-v2.ts", import.meta.url), "utf8")),
    "/dom-v2-spread.ts": stripTypeScriptTypes(await readFile(new URL("../dom-v2-spread.ts", import.meta.url), "utf8")),
    "/dom-v2-controls.ts": stripTypeScriptTypes(await readFile(new URL("../dom-v2-controls.ts", import.meta.url), "utf8")),
    "/dom-svg.ts": stripTypeScriptTypes(await readFile(new URL("../dom-svg.ts", import.meta.url), "utf8")),
    "/dom-adopt.ts": stripTypeScriptTypes(await readFile(new URL("../dom-adopt.ts", import.meta.url), "utf8")),
    "/slot.ts": stripTypeScriptTypes(await readFile(new URL("../slot.ts", import.meta.url), "utf8")),
    "/props.ts": stripTypeScriptTypes(await readFile(new URL("../props.ts", import.meta.url), "utf8")),
    "/style.ts": stripTypeScriptTypes(await readFile(new URL("../style.ts", import.meta.url), "utf8")).replaceAll('"#dev"', '"/dev/off.ts"'),
    "/dev/off.ts": stripTypeScriptTypes(await readFile(new URL("../dev/off.ts", import.meta.url), "utf8")),
  };
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("http://rivet.test/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      await route.fulfill({
        body: (files[path] ?? '<div id="host"></div>')
          .replaceAll("@rivetjs/runtime/dom", "/dom.ts")
          .replaceAll("@rivetjs/runtime/slot", "/slot.ts")
          .replaceAll("@rivetjs/runtime/props", "/props.ts")
          .replaceAll("@rivetjs/reactivity", "/reactivity.mjs"),
        contentType: /\.(m?js|ts)$/.test(path) ? "text/javascript" : "text/html",
      });
    });
    await page.goto("http://rivet.test/");
    const run = (name: Scenario) =>
      page.evaluate(
        async (scenario) =>
          ((await import("/fixture.mjs" as string)) as Record<Scenario, (host: Element) => string | Promise<string>>)[scenario](
            document.querySelector("#host")!,
          ),
        name,
      );
    for (const name of ["render", "plain", "update", "async", "unhandled"] as const) assert.equal(await run(name), "passed", name);
    await page.evaluate(() => new Promise<void>((done) => setTimeout(done, 0)));
    assert.deepEqual(errors, []);
    assert.equal(await run("nested"), "passed");
    await page.evaluate(() => new Promise<void>((done) => setTimeout(done, 0)));
    assert.deepEqual(errors, ["handler failed"]);
  } finally {
    await browser.close();
  }
});

test("strict preserve ErrorBoundary authoring accepts function and plain JSX children and types fallback", async () => {
  const { default: ts } = await import("typescript");
  const program = ts.createProgram([new URL("./dom-boundary/types.tsx", import.meta.url).pathname], {
    strict: true,
    noEmit: true,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: "@rivetjs/runtime",
    allowImportingTsExtensions: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
  });
  const messages = ts
    .getPreEmitDiagnostics(program)
    .map((d) => [ts.getLineAndCharacterOfPosition(d.file!, d.start!).line + 1, ts.flattenDiagnosticMessageText(d.messageText, "\n")]);
  // Exactly the non-function fallback is rejected.
  assert.deepEqual(
    messages.map(([line]) => line),
    [13],
    JSON.stringify(messages),
  );
});
