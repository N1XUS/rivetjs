// Resume: the loader's replay of a held cold click (checkbox / radio / summary / label / submit default) is seen by
// no listener. Every listener already saw the event: live ones while it dispatched, delegated ones when the loader
// ran them. A live ancestor (an activated spread: cdk Checkbox label, RA useToggle preventDefault) seeing the replay
// cancelled the toggle its descendant's replayed handler had stopped: widgets.test.ts "form fields" cold Space flaked
// whenever the label's binding activated before the input's (lane REG).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/replay-live-ancestor-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/replay-live-ancestor.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/replay-live-ancestor.tsx").code);
const manifest: ResumeManifest = {
  hash: "replay-live-ancestor",
  runtime: "/rt.js",
  symbols: symbolUrls(dom.symbols),
};
const html = await resumableToString(() => server.Page(), { manifest });
const byComponent = symbolChunks(dom.symbols);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
};
Object.assign(files, symbolModules(byComponent));

test("resume: a held cold click's replay keeps its default from a live ancestor (checkbox inside an activated label)", async () => {
  assert.ok(files["/c/Box.js"], "the input's handler has a chunk of its own");
  await withPage(
    files,
    async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/");
      // Activate the label's spread: it now listens on itself (its delegated click entry is taken over).
      await page.click("#arm");
      await page.waitForFunction(() => document.querySelector("#label")!.getAttribute("data-armed") === "1");
      // Cold click on the input (its chunk is held): the loader cancels the toggle, runs the handler once the chunk
      // lands (it stops the click: the label's handler is not for it), then replays the default.
      await page.click("#box");
      await page.waitForFunction(() => (globalThis as { __boxClicks?: number }).__boxClicks === 1);
      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.equal(await page.evaluate(() => document.querySelector<HTMLInputElement>("#box")!.checked), true, "the replayed toggle stands");
      assert.equal(await page.evaluate(() => (globalThis as { __boxClicks?: number }).__boxClicks), 1, "the input's handler ran once");
      assert.deepEqual(errors, []);
    },
    { delays: { "/c/Box.js": 400 } },
  );
});
