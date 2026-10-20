import { test } from "vitest";
import { stripTypeScriptTypes } from "node:module";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { compile } from "@rivetjs/compiler";

/** Exports of the compiled ./dom-async/fixture.tsx, served as /fixture.mjs. */
interface Fixture {
  run(host: Element): Promise<string>;
  reentrant(host: Element): Promise<string>;
  reentrantCleanup(host: Element): Promise<string>;
  callbacks(host: Element): Promise<string>;
  startChunk(host: Element): () => void;
  commitFailure(host: Element): Promise<string>;
  errorCallbackFailure(host: Element): Promise<string>;
  failure(host: Element): Promise<() => void>;
  holdSwap(host: Element): Promise<string>;
}
/** Browser globals written by the chunk module and the test. */
interface TestWindow extends Window {
  chunkImports?: number;
  chunkSetups?: number;
  chunkCleanups?: number;
  stopChunk?: () => void;
  stopFailure?: () => void;
}
test("compiled Async and lazy DOM regions cancel stale generations and restore owned context", async () => {
  const source = await readFile(new URL("./dom-async/fixture.tsx", import.meta.url), "utf8");
  const result = compile(source, { target: "dom" });
  assert.deepEqual(result.diagnostics, []);
  const files: Record<string, string> = {
    "/fixture.mjs": result.code,
    "/dom-router.ts": stripTypeScriptTypes(await readFile(new URL("../dom-router.ts", import.meta.url), "utf8")),
    "/dom-suspense.ts": stripTypeScriptTypes(await readFile(new URL("../dom-suspense.ts", import.meta.url), "utf8")),
    "/async-coordinator.ts": stripTypeScriptTypes(await readFile(new URL("../async-coordinator.ts", import.meta.url), "utf8")),
    "/router.ts": stripTypeScriptTypes(await readFile(new URL("../router.ts", import.meta.url), "utf8")),
    "/dom.ts": stripTypeScriptTypes(await readFile(new URL("../dom.ts", import.meta.url), "utf8")),
    "/reactivity.mjs": stripTypeScriptTypes(await readFile(new URL("../../reactivity/index.ts", import.meta.url), "utf8")),
    "/lazy.ts": stripTypeScriptTypes(await readFile(new URL("../lazy.ts", import.meta.url), "utf8")),
    "/url.ts": stripTypeScriptTypes(await readFile(new URL("../url.ts", import.meta.url), "utf8")),
    "/lazy-rows.ts": stripTypeScriptTypes(await readFile(new URL("../lazy-rows.ts", import.meta.url), "utf8")),
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
  files["/chunk.mjs"] = compile(
    `import {onCleanup} from '@rivetjs/reactivity';window.chunkImports=(window.chunkImports??0)+1;export default function Chunk({label}){window.chunkSetups=(window.chunkSetups??0)+1;onCleanup(()=>window.chunkCleanups=(window.chunkCleanups??0)+1);return <aside>{label}</aside>}`,
    { target: "dom" },
  ).code;
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
    assert.equal(await page.evaluate(async () => ((await import("/fixture.mjs" as string)) as Fixture).run(document.querySelector("#host")!)), "passed");
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(async () => ((await import("/fixture.mjs" as string)) as Fixture).reentrant(document.querySelector("#host")!)), "passed");
    assert.equal(
      await page.evaluate(async () => ((await import("/fixture.mjs" as string)) as Fixture).reentrantCleanup(document.querySelector("#host")!)),
      "passed",
    );
    await page.evaluate(() => new Promise<void>((done) => setTimeout(done, 0)));
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(async () => ((await import("/fixture.mjs" as string)) as Fixture).callbacks(document.querySelector("#host")!)), "passed");
    assert.equal(await page.evaluate(() => (window as TestWindow).chunkImports), undefined);
    await page.evaluate(async () => {
      (window as TestWindow).stopChunk = ((await import("/fixture.mjs" as string)) as Fixture).startChunk(document.querySelector("#host")!);
    });
    await page.waitForFunction(() => document.querySelector("aside")?.textContent === "actual chunk");
    assert.deepEqual(await page.evaluate(() => [(window as TestWindow).chunkImports, (window as TestWindow).chunkSetups]), [1, 1]);
    await page.evaluate(() => (window as TestWindow).stopChunk!());
    assert.equal(await page.evaluate(() => (window as TestWindow).chunkCleanups), 1);
    assert.equal(
      await page.evaluate(async () => ((await import("/fixture.mjs" as string)) as Fixture).commitFailure(document.querySelector("#host")!)),
      "passed",
    );
    await page.evaluate(() => new Promise<void>((done) => setTimeout(done, 0)));
    assert.deepEqual(errors, ["commit failed"]);
    errors.length = 0;
    assert.equal(
      await page.evaluate(async () => ((await import("/fixture.mjs" as string)) as Fixture).errorCallbackFailure(document.querySelector("#host")!)),
      "passed",
    );
    await page.evaluate(() => new Promise<void>((done) => setTimeout(done, 0)));
    assert.deepEqual(errors, ["error callback failed"]);
    errors.length = 0;
    await page.evaluate(async () => {
      (window as TestWindow).stopFailure = await ((await import("/fixture.mjs" as string)) as Fixture).failure(document.querySelector("#host")!);
    });
    await page.waitForFunction(() => document.querySelector("#host")!.textContent === "retained");
    await page.evaluate(() => new Promise<void>((done) => setTimeout(done, 0)));
    assert.deepEqual(errors, ["visible async failure"]);
    await page.evaluate(() => (window as TestWindow).stopFailure!());
    await page.evaluate(() => (document.querySelector("#host")!.textContent = ""));
    assert.equal(await page.evaluate(async () => ((await import("/fixture.mjs" as string)) as Fixture).holdSwap(document.querySelector("#host")!)), "passed");
  } finally {
    await browser.close();
  }
});

test("strict preserve async authoring infers load data and selected component props", async () => {
  const { default: ts } = await import("typescript");
  const program = ts.createProgram([new URL("./dom-async/types.tsx", import.meta.url).pathname], {
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
