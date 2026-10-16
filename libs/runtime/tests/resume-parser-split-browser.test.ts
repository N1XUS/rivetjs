// C5 (round 2): the HTML parser can move one marker of a resume pair to another parent (an implied
// `<tbody>` around rows directly in a `<table>`, foster parenting) — in development `markers()` warns
// with the `parser` hint naming the two parents. Production stays silent (DEV folds away).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/hardening-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/hardening.tsx");
const server = await importServer<{ Page(props: { items: { id: number }[] }): ServerValue }>(compileResume(source, "server", "src/hardening.tsx").code);
const manifest: ResumeManifest = { hash: "split", runtime: "/rt.js", symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])) };
const html = await resumableToString(() => server.Page({ items: [{ id: 0 }, { id: 1 }] }), { manifest });
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const base: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
};
for (const [path, symbols] of Object.entries(byComponent)) base[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

async function warnings(served: Record<string, Served>): Promise<string[]> {
  return withPage(served, async (page) => {
    const out: string[] = [];
    page.on("console", (message) => message.type() === "warning" && out.push(message.text()));
    await page.goto("http://rivet.test/");
    // What the parser does to rows directly in a table: the list's end marker lands in another parent.
    await page.evaluate(() => {
      const list = document.querySelector("#rows")!;
      const end = [...list.childNodes].reverse().find((n) => n.nodeType === 8)!;
      list.after(end);
    });
    await page.click("#probe");
    await page.waitForFunction(() => document.querySelector("#seen")!.textContent !== "", undefined, { timeout: 3000 });
    return out;
  });
}

test("development: a resume marker pair split across parents warns with the parser hint", async () => {
  const out = await warnings({ ...base, "/dev/off.ts": stripTypeScriptTypes(await readFile(new URL("../dev/on.ts", import.meta.url), "utf8")) });
  const hint = out.find((text) => text.includes("start and end under different parents"));
  assert.ok(hint, JSON.stringify(out));
  assert.match(hint, /\(<ul> \/ <main>\) — the HTML parser restructured the server markup/);
});

test("production: no parser hint", async () => {
  const out = await warnings(base);
  assert.equal(
    out.some((text) => text.includes("different parents")),
    false,
  );
});
