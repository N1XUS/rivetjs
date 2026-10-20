// Resumed pages: closures the compiler turns into resume sites — block-bodied function children (fixture
// `resume/block-child-fixture.tsx`) and function-literal destructuring defaults (`resume/default-fn-fixture.tsx`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer, symbolUrls, symbolChunks } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

/** Compile `fixture` (server + DOM symbols) once; `run` renders `Page`, clicks `clicks` and returns `read()` after each. */
async function fixture(file: string, module: string) {
  const source = await readFile(new URL("./resume/" + file, import.meta.url), "utf8");
  const dom = compileResume(source, "dom", module);
  const server = await importServer<Record<string, () => ServerValue>>(compileResume(source, "server", module).code);
  const byComponent = symbolChunks(dom.symbols);
  const manifest: ResumeManifest = { hash: file, runtime: "/rt.js", symbols: symbolUrls(dom.symbols) };
  const base: Record<string, Served> = {
    "/fixture.mjs": rewrite(dom.code),
    "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  };
  for (const [path, symbols] of Object.entries(byComponent)) base[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
  return async (read: string, clicks: string[]): Promise<{ seen: string[]; errors: string[] }> => {
    const html = await resumableToString(() => server.Page!(), { manifest });
    const files = { ...base, "/": "<!doctype html><html><head></head><body>" + html + "</body></html>" };
    return withPage(files, async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
      await page.goto("http://rivet.test/");
      const seen: string[] = [String(await page.evaluate(read))];
      for (const button of clicks) {
        const before = seen[seen.length - 1];
        await page.click(button);
        await page.waitForFunction(([r, b]) => String(eval(r!)) !== b, [read, before], { timeout: 1500 }).catch(() => {});
        seen.push(String(await page.evaluate(read)));
      }
      return { seen, errors };
    });
  };
}

const blocks = await fixture("block-child-fixture.tsx", "src/block.tsx");
const defaults = await fixture("default-fn-fixture.tsx", "src/defaults.tsx");
const html = (selector: string) => `[...document.querySelectorAll(${JSON.stringify(selector)})].map((e) => e.innerHTML.replace(/<!--[^>]*-->/g, "")).join("|")`;

test("block-bodied function children re-run after resume (native element, lazy component children)", async () => {
  const result = await blocks(html(".native") + ' + "|" + ' + html(".box:has(.lazy)"), [".go", ".go"]);
  assert.deepEqual(result, {
    seen: [
      '<b>odd 1</b>|<i class="lazy">2</i><s class="concise">3</s>',
      '<u>even 2</u>|<i class="lazy">4</i><s class="concise">6</s>',
      '<b>odd 3</b>|<i class="lazy">6</i><s class="concise">9</s>',
    ],
    errors: [],
  });
});

test("a component's lone function child re-runs after resume for reads in its own body (block, concise, nested)", async () => {
  const result = await blocks(html(".box:has(.lone)"), [".go"]);
  assert.deepEqual(result, {
    seen: [
      '<em class="lone">5</em>|<q class="lone">odd</q>|<del class="lone">one</del>',
      '<em class="lone">10</em>|<q class="lone">even</q>|<ins class="lone">many</ins>',
    ],
    errors: [],
  });
});

test("a lone function child reading only inside its JSX keeps its server nodes", async () => {
  const result = await blocks(`(document.querySelector(".keep").dataset.mark ??= "server") + document.querySelector(".keep").textContent`, [".go", ".go"]);
  assert.deepEqual(result, { seen: ["server1", "server2", "server3"], errors: [] });
});

test("function-literal destructuring and parameter defaults captured by handlers resume", async () => {
  const result = await defaults(html(".declared") + ' + "|" + ' + html(".param"), [".declared", ".param", ".param"]);
  assert.deepEqual(result, { seen: ["0|0", "1|0", "1|2", "1|4"], errors: [] });
});
