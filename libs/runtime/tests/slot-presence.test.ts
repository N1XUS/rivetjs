// Slot presence (`class={props.header ? "card has-header" : "card"}`): server, DOM and resume.
// Reading a slot prop for presence never evaluates its content; the class follows presence on SSR,
// after resume and on DOM updates (a prop that is sometimes undefined).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderToString } from "@rivetjs/runtime/server";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compile } from "@rivetjs/compiler";
import {
  compileResume,
  compileSymbolModule,
  importServer,
} from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";
import type { Page as BrowserPage } from "playwright";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Counts = Record<string, number> | undefined;
const counts = () => (globalThis as { __seen?: Counts }).__seen;
const reset = () => delete (globalThis as { __seen?: Counts }).__seen;

const source = await readFile(
  new URL("./resume/slot-presence-fixture.tsx", import.meta.url),
  "utf8",
);
const plain = compile(source, {
  target: "server",
  filename: "slot-presence-fixture.tsx",
});
assert.deepEqual(plain.diagnostics, []);
const csr = compile(source, {
  target: "dom",
  filename: "slot-presence-fixture.tsx",
});
assert.deepEqual(csr.diagnostics, []);
const dom = compileResume(source, "dom", "src/presence.tsx");
const resumeServer = compileResume(source, "server", "src/presence.tsx");
const server = await importServer<{ Page(): ServerValue }>(resumeServer.code);
const manifest: ResumeManifest = {
  hash: "presence",
  runtime: "/rt.js",
  symbols: Object.fromEntries(
    dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"]),
  ),
};

const present = {
  a: "card has-header",
  b: "card",
  c: "panel has-header",
  d: "panel",
  e: "y",
  f: "card has-header",
  g: "card has-header",
  h: "panel has-header",
  i: "has-header",
  j: "has-header",
  k: "card has-header",
  m: "card",
};
const flipped = { ...present, g: "card", h: "panel", j: "no-header" };
// Each rendered slot evaluated once; `Flag` never renders its slot; `Head` renders in h, j.
const ssrCounts = { a: 1, c: 1, f: 1, g: 1, dyn: 2, i: 1, t: 1 };

const classOf = (html: string, id: string) =>
  html.match(new RegExp(`id="${id}"[^>]*class="([^"]*)"`))?.[1];
const classes = (html: string) =>
  Object.fromEntries(Object.keys(present).map((id) => [id, classOf(html, id)]));

test("server: presence picks the class; slot content evaluated once, never for presence alone", async () => {
  const module = await importServer<{ Page(): ServerValue }>(plain.code);
  reset();
  const html = await renderToString(() => module.Page());
  assert.deepEqual(classes(html), present);
  assert.deepEqual(counts(), ssrCounts);
  assert.match(
    html,
    /<section id="c" class="panel has-header"><header><h2>c<\/h2><\/header>body<\/section>/,
  );
  assert.match(html, /<section id="d" class="panel">body<\/section>/);
  assert.doesNotMatch(html, /never/);
});

test("resume server: class bindings reading presence serialize (r:slot thunk, function prop, local function)", async () => {
  reset();
  const html = await resumableToString(() => server.Page(), { manifest });
  assert.deepEqual(classes(html), present);
  assert.deepEqual(counts(), ssrCounts);
  // Toggle's class reads a signal: its binding captures `props` and is recorded.
  const state = JSON.parse(
    html.match(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/)![1]!,
  );
  assert.ok(
    state.b.some((binding: unknown[]) => binding[1] === "class"),
    JSON.stringify(state.b),
  );
  // Card/Panel/Flag classes read no signal: plain attributes, no props captured.
  assert.equal(
    state.b.filter((binding: unknown[]) => binding[1] === "class").length,
    2,
  );
});

// Browser files: CSR page, resumed page, symbol chunks.
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols)
  (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
reset();
const resumedHtml = await resumableToString(() => server.Page(), { manifest });
reset();
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/csr.mjs": rewrite(csr.code),
  "/rt.js":
    'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/csr": `<!doctype html><html><body><div id="app"></div><script type="module">
    import { mount } from "/dom.ts"; import { Page } from "/csr.mjs";
    mount(() => Page(), document.getElementById("app"));
  </script></body></html>`,
  "/":
    "<!doctype html><html><head></head><body>" + resumedHtml + "</body></html>",
};
for (const [path, symbols] of Object.entries(byComponent))
  files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

const browserClasses = (page: BrowserPage) =>
  page.evaluate(
    (ids) =>
      Object.fromEntries(
        ids.map((id) => [
          id,
          document.getElementById(id)?.getAttribute("class"),
        ]),
      ),
    Object.keys(present),
  );
const browserCounts = (page: BrowserPage) =>
  page.evaluate(
    () => (globalThis as { __seen?: Record<string, number> }).__seen,
  );
const waitClass = (page: BrowserPage, id: string, value: string) =>
  page.waitForFunction(
    ([id, value]) =>
      document.getElementById(id!)?.getAttribute("class") === value,
    [id, value],
  );

test("DOM: class follows presence when a slot prop comes and goes; other slots not re-rendered", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/csr");
    await page.waitForFunction(() => document.getElementById("j"));
    assert.deepEqual(await browserClasses(page), present);
    assert.deepEqual(await browserCounts(page), ssrCounts);
    await page.click("#flip");
    await waitClass(page, "g", "card");
    assert.deepEqual(await browserClasses(page), flipped);
    assert.equal(await page.$("#h header"), null);
    await page.click("#flip");
    await waitClass(page, "g", "card has-header");
    assert.deepEqual(await browserClasses(page), present);
    assert.deepEqual(await browserCounts(page), { ...ssrCounts, g: 2, dyn: 4 });
    await page.click("#i .open");
    await waitClass(page, "i", "has-header open");
    assert.deepEqual(errors, []);
  });
});

test("resume: SSR classes kept; presence change re-creates only the changed parts; resumed class binding reads presence", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    assert.deepEqual(await browserClasses(page), present);
    // The resumed Toggle binding re-reads `props.header` (a serialized slot symbol) without rendering it.
    await page.click("#i .open");
    await waitClass(page, "i", "has-header open");
    assert.equal(await browserCounts(page), undefined);
    await page.click("#flip");
    await waitClass(page, "g", "card");
    assert.deepEqual(await browserClasses(page), {
      ...flipped,
      i: "has-header open",
    });
    assert.equal(await page.$("#h header"), null);
    await page.click("#j .open");
    await waitClass(page, "j", "no-header open");
    await page.click("#flip");
    await waitClass(page, "g", "card has-header");
    assert.deepEqual(await browserClasses(page), {
      ...present,
      i: "has-header open",
    });
    // Only the re-created g, h, j rendered their slots; static slots (a, c, f, i, k) never re-ran.
    assert.deepEqual(await browserCounts(page), { g: 1, dyn: 2 });
    assert.deepEqual(errors, []);
  });
});

// Conditional slot presence (G26): a conditional `r:slot` child lowers to a conditional slot prop;
// inline conditional function props are slot symbols on resume.
test('conditional r:slot child `{cond && <h2 r:slot="header"/>}` compiles to `header: cond ? () => <h2/> : undefined`', async () => {
  const code = `function Card(props: any) { return <div class={props.header ? "a" : "b"}><slot r:name="header" /></div>; }
     export function Page(props: any) { return <Card>{props.on && <h2 r:slot="header">H</h2>}</Card>; }`;
  const result = compile(code, { target: "dom", filename: "cond.tsx" });
  assert.deepEqual(result.diagnostics, []);
  const ssr = compile(code, { target: "server", filename: "cond.tsx" });
  assert.deepEqual(ssr.diagnostics, []);
  const module = await importServer<{ Page(props: { on: boolean }): ServerValue }>(ssr.code);
  assert.equal(await renderToString(() => module.Page({ on: true })), '<div class="a"><h2>H</h2></div>');
  assert.equal(await renderToString(() => module.Page({ on: false })), '<div class="b"></div>');
});

test("resume: inline conditional function prop `header={on() ? () => <h2/> : undefined}` is serializable when a binding captures props", async () => {
  const code = `import { signal } from "@rivetjs/reactivity";
    function Toggle(props: any) { const open = signal(false); return <div class={(props.header ? "h" : "n") + (open() ? " o" : "")} />; }
    export function Page() { const on = signal(true); return <Toggle header={on() ? () => <h2>H</h2> : undefined} />; }`;
  const symbols = compileResume(code, "dom", "src/cond.tsx").symbols;
  assert.ok(symbols.some((s) => s.kind === "slot"));
  const module = await importServer<{ Page(): ServerValue }>(compileResume(code, "server", "src/cond.tsx").code);
  const html = await resumableToString(() => module.Page(), {
    manifest: { hash: "cond", runtime: "/rt.js", symbols: Object.fromEntries(symbols.map((s) => [s.id, "/c.js"])) },
  });
  assert.match(html, /<div class="h" data-r="0"><\/div>/);
});
