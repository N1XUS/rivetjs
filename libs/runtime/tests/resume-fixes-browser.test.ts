// Resumed handler and boundary behavior (G18): event.currentTarget, Async reload on signal change.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
interface Fixture {
  Targets(): ServerValue;
  Loads(): ServerValue;
}

const source = await readFile(new URL("./resume/fixes-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/fixes.tsx");
const server = await importServer<Fixture>(compileResume(source, "server", "src/fixes.tsx").code);
const byComponent = symbolChunks(dom.symbols);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume();',
};
Object.assign(files, symbolModules(byComponent));
const manifest: ResumeManifest = {
  hash: "test",
  runtime: "/rt.js",
  symbols: symbolUrls(dom.symbols),
};
const page = async (component: keyof Fixture): Promise<string> =>
  "<!doctype html><html><head></head><body>" + (await resumableToString(() => server[component](), { manifest })) + "</body></html>";
files["/targets"] = await page("Targets");
files["/loads"] = await page("Loads");

test("resumed handlers see their own element as event.currentTarget (cold, warm and clientEvent)", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/targets");
    // Cold: the click on the nested span is replayed after the chunk loads.
    await page.click("#inner");
    await page.waitForFunction(() => document.querySelector("#seen")!.textContent !== "");
    assert.equal(await page.textContent("#seen"), "card|inner");
    // Warm: synchronous dispatch from the document-level delegated listener.
    const warm = await page.evaluate(() => {
      const read = () => document.querySelector("#seen")!.textContent;
      document.querySelector<HTMLElement>("#card")!.click();
      const direct = read();
      document.querySelector<HTMLElement>("#inner")!.click();
      return [direct, read()];
    });
    assert.deepEqual(warm, ["card|card", "card|inner"]);
    // After the handler: the native value again (null once dispatch is over).
    assert.equal(await page.evaluate(() => {
      let after: unknown = "unset";
      const event = new MouseEvent("click", { bubbles: true });
      document.querySelector("#inner")!.dispatchEvent(event);
      after = event.currentTarget;
      return after;
    }), null);
    // A resumed clientEvent whose handler chunk loads on the first event (runs after dispatch ended).
    await page.waitForFunction(() => document.readyState === "complete");
    await page.waitForTimeout(100);
    await page.evaluate(() => document.dispatchEvent(new Event("rivet-test")));
    await page.waitForFunction(() => document.querySelector("#custom")!.textContent !== "");
    assert.equal(await page.textContent("#custom"), "document");
    assert.deepEqual(errors, []);
  });
});

test("a resumed Async whose load reads a signal reloads when it changes", async () => {
  assert.match(files["/loads"] as string, /<!--r\d+\[--><b id="out">10<\/b><!--\]-->/);
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/loads");
    await page.click("#next");
    await page.waitForFunction(() => document.querySelector("#out")?.textContent === "20");
    assert.equal(await page.textContent("#sync"), "200");
    // The re-created DOM Async tracks the signal itself from now on.
    await page.click("#next");
    await page.waitForFunction(() => document.querySelector("#out")?.textContent === "30");
    assert.equal(await page.textContent("#sync"), "300");
    assert.equal(await page.evaluate(() => document.querySelectorAll("#out").length), 1);
    assert.deepEqual(errors, []);
  });
});
