// "Maybe nothing" conditionals (`{c() && <p/>}`, `c() ? <p/> : null | false | undefined`, `||`, `??`, nested,
// parenthesized, component children, `For` rows, text siblings, JSX behind a call) render and update on every
// target: server HTML, a server-rendered page resumed in Chromium (true → false → true …, first value true and
// false), and a client-only mount. Fixture `resume/cond-fixture.tsx`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { renderToString } from "@rivetjs/runtime/server";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compile } from "@rivetjs/compiler";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";
import type { Page } from "playwright";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Component = (props: { id: string; init: boolean }) => ServerValue;

const source = await readFile(new URL("./resume/cond-fixture.tsx", import.meta.url), "utf8");

/** Expected `.o` markup (comments stripped) when the JSX operand is shown or not. */
const EXPECTED: Record<string, [shown: string, hidden: string]> = {
  And: ["<p>yes</p>", ""],
  TernNull: ["<p>yes</p>", ""],
  TernFalse: ["<p>yes</p>", ""],
  TernUndefined: ["<p>yes</p>", ""],
  Or: ["<p>yes</p>", ""],
  Nullish: ["<p>yes</p>", "val"],
  Nested: ["<p>yes</p>", ""],
  Parenthesized: ["<p>yes</p>", ""],
  Child: ["<p>yes</p>", ""],
  Rows: ["<li>a<b>!</b></li><li>b<b>!</b></li>", "<li>a</li><li>b</li>"],
  Sibling: ["a <b>yes</b> b", "a  b"],
  Dynamic: ["<b>node</b>", "text"],
  DynamicNull: ["<b>node</b>", ""],
  DynamicSibling: ["<i>x</i><b>node</b><i>y</i>", "<i>x</i><i>y</i>"],
  ChildText: ["on", "off"],
  ChildFragment: ["<p>yes</p>", ""],
  ChildMixed: ["<i>x</i><p>yes</p>", "<i>x</i>"],
  ChildDynamic: ["<b>node</b>", "text"],
  FragmentRoot: ["<p>yes</p>", ""],
  ComponentOperand: ["<p>yes</p>", ""],
  TernaryAnd: ["<p>yes</p>", ""],
  RowsDynamic: ["<li>a<b>!</b></li><li>b<b>!</b></li>", "<li>a</li><li>b</li>"],
  ShowChild: ["<p>yes</p>", ""],
  ProviderChild: ["<p>yes</p>", ""],
};
const NAMES = Object.keys(EXPECTED);
const strip = (html: string): string => html.replace(/<!--.*?-->/gs, "");

// Server, no resume.
const plain = compile(source, { target: "server", filename: "cond-fixture.tsx" });
assert.deepEqual(plain.diagnostics, []);
const plainServer = await importServer<Record<string, Component>>(plain.code);

// Resume: server + DOM symbols.
const dom = compileResume(source, "dom", "src/cond.tsx");
const server = await importServer<Record<string, Component>>(compileResume(source, "server", "src/cond.tsx").code);
const byComponent = symbolChunks(dom.symbols);
const manifest: ResumeManifest = {
  hash: "cond",
  runtime: "/rt.js",
  symbols: symbolUrls(dom.symbols),
};

// Client only.
const csr = compile(source, { target: "dom", filename: "cond-fixture.tsx" });
assert.deepEqual(csr.diagnostics, []);

const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/csr.mjs": rewrite(csr.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
Object.assign(files, symbolModules(byComponent));
for (const init of [true, false]) {
  const ssr = await resumableToString(() => NAMES.map((name) => server[name]!({ id: name, init })) as unknown as ServerValue, { manifest });
  files["/resume-" + init] = "<!doctype html><html><head></head><body>" + ssr + "</body></html>";
  files["/csr-" + init] = `<!doctype html><html><body><div id="app"></div><script type="module">
    import { mount } from "/dom.ts"; import * as m from "/csr.mjs";
    mount(() => ${JSON.stringify(NAMES)}.map((name) => m[name]({ id: name, init: ${init} })), document.getElementById("app"));
    window.__mounted = true;
  </script></body></html>`;
}

const out = (page: Page, name: string) =>
  page.evaluate((name) => (document.querySelector(`#${name} .o`)?.innerHTML ?? "<missing>").replace(/<!--.*?-->/gs, ""), name);
/** Wait (≤ 2 s) for `.o` of `name` to read `want`; return what it reads. */
async function settle(page: Page, name: string, want: string): Promise<string> {
  try {
    await page.waitForFunction(
      ([name, want]) => (document.querySelector(`#${name} .o`)?.innerHTML ?? "").replace(/<!--.*?-->/gs, "") === want,
      [name, want] as const,
      { timeout: 2000 },
    );
  } catch {
    /* reported by the caller's assertion */
  }
  return out(page, name);
}
/** First value, then three flips: the `.o` markup after each step. */
async function steps(page: Page, name: string, init: boolean): Promise<string[]> {
  const [shown, hidden] = EXPECTED[name]!;
  const seen: string[] = [];
  let state = init;
  seen.push(await settle(page, name, state ? shown : hidden));
  for (let i = 0; i < 3; i++) {
    state = !state;
    await page.click(`#${name} .t`);
    seen.push(await settle(page, name, state ? shown : hidden));
  }
  return seen;
}
const want = (name: string, init: boolean): string[] => {
  const [shown, hidden] = EXPECTED[name]!;
  return [init, !init, init, !init].map((s) => (s ? shown : hidden));
};

for (const init of [true, false])
  test(`server HTML (no resume), first value ${init}`, async () => {
    for (const name of NAMES) {
      const html = await renderToString(() => plainServer[name]!({ id: name, init }));
      const inner = /class="o">(.*?)<\/(div|ul)><\/section>/s.exec(html)?.[1] ?? "<missing>";
      assert.equal(strip(inner), want(name, init)[0], name);
    }
  });

for (const init of [true, false])
  test(`resumed page, first value ${init}: every form toggles`, async () => {
    await withPage(files, async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
      await page.goto("http://rivet.test/resume-" + init);
      const failures: string[] = [];
      for (const name of NAMES) {
        const seen = await steps(page, name, init);
        if (JSON.stringify(seen) !== JSON.stringify(want(name, init))) failures.push(`${name}: ${JSON.stringify(seen)} ≠ ${JSON.stringify(want(name, init))}`);
      }
      assert.deepEqual({ failures, errors }, { failures: [], errors: [] });
      assert.equal(await page.evaluate(() => (globalThis as { __componentRuns?: unknown }).__componentRuns), undefined);
    });
  });

for (const init of [true, false])
  test(`client mount, first value ${init}: every form toggles`, async () => {
    await withPage(files, async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/csr-" + init);
      await page.waitForFunction(() => (globalThis as { __mounted?: boolean }).__mounted === true);
      const failures: string[] = [];
      for (const name of NAMES) {
        const seen = await steps(page, name, init);
        if (JSON.stringify(seen) !== JSON.stringify(want(name, init))) failures.push(`${name}: ${JSON.stringify(seen)} ≠ ${JSON.stringify(want(name, init))}`);
      }
      assert.deepEqual({ failures, errors }, { failures: [], errors: [] });
    });
  });
