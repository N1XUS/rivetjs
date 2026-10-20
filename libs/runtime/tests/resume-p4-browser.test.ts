// Lane LIVE-PROPS P4 (resumed pages): spread `ref()` objects are recorded like `ref={r}` (gap 3), a lone identifier spread
// of live props stays live (gap 1), and functions / getter objects escaping as values resume (gap 2a–c). One page per
// case (fixture `resume/p4-fixture.tsx`).
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

const source = await readFile(new URL("./resume/p4-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/p4.tsx");
const server = await importServer<Record<string, Component>>(compileResume(source, "server", "src/p4.tsx").code);
const byComponent = symbolChunks(dom.symbols);
const manifest: ResumeManifest = {
  hash: "p4",
  runtime: "/rt.js",
  symbols: symbolUrls(dom.symbols),
};
const base: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
for (const [path, symbols] of Object.entries(byComponent)) base[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

/** Render `name` resumably, load it, click `.go` `clicks` times, return `read()` after each click (and errors). */
async function run(name: string, read: string, clicks: number, props = { live: true }): Promise<{ seen: string[]; errors: string[] }> {
  const html = await resumableToString(() => server[name]!(props), { manifest });
  const files = { ...base, "/": "<!doctype html><html><head></head><body>" + html + "</body></html>" };
  return withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto("http://rivet.test/");
    const seen: string[] = [String(await page.evaluate(read))];
    for (let i = 0; i < clicks; i++) {
      const before = seen[seen.length - 1];
      await page.click(".go");
      await page.waitForFunction(([r, b]) => String(eval(r!)) !== b, [read, before], { timeout: 1500 }).catch(() => {});
      seen.push(String(await page.evaluate(read)));
    }
    return { seen, errors };
  });
}

test("gap 3: a ref() object passed only through a spread is the resumed element", async () => {
  const result = await run("SpreadRef", `document.querySelector("#target").dataset.hit ?? "none"`, 1);
  assert.deepEqual(result, { seen: ["none", "yes"], errors: [] });
});

test("gap 1: a lone identifier spread of live props updates the resumed element in place", async () => {
  const result = await run("LoneSpread", `document.querySelector("span").getAttribute("title")`, 2);
  assert.deepEqual(result, { seen: ["a", "b", "a"], errors: [] });
});

test("gap 2a: a const arrow escaping as a conditional value resumes (live and static)", async () => {
  assert.deepEqual(await run("ConstArrow", `document.querySelector(".go").textContent`, 1), { seen: ["", "x!"], errors: [] });
  assert.deepEqual(await run("ConstArrow", `document.querySelector(".go").textContent`, 1, { live: false }), { seen: ["", "x!"], errors: [] });
});

test("gap 2b: an inline arrow passed as a helper call argument resumes", async () => {
  assert.deepEqual(await run("CallArg", `document.querySelector(".go").textContent`, 1), { seen: ["0", "11"], errors: [] });
});

test("gap 2c: a getter object in a conditional initializer stays live on the resumed page", async () => {
  assert.deepEqual(await run("CondGetters", `document.querySelector(".out").textContent`, 2), { seen: ["a", "b", "a"], errors: [] });
});

// Gap 6 (fixed 2026-10-08): `when` reads of a component-level `Show` (framework component: no resume site of its own, ui Avatar
// `<Show when={() => group.isVisible(id)}>`) belong to the nearest enclosing site — here one child binding over `NAMES.map(…)`. A
// `max` change re-creates that region; the server records a branch per Show the read creates directly (slot = creation order)
// and the browser hands slot i to the i-th `_show`, so items `a` / `b` keep their nodes and only `c` (crossing `max`) is built.
test("gap 6: resumed group: a `max` change shows the right items", async () => {
  const result = await run("Groups", `[...document.querySelectorAll(".item")].map((e) => e.textContent).join("")`, 2);
  assert.deepEqual(result, { seen: ["ab", "abc", "ab"], errors: [] });
});
test("gap 6: resumed group: items within `max` keep their nodes across `max` changes", async () => {
  const html = await resumableToString(() => server.Groups!({ live: true }), { manifest });
  const files = { ...base, "/": "<!doctype html><html><head></head><body>" + html + "</body></html>" };
  const replaced = await withPage(files, async (page) => {
    await page.goto("http://rivet.test/");
    await page.evaluate(() => document.querySelectorAll(".item").forEach((e) => ((e as unknown as { __kept: boolean }).__kept = true)));
    await page.click(".go");
    await page.waitForFunction(() => document.querySelectorAll(".item").length === 3, undefined, { timeout: 1500 });
    return page.evaluate(() =>
      [...document.querySelectorAll(".item.a, .item.b")]
        .filter((e) => !(e as unknown as { __kept?: boolean }).__kept)
        .map((e) => e.textContent)
        .join(""),
    );
  });
  assert.equal(replaced, "");
});
