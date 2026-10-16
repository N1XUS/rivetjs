// Lane RESUME-CTX: code a resumed page evaluates later from decoded state — captured computeds (cdk collection build
// passes), captured local functions, region re-creations (For rows, Show branches) — sees the identified providers
// (`resumableContext`) that enclosed it on the server. One page per shape (fixture `resume/owner-context-fixture.tsx`).
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
type Component = () => ServerValue;

const source = await readFile(new URL("./resume/owner-context-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/oc.tsx");
const server = await importServer<Record<string, Component>>(compileResume(source, "server", "src/oc.tsx").code);
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const manifest: ResumeManifest = {
  hash: "oc",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const base: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
for (const [path, symbols] of Object.entries(byComponent)) base[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

const OUT = `document.querySelector(".out").textContent`;

/** Render `name` resumably, load it, click `.go` `clicks` times, return the `.out` text after each click (and errors). */
async function run(name: string, clicks: number): Promise<{ seen: string[]; errors: string[] }> {
  const html = await resumableToString(() => server[name]!(), { manifest });
  const files = { ...base, "/": "<!doctype html><html><head></head><body>" + html + "</body></html>" };
  return withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto("http://rivet.test/");
    const seen: string[] = [String(await page.evaluate(OUT))];
    for (let i = 0; i < clicks; i++) {
      const before = seen[seen.length - 1];
      await page.click(".go");
      await page.waitForFunction(([r, b]) => String(eval(r!)) !== b, [OUT, before], { timeout: 1500 }).catch(() => {});
      seen.push(String(await page.evaluate(OUT)));
    }
    if (await page.evaluate(() => (globalThis as { __componentRuns?: unknown }).__componentRuns)) errors.push("a component ran in the browser");
    return { seen, errors };
  });
}

test("a captured computed re-evaluates inside the provider it was created in", async () => {
  assert.deepEqual(await run("ComputedCtx", 2), { seen: ["ctx:0", "ctx:1", "ctx:2"], errors: [] });
});

test("a captured computed running a wrapper's body (collection build pass) sees the provider", async () => {
  assert.deepEqual(await run("CollectionCtx", 1), { seen: ["row0,row1", "row0,row1,row2"], errors: [] });
});

test("nested providers both reach a captured computed", async () => {
  assert.deepEqual(await run("NestedCtx", 1), { seen: ["o/i:0", "o/i:1"], errors: [] });
});

test("For rows created after resume read the provider", async () => {
  assert.deepEqual(await run("ForCtx", 1), { seen: ["fafb", "fafbfc"], errors: [] });
});

test("a Show branch created after resume reads the provider", async () => {
  assert.deepEqual(await run("ShowCtx", 1), { seen: ["", "s!"], errors: [] });
});

// Known limit (documented in docs/guides/resumability.md "Limits"): a resumed binding / clientEffect runs under its region's
// owner, a handler under the resume root — neither carries the providers, so a context read inside the expression itself
// (here through a captured function) sees the default. Read contexts in the component body (a captured value) or inside a computed.
// `test.fails`: flips to a failure once bindings get their providers.
test.fails("known limit: a captured function reading the context, called by a binding, sees the default", async () => {
  assert.deepEqual(await run("FnCtx", 1), { seen: ["fn:0", "fn:1"], errors: [] });
});

test("a computed created outside any provider keeps the default", async () => {
  assert.deepEqual(await run("NoProvider", 1), { seen: ["none:0", "none:1"], errors: [] });
});
