// G9: <select value> / model:value on server, DOM and resumed pages.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile } from "@rivetjs/compiler";
import { renderToString } from "@rivetjs/runtime/server";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type Component = () => unknown;
/** A custom element: `items` / `label` properties; a click dispatches non-bubbling `probe-hit` (detail 1) and `camelHit`. */
const PROBE = `customElements.define("x-probe", class extends HTMLElement {
  set items(v) { this._items = v; this.textContent = v.join(","); }
  get items() { return this._items; }
  connectedCallback() { this.onclick = () => { this.dispatchEvent(new CustomEvent("probe-hit", { detail: 1 })); this.dispatchEvent(new CustomEvent("camelHit")); }; }
});`;
const source = await readFile(new URL("./resume/jsx-attrs-fixture.tsx", import.meta.url), "utf8");
const names = ["StaticSelect", "TextSelect", "MappedSelect", "MultipleSelect", "ModelSelect", "ModelMultiple", "LateOptions", "Custom", "Dialogs"] as const;
type Name = (typeof names)[number];

const plainServer = compile(source, { target: "server", filename: "fixture.tsx" });
assert.deepEqual(plainServer.diagnostics, []);
const server = await importServer<Record<Name, Component>>(plainServer.code);
const ssr = async (name: Name) => (await renderToString(server[name]() as never)).replace(/<!--[^>]*-->/g, "");

test("server: <select value> marks the matching option selected and drops the ignored value attribute", async () => {
  assert.equal(
    await ssr("StaticSelect"),
    '<select id="static"><option value="a">A</option><option value="b" selected>B</option><option> c </option></select>',
  );
  assert.equal(
    await ssr("TextSelect"),
    '<select id="text"><optgroup label="g"><option value="a">A</option><option selected> c </option></optgroup></select>',
  );
  assert.match(await ssr("MappedSelect"), /<option value="s">S<\/option><option value="m">M<\/option><option value="l" selected>L<\/option>/);
  assert.match(await ssr("MultipleSelect"), /<option value="a" selected>A<\/option><option value="b">B<\/option><option value="c" selected>C<\/option>/);
  assert.match(await ssr("ModelSelect"), /<select id="model"><option value="s">s<\/option><option value="m" selected>m<\/option>/);
  assert.match(await ssr("ModelMultiple"), /<option value="a">A<\/option><option value="b" selected>B<\/option>/);
});

const dom = compile(source, { target: "dom", filename: "fixture.tsx" });
assert.deepEqual(dom.diagnostics, []);
const domFiles: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/": `<!doctype html><body><div id="host"></div><script>${PROBE}</script><script type="module">
import { mount } from "/dom.ts";
import * as m from "/fixture.mjs";
const host = document.getElementById("host");
for (const name of ${JSON.stringify(names)}) mount(() => m[name](), host.appendChild(document.createElement("div")));
window.ready = true;
</script></body>`,
};
const values = (page: import("playwright").Page, id: string) =>
  page.$eval("#" + id, (s) => [...(s as HTMLSelectElement).selectedOptions].map((o) => o.value));

test("DOM: select value applies after the options exist, follows the signal and reapplies when options change", async () => {
  await withPage(domFiles, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    await page.waitForFunction(() => (window as { ready?: boolean }).ready);
    assert.deepEqual(await values(page, "static"), ["b"]);
    assert.deepEqual(await values(page, "text"), ["c"]);
    assert.deepEqual(await values(page, "mapped"), ["l"]);
    assert.deepEqual(await values(page, "multiple"), ["a", "c"]);
    await page.click("#pick-s");
    // The page's first mouse click flushes one task later (`_dispatch`).
    await page.waitForFunction(() => (document.querySelector("#mapped") as HTMLSelectElement).value === "s");
    assert.deepEqual(await values(page, "mapped"), ["s"]);
    // model:value both ways.
    assert.deepEqual(await values(page, "model"), ["m"]);
    await page.selectOption("#model", "s");
    assert.equal(await page.textContent("#model-out"), "s");
    await page.click("#model-l");
    assert.deepEqual(await values(page, "model"), ["l"]);
    // multiple model: an array of values.
    assert.deepEqual(await values(page, "model-multiple"), ["b"]);
    await page.selectOption("#model-multiple", ["a", "c"]);
    assert.equal(await page.textContent("#multiple-out"), "a,c");
    // Options rendered after the binding.
    await page.click("#load");
    await page.waitForFunction(() => (document.querySelector("#late") as HTMLSelectElement).value === "y");
    assert.deepEqual(errors, []);
  });
});

const resumeDom = compileResume(source, "dom", "src/jsx-attrs.tsx");
const resumeServer = await importServer<Record<Name, Component>>(compileResume(source, "server", "src/jsx-attrs.tsx").code);
const byComponent = symbolChunks(resumeDom.symbols);
const resumeFiles: Record<string, Served> = {
  "/fixture.mjs": rewrite(resumeDom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume();',
};
for (const [path, symbols] of Object.entries(byComponent)) resumeFiles[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
const manifest: ResumeManifest = {
  hash: "test",
  runtime: "/rt.js",
  symbols: symbolUrls(resumeDom.symbols),
};
for (const name of names)
  resumeFiles["/" + name] =
    "<!doctype html><html><head><script>" + PROBE + "</script></head><body>" + (await resumableToString(() => resumeServer[name]() as never, { manifest })) + "</body></html>";

test("resume: SSR selects the option; model:value on select syncs through delegated input events", async () => {
  await withPage(resumeFiles, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/ModelSelect");
    assert.deepEqual(await values(page, "model"), ["m"]);
    await page.selectOption("#model", "s");
    await page.waitForFunction(() => document.querySelector("#model-out")!.textContent === "s");
    await page.click("#model-l");
    await page.waitForFunction(() => (document.querySelector("#model") as HTMLSelectElement).value === "l");
    await page.goto("http://rivet.test/ModelMultiple");
    assert.deepEqual(await values(page, "model-multiple"), ["b"]);
    await page.selectOption("#model-multiple", ["a", "c"]);
    await page.waitForFunction(() => document.querySelector("#multiple-out")!.textContent === "a,c");
    await page.goto("http://rivet.test/MappedSelect");
    assert.deepEqual(await values(page, "mapped"), ["l"]);
    await page.click("#pick-s");
    await page.waitForFunction(() => (document.querySelector("#mapped") as HTMLSelectElement).value === "s");
    assert.deepEqual(errors, []);
  });
});

const probe = (page: import("playwright").Page) =>
  page.evaluate(() => {
    const el = document.querySelector("#probe")!;
    return [(el as unknown as { label: string }).label, el.textContent, el.getAttribute("label"), el.getAttribute("items"), (document.querySelector("#unsafe") as HTMLAnchorElement).href];
  });

test("server: prop: and on: render nothing", async () => {
  assert.equal(await ssr("Custom"), '<main><x-probe id="probe"></x-probe><output id="hits">0</output><a id="unsafe">x</a><button id="more">more</button></main>');
});

test("DOM: prop: sets properties (re-set on signal change); on: listens for custom events of any case", async () => {
  await withPage(domFiles, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    await page.waitForFunction(() => (window as { ready?: boolean }).ready);
    assert.deepEqual(await probe(page), ["hello", "a", null, null, "about:invalid#rivet"]);
    await page.click("#probe");
    assert.equal(await page.textContent("#hits"), "101");
    await page.click("#more");
    // The page's first Rivet-handled mouse click flushes one task later (`_dispatch`).
    await page.waitForFunction(() => document.querySelector("#probe")!.textContent === "a,b");
    assert.equal(await page.textContent("#probe"), "a,b");
    assert.deepEqual(errors, []);
  });
});

test("resume: prop: values are set at boot and stay bound; on: custom events resume through delegation", async () => {
  assert.match(resumeFiles["/Custom"] as string, /<x-probe id="probe" data-r="\d+"><\/x-probe>/);
  await withPage(resumeFiles, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/Custom");
    await page.waitForFunction(() => (document.querySelector("#probe") as unknown as { label?: string }).label === "hello");
    assert.deepEqual(await probe(page), ["hello", "a", null, null, "about:invalid#rivet"]);
    await page.click("#probe");
    await page.waitForFunction(() => document.querySelector("#hits")!.textContent === "101");
    await page.click("#more");
    await page.waitForFunction(() => document.querySelector("#probe")!.textContent === "a,b");
    assert.deepEqual(errors, []);
  });
});

test("pay-per-use: the resume runtime entries carry no select-model or prop: code", async () => {
  const { rolldown } = await import("rolldown");
  for (const entry of ["../dom-resume.ts", "../server-resume.ts"]) {
    const bundle = await rolldown({
      input: new URL(entry, import.meta.url).pathname, platform: "node", logLevel: "silent",
      external: [/^node:/], resolve: { conditionNames: ["import", "production", "default"] },
      transform: { define: { "process.env.NODE_ENV": '"production"' } },
    });
    const { output } = await bundle.generate({ format: "esm", minify: true });
    for (const marker of ["selectedOptions", "defaultSelected", "MutationObserver", "Unsafe property name"])
      assert.ok(!output[0].code.includes(marker), `${entry} contains ${marker}`);
  }
});

const dialogs = async (page: import("playwright").Page) => {
  await page.waitForFunction(() => (document.querySelector("#mixed") as HTMLInputElement).indeterminate);
  await page.evaluate(() => {
    const dialog = document.querySelector("#dlg") as HTMLDialogElement;
    dialog.showModal();
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    dialog.close();
  });
  await page.waitForFunction(() => document.querySelector("#log")!.textContent === "cancel;close;");
  await page.click("#sum");
  await page.waitForFunction(() => document.querySelector("#log")!.textContent === "cancel;close;toggle:open;");
  await page.click("#unmix");
  await page.waitForFunction(() => !(document.querySelector("#mixed") as HTMLInputElement).indeterminate);
};

test("dialog/details events and prop:indeterminate: server omits, DOM and resume work", async () => {
  assert.match(await ssr("Dialogs"), /<input id="mixed" type="checkbox"><button id="unmix">/);
  assert.match(resumeFiles["/Dialogs"] as string, /<input id="mixed" type="checkbox" data-r="\d+">/);
  await withPage(domFiles, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    await page.waitForFunction(() => (window as { ready?: boolean }).ready);
    await dialogs(page);
    assert.deepEqual(errors, []);
  });
  await withPage(resumeFiles, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/Dialogs");
    await dialogs(page);
    assert.deepEqual(errors, []);
  });
});
