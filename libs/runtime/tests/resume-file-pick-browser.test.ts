// Resume: two quick file picks while the handler chunk loads replay each with its own `files` (the
// loader snapshots them at dispatch; the runtime shows them while the event's handlers run), so the
// second pick is not counted twice (G15).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/file-pick-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/file-pick.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/file-pick.tsx").code);
const manifest: ResumeManifest = {
  hash: "file-pick",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const html = await resumableToString(() => server.Page(), { manifest });
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
const file = (name: string) => ({ name, mimeType: "text/plain", buffer: Buffer.from(name) });

test("resume: two cold file picks replay with their own selections", async () => {
  await withPage(
    files,
    async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/");
      // Both picks land while the handler chunk is still loading.
      await page.setInputFiles("#files", [file("a.txt")]);
      await page.setInputFiles("#files", [file("b.txt"), file("c.txt")]);
      await page.waitForFunction(() => document.querySelector("#picks")!.textContent!.includes("|"), undefined, { timeout: 3000 });
      assert.equal(await page.textContent("#picks"), "a.txt | b.txt+c.txt");
      // The input keeps the user's latest selection.
      assert.deepEqual(await page.evaluate(() => Array.from(document.querySelector<HTMLInputElement>("#files")!.files!, (f) => f.name)), ["b.txt", "c.txt"]);
      // Warm: a third pick runs directly.
      await page.setInputFiles("#files", [file("d.txt")]);
      await page.waitForFunction(() => document.querySelector("#picks")!.textContent!.endsWith("d.txt"), undefined, { timeout: 3000 });
      assert.equal(await page.textContent("#picks"), "a.txt | b.txt+c.txt | d.txt");
      assert.deepEqual(errors, []);
    },
    { delays: { "/c/Page.js": 300 } },
  );
});
