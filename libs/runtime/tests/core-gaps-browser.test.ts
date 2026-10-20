// CORE-GAPS (2026-10-08, docs-audit framework gaps): each fixture under `resume/core-gaps/` is rendered client-side
// (`/csr`, plain DOM compile + `mount`) and server-rendered + resumed (`/`), then driven by clicks.
// (a) conditional `r:slot` content, (b) ErrorBoundary over resumed bindings, (c) props member reads as resume sites,
// (d) module-function aliases as props, (e) live `Dynamic`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile } from "@rivetjs/compiler";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer, symbolUrls, symbolChunks } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Run = (mode: "csr" | "resume", read: string, clicks: string[]) => Promise<{ seen: string[]; errors: string[] }>;

/** Compile `resume/core-gaps/<file>` for both modes; `run` renders `Page`, clicks and returns `read` after each step. */
async function fixture(file: string, extra: Record<string, Served> = {}): Promise<Run> {
  const source = await readFile(new URL("./resume/core-gaps/" + file, import.meta.url), "utf8");
  const module = "src/" + file;
  const csr = compile(source, { target: "dom", filename: file });
  assert.deepEqual(csr.diagnostics, []);
  const dom = compileResume(source, "dom", module);
  const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", module).code);
  const byComponent = symbolChunks(dom.symbols);
  const manifest: ResumeManifest = { hash: file, runtime: "/rt.js", symbols: symbolUrls(dom.symbols) };
  const base: Record<string, Served> = {
    ...extra,
    "/fixture.mjs": rewrite(dom.code),
    "/csr.mjs": rewrite(csr.code),
    "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
    "/csr": `<!doctype html><html><body><div id="app"></div><script type="module">
      import { mount } from "/dom.ts"; import { Page } from "/csr.mjs";
      mount(() => Page(), document.getElementById("app"));
    </script></body></html>`,
  };
  for (const [path, symbols] of Object.entries(byComponent)) base[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
  return async (mode, read, clicks) => {
    const files = {
      ...base,
      "/": "<!doctype html><html><head></head><body>" + (await resumableToString(() => server.Page(), { manifest })) + "</body></html>",
    };
    return withPage(files, async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
      await page.goto("http://rivet.test/" + (mode === "csr" ? "csr" : ""));
      await page.waitForFunction(() => document.querySelector(".go"));
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

const strip = (selector: string) => `(document.querySelector(${JSON.stringify(selector)})?.innerHTML ?? "").replace(/<!--[^>]*-->| data-r="[^"]*"/g, "")`;

test("(a) a conditional r:slot child adds and removes the named slot content (fallback back when absent)", async () => {
  const run = await fixture("slot.tsx");
  const read = strip(".card");
  const expected = [
    '<h2 class="fallback">Untitled</h2><div class="body"><p>Body</p></div>',
    '<h2 class="title">Title</h2><div class="body"><p>Body</p></div>',
    '<h2 class="fallback">Untitled</h2><div class="body"><p>Body</p></div>',
  ];
  for (const mode of ["csr", "resume"] as const) assert.deepEqual(await run(mode, read, [".go", ".go"]), { seen: expected, errors: [] }, mode);
});

test("(b) an ErrorBoundary catches its content's server-rendered bindings failing after a change; reset re-creates it", async () => {
  const run = await fixture("boundary.tsx");
  const read = strip(".direct") + ' + "|" + ' + strip(".cond");
  const expected = [
    '<p class="ok">even 0</p>|<p class="ok" title="even 0">0</p>',
    '<p class="err">odd 1</p>|<p class="err">odd 1</p>',
    '<p class="ok">even 2</p>|<p class="err">odd 1</p>',
  ];
  for (const mode of ["csr", "resume"] as const) assert.deepEqual(await run(mode, read, [".go", ".direct .err"]), { seen: expected, errors: [] }, mode);
});

test("(c) props member reads update the server-rendered child in place after resume", async () => {
  const run = await fixture("badge.tsx");
  // `__badge`: the first badge element seen; `same` = the node survived (no re-creation of Badge).
  const read = `(window.__badge ??= document.querySelector(".badge"), (window.__badge === document.querySelector(".badge")) + ":" + document.querySelector(".badge").title + ":" + document.querySelector(".badge").textContent)`;
  const expected = ["true:L1:1|2", "true:L2:2|4", "true:L3:3|6"];
  for (const mode of ["csr", "resume"] as const) assert.deepEqual(await run(mode, read, [".go", ".go"]), { seen: expected, errors: [] }, mode);
});

test("(d) a module-level function passed as a prop (local alias, static props) resumes", async () => {
  const run = await fixture("alias.tsx");
  const read = strip(".out") + ' + "|" + document.querySelector(".step").textContent';
  const expected = ["<b>2</b>|<b>3</b>|1", "<b>4</b>|<b>6</b>|1", "<b>4</b>|<b>6</b>|2", "<b>4</b>|<b>6</b>|3"];
  for (const mode of ["csr", "resume"] as const) assert.deepEqual(await run(mode, read, [".go", ".step", ".step"]), { seen: expected, errors: [] }, mode);
});

test("(e) Dynamic follows a changing component / tag and live forwarded props", async () => {
  const run = await fixture("dynamic.tsx");
  const read = strip(".fn") + ' + "|" + ' + strip(".tag");
  const expected = [
    '<b class="hello">hello w0</b>|<strong title="t0">c0</strong>',
    '<i class="bye">bye w1</i>|<em title="t1">c1</em>',
    '<b class="hello">hello w2</b>|<strong title="t2">c2</strong>',
  ];
  for (const mode of ["csr", "resume"] as const) assert.deepEqual(await run(mode, read, [".go", ".go"]), { seen: expected, errors: [] }, mode);
});
