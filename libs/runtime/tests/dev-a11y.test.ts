// Development a11y checks (dev/a11y.ts through the dev DOM façade): each rule warns once per element
// on client-rendered markup, later mutations are audited too, the opt-out silences them, and the
// production bundle contains none of it.
import { test } from "vitest";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { compile } from "@rivetjs/compiler";
import { sourceStamps } from "../../compiler/hot.ts";

const here = new URL(".", import.meta.url).pathname;
async function bundle(source: string, conditions: string[]): Promise<string> {
  const result = await build({
    stdin: { contents: source, resolveDir: here, loader: "ts" },
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    conditions,
    logLevel: "silent",
  });
  return result.outputFiles[0]!.text;
}

const source = `
  import { signal } from "@rivetjs/reactivity";
  import { mount } from "@rivetjs/runtime/dom";
  export const late = signal(false);
  function Bad() {
    const n = signal(0);
    return (
      <section>
        <img src="/a.png" />
        <img src="/b.png" alt="" />
        <div id="clicky" onClick={() => n.update((v) => v + 1)}>click me</div>
        <div id="ok-click" role="button" tabIndex={0} onClick={() => n.update((v) => v + 1)} onKeyDown={() => {}}>fine</div>
        <span tabIndex={2}>jump</span>
        <label>Orphan</label>
        <label for="missing">Nowhere</label>
        <label>Wrapped <input /></label>
        <label class="switch">Dark mode <input type="checkbox" role="switch" class="switch-input" /></label>
        <label><input type="checkbox" role="switch" class="nameless-switch" /><select><option>Only option text</option></select></label>
        <label id="group-label">Volume</label>
        <div role="group" aria-labelledby="group-label"><input type="range" aria-labelledby="group-label" /></div>
        <button id="icon"></button>
        <button aria-label="Close"></button>
        <a href="/x"><img src="/i.png" alt="Home" /></a>
        <div aria-labelledby="nope">x</div>
        <div id="soon-owner" aria-describedby="soon">pending</div>
        <div id="dropped-owner" aria-describedby="dropped">dropped</div>
        <div role="listbox" onClick={() => n.update((v) => v + 1)}><div role="option" aria-selected="false">delegated</div></div>
        <p id="dup">one</p>
        <p id="dup">two</p>
        <div aria-hidden="true"><img src="/hidden.png" /></div>
        {late() ? <img id="later" src="/late.png" /> : null}
      </section>
    );
  }
  export async function run() {
    const warnings = [];
    const original = console.warn;
    console.warn = (message) => warnings.push(String(message));
    mount(() => <Bad />, document.querySelector("#host"));
    // A referenced element that mounts a moment later (a popover chunk), an id the owner drops after mount (slot ids).
    setTimeout(() => document.body.append(Object.assign(document.createElement("p"), { id: "soon" })), 20);
    queueMicrotask(() => queueMicrotask(() => document.querySelector("#dropped-owner").removeAttribute("aria-describedby")));
    await new Promise((r) => setTimeout(r, 150));
    // The IDREF verdict lands SETTLE (100 ms) after the last audited mutation (the append at 20 ms): wait for it, not a
    // fixed margin (a slow CI host missed the 150 ms one).
    for (let i = 0; i < 60 && !warnings.some((w) => w.includes("[aria-idref]")); i++) await new Promise((r) => setTimeout(r, 50));
    const first = warnings.length;
    late.set(true);
    await new Promise((r) => setTimeout(r, 150));
    document.querySelector("#icon").setAttribute("aria-label", "Settings");
    document.querySelector("#clicky").setAttribute("tabindex", "5");
    await new Promise((r) => setTimeout(r, 150));
    console.warn = original;
    return JSON.stringify({ warnings, first, hooked: (globalThis.events || []).filter(([t]) => t === "a11y").length });
  }`;

async function run(code: string, html = '<div id="host"></div>'): Promise<{ warnings: string[]; first: number; hooked: number }> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(`globalThis[Symbol.for("rivet.devtools")] = { v: 1, level: 0, stacks: false, emit(type, data) { (globalThis.events ??= []).push([type, data]); } };`);
    await page.route("http://rivet.test/**", (route) =>
      route.fulfill(new URL(route.request().url()).pathname === "/app.mjs" ? { body: code, contentType: "text/javascript" } : { body: html, contentType: "text/html" }),
    );
    await page.goto("http://rivet.test/");
    return JSON.parse(await page.evaluate(async () => ((await import("/app.mjs" as string)) as { run(): Promise<string> }).run()));
  } finally {
    await browser.close();
  }
}

// The dev façade records `_on` / `_listen` event types for the click-events rule.
const compiled = compile(source, { target: "dom", filename: "bad.tsx" });
// What the Vite plugin appends to dev client modules: where each component is declared (warnings name it).
compiled.code += sourceStamps(source.replace(/^  /gm, ""), "src/bad.tsx", compiled.code);

test("dev a11y: each rule warns once per element, with the fix", async () => {
  assert.deepEqual(compiled.diagnostics, []);
  const { warnings, first, hooked } = await run(await bundle(compiled.code, ["development"]));
  const rules = (list: string[]) => list.map((w) => /\[([a-z-]+)\]/.exec(w)?.[1]).sort();
  assert.deepEqual(rules(warnings.slice(0, first)), [
    "accessible-name", // <button id="icon">
    "accessible-name", // .nameless-switch: the label's only text is inside its <select>
    "aria-idref", // aria-labelledby="nope"
    "click-events", // #clicky
    "duplicate-id", // second #dup
    "img-alt", // /a.png (alt="" and aria-hidden subtrees pass)
    "label-control", // orphan label
    "label-control", // for="missing"
    "tabindex-positive", // tabIndex={2}
  ]);
  const text = warnings.join("\n");
  assert.match(text, /Rivet a11y \[img-alt\]: <img> has no alt attribute — describe the image \(alt="…"\), or mark it decorative with alt=""\./);
  assert.match(text, /onClick on <div id="clicky">, which is not focusable or keyboard-operable — use a <button> \(or <a href>\), or add role="button", tabIndex=\{0\}, an onKeyDown handler for Enter \/ Space\./);
  assert.match(text, /<label for="missing"> points at no element with id "missing"/);
  assert.match(text, /duplicate id "dup"/);
  // IDREFs are judged once the document settles; a composite widget's delegated click is keyboard-operable.
  assert.doesNotMatch(text, /soon-owner|dropped-owner/);
  assert.doesNotMatch(text, /role="listbox"|delegated/);
  // A `for`-less label naming a group / control through aria-labelledby (React Aria Slider / RadioGroup) is associated.
  assert.doesNotMatch(text, /<label id="group-label">/);
  // Later renders are audited; fixed elements stay quiet, rules already reported do not repeat.
  assert.deepEqual(rules(warnings.slice(first)), ["img-alt", "tabindex-positive"]);
  assert.match(warnings.at(-1)!, /tabIndex=\{5\} on <div id="clicky">/);
  // DIAG-VERBOSE: every warning names the component that rendered the element (declaration site from the dev stamps),
  // the element's CSS path and the docs page.
  const img = warnings.find((w) => w.startsWith("Rivet a11y [img-alt]"))!;
  assert.match(img, /\n  in <Bad> \(src\/bad\.tsx:5:10\)\n  element: div#host > section > img\n  docs: https:\/\/\S+#accessibility-warnings$/);
  // A control nested in a <label> is named by the label's text (was a false accessible-name warning).
  assert.doesNotMatch(text, /switch-input/);
  // …but only by the label's own text: an <option> of another control in the label does not name it.
  assert.match(text, /\[accessible-name\]: <input class="nameless-switch"> \(role="switch"\) has no accessible name/);
  assert.equal(hooked, warnings.length, "reported to the devtools hook");
});

test("dev a11y: <html data-rivet-a11y=off> opts out", async () => {
  const { warnings } = await run(await bundle(compiled.code, ["development"]), '<html data-rivet-a11y="off"><body><div id="host"></div></body></html>');
  assert.deepEqual(warnings, []);
});

test("production (default resolution) carries no a11y checks", async () => {
  const production = await bundle(compiled.code, []);
  assert.doesNotMatch(production, /Rivet a11y|data-rivet-a11y/);
  const { warnings } = await run(production);
  assert.deepEqual(warnings, []);
});

test("production (default resolution) of /dev/a11y exports the same functions as no-ops", async () => {
  // X5: the `types` target promised noteEvent/checkElement/checkTree; the default file must provide them.
  const production = await bundle(
    `import { noteEvent, checkElement, checkTree, start } from "@rivetjs/runtime/dev/a11y";
     const el = { localName: "img" };
     export const results = [noteEvent(el, "click"), checkElement(el), checkTree(el), start()];`,
    [],
  );
  assert.doesNotMatch(production, /Rivet a11y|MutationObserver/);
  const module = await import("data:text/javascript," + encodeURIComponent(production));
  assert.deepEqual(module.results, [undefined, undefined, undefined, undefined]);
});
