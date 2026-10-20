// Resumed pages: a user slot passed on through `{children ?? <Default/>}` into a component whose root Show renders nothing
// on the server and switches on the client (ui ScrollArea Scrollbar). Fixture `resume/slot-fallback-fixture.tsx`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Component = (props: { live: boolean }) => ServerValue;

const source = await readFile(new URL("./resume/slot-fallback-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/slot.tsx");
const server = await importServer<Record<string, Component>>(compileResume(source, "server", "src/slot.tsx").code);
const byComponent = symbolChunks(dom.symbols);
const manifest: ResumeManifest = {
  hash: "slot",
  runtime: "/rt.js",
  symbols: symbolUrls(dom.symbols),
};
const base: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
for (const [path, symbols] of Object.entries(byComponent)) base[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

/** Render `name` resumably, load it, click `.go` `clicks` times, return `read()` after each click (and errors). */
async function run(name: string, read: string, clicks: number | string[], props = { live: true }): Promise<{ seen: string[]; errors: string[] }> {
  const html = await resumableToString(() => server[name]!(props), { manifest });
  const files = { ...base, "/": "<!doctype html><html><head></head><body>" + html + "</body></html>" };
  return withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto("http://rivet.test/");
    const seen: string[] = [String(await page.evaluate(read))];
    for (const button of typeof clicks === "number" ? Array(clicks).fill(".go") : clicks) {
      const before = seen[seen.length - 1];
      await page.click(button);
      await page.waitForFunction(([r, b]) => String(eval(r!)) !== b, [read, before], { timeout: 1500 }).catch(() => {});
      seen.push(String(await page.evaluate(read)));
    }
    return { seen, errors };
  });
}

test("a `children ?? <Default/>` slot renders in a re-created region's Show branch (user slot and default)", async () => {
  const result = await run("Page", `[...document.querySelectorAll(".bar")].map((b) => b.innerHTML).join("|")`, 2);
  assert.deepEqual(result, { seen: ["", '<b class="user on">on</b>|<i class="thumb">t</i>', ""], errors: [] });
});

test("the slot survives its inner Show toggling off and on inside the re-created region", async () => {
  const result = await run("Page", `[...document.querySelectorAll(".bar")].map((b) => b.innerHTML).join("|")`, [".go", ".hide", ".hide", ".go", ".go"]);
  const both = '<b class="user on">on</b>|<i class="thumb">t</i>';
  assert.deepEqual(result, { seen: ["", both, "", both, "", both], errors: [] });
});

test("a user part inside the slot updates after its nodes moved out of the Provider's detached output (insertBefore … not a child)", async () => {
  const result = await run("Page", `[...document.querySelectorAll(".bar")].map((b) => b.innerHTML).join("|")`, [".go", ".flip", ".flip"]);
  const user = (state: string) => `<b class="user ${state}">${state}</b>|<i class="thumb">t</i>`;
  assert.deepEqual(result, { seen: ["", user("on"), user("off"), user("on")], errors: [] });
});
