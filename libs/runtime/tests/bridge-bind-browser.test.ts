// Function Bridge T9 + T10: a bound resumable function used as a handler capture resumes through dom-resume's custom
// `bind`. The compiler's C9 rewrite (T10) emits `_rBound(add, null, [2])` on the server; no hand rewrite.
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";

const source = `import { signal } from "@rivetjs/reactivity";
export function Page() {
  const n = signal(0);
  const add = (by: number) => n.set(n() + by);
  const inc = add.bind(null, 2);
  return <button id="go" onClick={() => inc()}>{n()}</button>;
}`;
const dom = compileResume(source, "dom", "src/bind.tsx");
const code = compileResume(source, "server", "src/bind.tsx").code;
assert.match(code, /const inc = __rivetR_bound\(add, null, \[2\]\)/);
const server = await importServer<{ Page(): never }>(code);
const symbols: ResumeSymbol[] = dom.symbols;
const manifest: ResumeManifest = { runtime: "/rt.js", symbols: Object.fromEntries(symbols.map((s) => [s.id, "/c.js"])) };

test("a bound function capture resumes as fn.bind(self, ...args) in the browser", async () => {
  const html = (await resumableToString(() => server.Page(), { manifest })) as string;
  assert.match(html, /"bind"/);
  await withPage(
    {
      "/fixture.mjs": rewrite(dom.code),
      "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
      "/c.js": rewrite(compileSymbolModule(symbols, "/fixture.mjs")),
      "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
    },
    async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/");
      await page.click("#go");
      await page.waitForFunction(() => document.getElementById("go")!.textContent === "2");
      await page.click("#go");
      await page.waitForFunction(() => document.getElementById("go")!.textContent === "4");
      assert.deepEqual(errors, []);
    },
  );
});
