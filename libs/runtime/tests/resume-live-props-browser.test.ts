// LIVE-PROPS P3: a resumed page updates components' dynamic props in place — direct props (`_rProps` recipe),
// `splitProps` forwards into a native spread, a component forwarding a derived prop to another component. The
// components never run in the browser and their server nodes (incl. lazy children) stay. A client-only mount of the
// same fixture gives the same values. Fixture `resume/live-props-fixture.tsx`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compile } from "@rivetjs/compiler";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";
import type { Page } from "playwright";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Component = (props: { id: string }) => ServerValue;

const source = await readFile(new URL("./resume/live-props-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/live.tsx");
const server = await importServer<Record<string, Component>>(compileResume(source, "server", "src/live.tsx").code);
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const manifest: ResumeManifest = {
  hash: "live",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const csr = compile(source, { target: "dom", filename: "live-props-fixture.tsx" });
assert.deepEqual(csr.diagnostics, []);

const ssr = await resumableToString(() => server.LiveProps!({ id: "app" }), { manifest });
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/csr.mjs": rewrite(csr.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/resume": "<!doctype html><html><head></head><body>" + ssr + "</body></html>",
  "/csr": `<!doctype html><html><body><div id="host"></div><script type="module">
    import { mount } from "/dom.ts"; import { LiveProps } from "/csr.mjs";
    mount(() => LiveProps({ id: "app" }), document.getElementById("host"));
    window.__mounted = true;
  </script></body></html>`,
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

/** Observed values of every case. */
const read = (page: Page) =>
  page.evaluate(() => {
    const q = (s: string) => document.querySelector(s);
    return {
      direct: [q(".direct p")?.getAttribute("class"), q(".direct p")?.textContent],
      forward: [q(".forward div")?.getAttribute("class"), q(".forward .kid")?.textContent],
      nested: [q(".nested p")?.getAttribute("class"), q(".nested p")?.textContent],
    };
  });
const expected = (v: string) => ({
  direct: ["leaf " + v, "L" + v],
  forward: ["box " + v, "kid"],
  nested: ["leaf " + v + "!", "N" + v],
});
/** Tag the nodes whose identity must survive the updates. */
const mark = (page: Page) =>
  page.evaluate(() => {
    for (const s of [".direct p", ".forward div", ".forward .kid", ".nested p"]) (document.querySelector(s) as unknown as { __kept: boolean }).__kept = true;
  });
const kept = (page: Page) =>
  page.evaluate(() =>
    [".direct p", ".forward div", ".forward .kid", ".nested p"].filter(
      (s) => (document.querySelector(s) as unknown as { __kept?: boolean } | null)?.__kept !== true,
    ),
  );

async function steps(page: Page): Promise<string[]> {
  const failures: string[] = [];
  for (const [i, v] of ["a", "b", "a", "b"].entries()) {
    if (i > 0) await page.click(".next");
    try {
      await page.waitForFunction(
        (want) =>
          document.querySelector(".direct p")?.getAttribute("class") === want && document.querySelector(".nested p")?.textContent === "N" + want.slice(5),
        "leaf " + v,
        { timeout: 2000 },
      );
    } catch {
      /* reported below */
    }
    const seen = await read(page);
    if (JSON.stringify(seen) !== JSON.stringify(expected(v))) failures.push(`step ${i}: ${JSON.stringify(seen)} ≠ ${JSON.stringify(expected(v))}`);
    if (i === 0) await mark(page);
  }
  return failures;
}

test("server HTML renders the first values", () => {
  for (const part of ['class="leaf a"', ">La<", 'class="box a"', 'class="kid"', 'class="leaf a!"', ">Na<"]) assert.ok(ssr.includes(part), part);
});

test("resumed page: live props update in place, no component runs, server nodes kept", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto("http://rivet.test/resume");
    const failures = await steps(page);
    const replaced = await kept(page);
    const runs = await page.evaluate(() => (globalThis as { __runs?: unknown }).__runs);
    assert.deepEqual({ failures, replaced, runs, errors }, { failures: [], replaced: [], runs: undefined, errors: [] });
  });
});

test("client mount: same values", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/csr");
    await page.waitForFunction(() => (globalThis as { __mounted?: boolean }).__mounted === true);
    const failures = await steps(page);
    const replaced = await kept(page);
    assert.deepEqual({ failures, replaced, errors }, { failures: [], replaced: [], errors: [] });
  });
});
