// Portal on the server and on resumed pages: content is in the server HTML (in place), moves to its
// mount at load, stays interactive (resumed handlers / bindings inside), and is removed with its
// owner; a portal behind a Show that starts false is created in the browser.
//
// The fixture's whole cdk module graph is compiled like an app build (resume mode, `sourcePackages`):
// server through `server.ts` (`.tsx` compiled, `.ts` by file URL), browser here (`.tsx` compiled for
// the DOM, `.ts` type-stripped, every module served under `/cdk/`). Following the imports keeps the
// harness independent of what `portal/index.tsx` happens to import.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import * as compiler from "@rivetjs/compiler";
import { resumableToString, type ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileSymbolModule, type ResumeSymbol } from "../../runtime/tests/resume/compile.ts";
import { withPage, rewrite, type Served } from "../../runtime/tests/resume/harness.ts";
import { serverModule } from "./server.ts";
import { resolveCdkSubpath } from "./resolve-subpath.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
const cdk = new URL("../", import.meta.url);
const runtime = new URL("../../runtime/", import.meta.url);
const read = (path: string, base = cdk) => readFile(new URL(path, base), "utf8");
const fixtureSource = await read("tests/fixtures/portal-fixture.tsx");
const fixtureFile = "portal.tsx"; // compiled as module `src/portal.tsx` (server.ts convention for inline sources)

// Server: fixture + cdk graph (server.ts compiles `.tsx` imports recursively).
const server = (await import(await serverModule(fixtureFile, fixtureSource))) as { Page(): ServerValue };

// Browser: the same graph, compiled for the DOM with the same module ids (same symbol ids).
const isFile = (file: string) =>
  stat(new URL(file, cdk)).then(
    (s) => s.isFile(),
    () => false,
  );
async function resolveFile(base: string): Promise<string> {
  if (/\.tsx?$/.test(base)) return base;
  for (const file of [base + ".tsx", base + ".ts", base + "/index.tsx", base + "/index.ts"]) if (await isFile(file)) return file;
  throw new Error(`portal-resume: cannot resolve ${base}`);
}
const servedPath = (file: string) => "/cdk/" + file.replace(/\.tsx?$/, ".mjs");
const files: Record<string, Served> = {};
const symbols: { s: ResumeSymbol; from: string }[] = [];
const built = new Set<string>();
/** Served module → its cdk import specifiers resolved to served paths (symbol modules reuse them). */
const resolved: Record<string, Record<string, string>> = {};
/** Point cdk / runtime specifiers at served paths. */
const serve = (code: string, specifiers: Record<string, string>) => {
  for (const [specifier, path] of Object.entries(specifiers)) code = code.replaceAll(`"${specifier}"`, JSON.stringify(path));
  return rewrite(code).replaceAll('"@rivetjs/runtime/id"', '"/id-dom.mjs"');
};

/** Compile (`.tsx`) or strip (`.ts`) one module, serve it at `/cdk/<file>.mjs`, then its cdk imports. */
async function domModule(file: string, source?: string): Promise<void> {
  if (built.has(file)) return;
  built.add(file);
  const text = source ?? (await read(file));
  let code: string;
  if (file.endsWith(".tsx")) {
    const result = compiler.compile(text, {
      target: "dom",
      filename: file,
      resume: { module: source ? `src/${file}` : `@rivetjs/cdk/${file}` },
      sourcePackages: ["@rivetjs/cdk"],
    }) as unknown as { code: string; diagnostics: { message: string }[]; symbols: ResumeSymbol[] };
    if (result.diagnostics.length) throw new Error(result.diagnostics.map((d) => d.message).join("\n"));
    code = result.code;
    for (const s of result.symbols) symbols.push({ s, from: servedPath(file) });
  } else code = stripTypeScriptTypes(text, { mode: "strip" });
  const dir = source ? "" : file.slice(0, file.lastIndexOf("/") + 1);
  const imports = [...code.matchAll(/(?:from|import)\s*"((?:\.\.?\/|@rivetjs\/cdk\/)[^"]+|#server)"/g)].map((m) => m[1]!);
  const specifiers: Record<string, string> = (resolved[servedPath(file)] = {});
  for (const specifier of new Set(imports)) {
    // The cdk `#server` package import resolves to its browser file (as the `browser` condition does).
    const base =
      specifier === "#server"
        ? "collections/server-off.ts"
        : specifier.startsWith("@rivetjs/cdk/")
          ? (resolveCdkSubpath(specifier.slice("@rivetjs/cdk/".length)) ?? specifier.slice("@rivetjs/cdk/".length))
          : new URL(specifier, new URL(dir, "file:///")).pathname.slice(1);
    const target = await resolveFile(base);
    specifiers[specifier] = servedPath(target);
    await domModule(target);
  }
  files[servedPath(file)] = serve(code, specifiers);
}
await domModule(fixtureFile, fixtureSource);

const manifest: ResumeManifest = {
  hash: "portal",
  runtime: "/rt.js",
  symbols: Object.fromEntries(symbols.map(({ s, from }) => [s.id, "/c" + from.slice("/cdk".length, -".mjs".length) + "/" + s.component + ".js"])),
};
const html = await resumableToString(() => server.Page(), { manifest });

test("server: portal content is in the HTML, in place, inside its host", () => {
  assert.match(html, /<div data-rivet-portal=""[^>]*>.*<div id="notice" role="status">/s);
  assert.ok(html.indexOf('id="notice"') > html.indexOf('id="card"') && html.indexOf('id="notice"') < html.indexOf('id="outlet"'), "rendered in place");
  assert.doesNotMatch(html, /id="late"/);
});

const groups: Record<string, ResumeSymbol[]> = {};
for (const { s, from } of symbols) (groups[from + "|" + manifest.symbols[s.id]] ??= []).push(s);
const strip = async (path: string, base = runtime) => rewrite(stripTypeScriptTypes(await read(path, base), { mode: "strip" }));
Object.assign(files, {
  "/id.mjs": await strip("id.ts"),
  "/id-dom.mjs": (await strip("id-dom.ts")).replaceAll('"./id.ts"', '"/id.mjs"'),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
});
for (const [key, list] of Object.entries(groups)) {
  const [from, path] = key.split("|") as [string, string];
  files[path] = serve(compileSymbolModule(list, from), resolved[from]!);
}

test("resume: a server-rendered portal moves to body at load, stays interactive, leaves with its owner", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    const wait = (fn: string) =>
      page.waitForFunction(fn, undefined, { timeout: 5000 }).catch(() => Promise.reject(new Error(`${fn}; errors: ${errors.join(" | ")}; body: ${0}`)));
    await wait(`document.querySelector("body > [data-rivet-portal] > #notice") !== null`);
    assert.equal(await page.evaluate(() => document.querySelector("#card #notice")), null, "moved out of the clipped card");
    await page.click("#inc");
    await wait(`document.querySelector("#notice").textContent.includes("Notice 1")`);
    await page.click("#toggle");
    await wait(`document.querySelector("[data-rivet-portal] #notice") === null`);
    assert.equal(await page.evaluate(() => document.querySelectorAll("[data-rivet-portal]").length), 0, "host removed with the Show branch");
    await page.click("#toggle");
    await wait(`document.querySelector("body > [data-rivet-portal] > #notice") !== null`);
    await page.click("#later");
    await wait(`document.querySelector("#outlet > [data-rivet-portal] > #late") !== null`);
    await page.click("#later");
    await wait(`document.querySelector("#late") === null`);
    assert.equal(await page.evaluate(() => (globalThis as { __componentRuns?: number }).__componentRuns), undefined);
    assert.deepEqual(errors, []);
  });
});
