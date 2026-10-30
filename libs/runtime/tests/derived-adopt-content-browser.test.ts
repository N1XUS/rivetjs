// ADOPT-CONTENT (2026-10-26): page content under an interactive chrome. An adopt run writes nothing the server's node
// already holds: a chrome click adopts the content with its parent (a dependent child), and that run must neither reload
// an `<iframe>` (an equal `src` re-set reloads the frame) nor undo state the user gave the page before (a closed
// `<details>`, a picked radio, typed text) nor touch any other node of the content — code lines a build decorated
// with token spans under `data-rv-text` included (a static subtree with equal text is adopted as the server has it).
// Real derived server + DOM targets (skips on a wasm without the model).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import type { Page } from "playwright";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

// App (independent root): the chrome button. Content (dependent): a frame, a disclosure, two radios, a text field and a
// counter, plus Copy (a boundary of its own); Leaf (dependent). All adopt with App on the chrome click.
const PAGE = `
import { signal } from "@rivetjs/reactivity";

export function Copy() {
  const n = signal(0);
  return (
    <button type="button" id="copy" onClick={() => n.set(n() + 1)}>
      {n()}
    </button>
  );
}

export function Content(props) {
  const seen = signal(0);
  return (
    <article id="content" class={props.kind}>
      <iframe id="frame" src={props.src} title={props.title} />
      <details id="more" open={props.open}>
        <summary>More</summary>
        <p>Body</p>
      </details>
      <input type="radio" name="tab" id="tab-0" value="0" checked={props.first} />
      <input type="radio" name="tab" id="tab-1" value="1" checked={!props.first} />
      <input id="text" value={props.text} />
      <pre data-rv-text="">
        <code>
          <span class="line" id="line">{props.code}</span>
          {"\\n"}
          <span class="line">
            const <b class="code-rv">_el$1</b> = 1;
          </span>
        </code>
      </pre>
      <button type="button" id="seen" onClick={() => seen.set(seen() + 1)}>
        {seen()}
      </button>
      <Copy />
    </article>
  );
}

export function Leaf(props) {
  const k = signal(0);
  return (
    <button type="button" id="leaf" title={props.title} onClick={() => k.set(k() + 1)}>
      {k()}
    </button>
  );
}

export function App() {
  const open = signal(false);
  return (
    <main>
      <button type="button" id="chrome" aria-expanded={open() ? "true" : "false"} onClick={() => open.set(!open())}>
        Menu
      </button>
      <Leaf title="leaf" />
      <Content kind="doc" src="/frame.html" title="Example" open={true} first={true} text="server" code="let n = 1;" />
    </main>
  );
}
`;
const RESUME = { module: "src/page.tsx", boundaries: ["App", "Content", "Copy", "Leaf"], independent: ["App"] };
const symbols = Object.fromEntries(RESUME.boundaries.map((name) => ["src/page.tsx#" + name, "/page.js"]));
const manifest = { hash: "t", runtime: "/rt.js", symbols };
const alias = JSON.stringify(import.meta.resolve("@rivetjs/runtime/server-derived-reactivity"));

async function render(): Promise<string> {
  const out = compile(PAGE, { target: "server", filename: "page.tsx", resume: RESUME } as never);
  assert.deepEqual(out.diagnostics, []);
  const { App } = await importServer<{ App: () => ServerValue }>(out.code.replaceAll('"@rivetjs/reactivity"', alias));
  return (await derivedToString(() => App(), { manifest })) as string;
}
const compiled = hasDerivedModel() ? test : test.skip;

// The build's decoration (docs-kit `highlight-pages.ts`): token spans around the text of each code line.
function decorate(html: string): string {
  const out = html
    .replace(/(<span class="line" id="line">)let n = 1;/, '$1<span class="k">let</span> n <span class="o">=</span> 1;')
    .replace(/const <b class="code-rv">_el\$1<\/b> = 1;/, '<span class="k">const</span> <b class="code-rv">_el$$1</b> <span class="o">=</span> 1;');
  assert.notEqual(out, html, "decorated");
  assert.equal((out.match(/class="k"/g) ?? []).length, 2, "both lines decorated");
  return out;
}

async function files(): Promise<Record<string, string>> {
  const html = await render();
  const dom = compile(PAGE, { target: "dom", filename: "page.tsx", resume: RESUME } as never);
  assert.deepEqual(dom.diagnostics, []);
  return {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + decorate(html) + "</body></html>",
    "/frame.html": "<!doctype html><p>frame</p>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/page.js": rewrite(dom.code.replaceAll('"@rivetjs/reactivity"', '"/derived-reactivity.ts"')),
  };
}
const attached = (page: Page, selector: string): Promise<boolean> =>
  page.evaluate((s) => (document.querySelector(s) as unknown as Record<string, unknown>).$rclick !== undefined, selector);

compiled("browser: a chrome click adopts the content without reloading its frame, writing its nodes or losing state", async () => {
  await withPage(await files(), async (page) => {
    await page.goto("http://rivet.test/");
    await page.waitForFunction(() => (document.querySelector("#frame") as HTMLIFrameElement).contentDocument?.readyState === "complete");
    // State the page got before its runtime adopted the content (set without events: an event inside it would adopt it):
    // the disclosure closed, the second radio picked, text typed.
    await page.evaluate(() => {
      (document.querySelector("#more") as HTMLDetailsElement).open = false;
      (document.querySelector("#tab-1") as HTMLInputElement).checked = true;
      (document.querySelector("#text") as HTMLInputElement).value = "typed";
    });
    await page.evaluate(() => {
      const w = window as unknown as { __loads: number; __writes: string[] };
      w.__loads = 0;
      w.__writes = [];
      document.querySelector("#frame")!.addEventListener("load", () => w.__loads++);
      new MutationObserver((records) => {
        for (const r of records) {
          // (Empty comment anchors the alignment puts around a `data-b` child: inert.)
          const nodes = [...r.addedNodes, ...r.removedNodes];
          if (r.type === "childList" && nodes.every((n) => n.nodeType === 8)) continue;
          w.__writes.push(r.type + " " + ((r.target as Element).id || r.target.nodeName) + " " + (r.attributeName ?? ""));
        }
      }).observe(document.querySelector("#content")!, { subtree: true, attributes: true, childList: true, characterData: true });
    });
    await page.click("#chrome");
    await page.waitForFunction(() => document.querySelector("#chrome")!.getAttribute("aria-expanded") === "true");
    assert.equal(await attached(page, "#leaf"), true, "Leaf adopted with App");
    assert.equal(await attached(page, "#seen"), true, "Content adopted with App");
    assert.equal(await attached(page, "#copy"), true, "Copy adopted with Content");
    await page.waitForTimeout(100);
    assert.deepEqual(await page.evaluate(() => (window as unknown as { __writes: string[] }).__writes), [], "content nodes untouched");
    assert.equal(await page.evaluate(() => document.querySelectorAll("#content pre .k").length), 2, "token spans kept");
    // The adopted content works.
    await page.click("#seen");
    await page.waitForFunction(() => document.querySelector("#seen")!.textContent === "1");
    await page.click("#copy");
    await page.waitForFunction(() => document.querySelector("#copy")!.textContent === "1");
    await page.waitForTimeout(100);
    const state = await page.evaluate(() => ({
      loads: (window as unknown as { __loads: number }).__loads,
      writes: (window as unknown as { __writes: string[] }).__writes,
      open: (document.querySelector("#more") as HTMLDetailsElement).open,
      tab: (document.querySelector("#tab-1") as HTMLInputElement).checked,
      text: (document.querySelector("#text") as HTMLInputElement).value,
    }));
    assert.equal(state.loads, 0, "frame not reloaded");
    assert.deepEqual(state, { loads: 0, writes: state.writes, open: false, tab: true, text: "typed" }, "user state kept");
    assert.deepEqual(
      state.writes.filter((w) => !/^(childList|characterData) (seen|copy|#text) $/.test(w)),
      [],
      "only the counters' text changed",
    );
  });
});
