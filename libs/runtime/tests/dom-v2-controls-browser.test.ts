// DOM controls in Chromium: the controls runtime (`dom-v2-controls.ts`: `_select`, `_model`, `_rcdata`),
// `_setProp`, global events and namespaces (SVG `<title>`, `foreignObject` HTML content, MathML)
// (compiler unit coverage: libs/compiler/tests/dom-v2-gaps.test.ts).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "@rivetjs/compiler";
import { withPage, rewrite } from "./resume/harness.ts";

const source = `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
export const s = { items: signal(["a", "b"]), pick: signal("b"), text: signal("hi"), on: signal(true), tip: signal("tip"), n: signal(1), log: [] as string[] };
export const Page = () => (
  <main>
    <select id="sel" value={s.pick()}><For each={s.items} by={(x) => x}>{(x) => <option value={x()}>{x()}</option>}</For></select>
    <select id="model" model:value={s.pick}><option value="a">A</option><option value="b">B</option><option value="c">C</option></select>
    <input id="text" model:value={s.text} />
    <input id="box" type="checkbox" model:checked={s.on} prop:indeterminate={s.n() > 1} />
    <textarea id="area">n={s.n()}</textarea>
    <svg viewBox="0 0 2 2"><title>{s.tip()}</title><foreignObject width="2" height="2"><div id="fo">html</div></foreignObject>{s.on() ? <title>{s.tip()}</title> : null}</svg>
    <math><mrow><mi id="mi">{s.tip()}</mi></mrow></math>
    <span hidden window:onResize={() => s.log.push("resize")}></span>
  </main>
);`;
const v2 = compile(source, { target: "dom", filename: "controls.tsx" });
assert.deepEqual(v2.diagnostics, []);
assert.doesNotMatch(v2.code, /__rivetSpec\d/, "the whole page lowers through v2");
const page = (module: string): string => `<!doctype html><html><body><div id="app"></div><script type="module">
    import { mount } from "/dom.ts"; import { Page, s } from "${module}";
    window.s = s; mount(() => Page(), document.getElementById("app"));
  </script></body></html>`;

test("v2 controls, prop:, global events and SVG / MathML namespaces in Chromium", async () => {
  await withPage({ "/v2.mjs": rewrite(v2.code), "/v2": page("/v2.mjs") }, async (browser) => {
    const results: unknown[] = [];
    for (const path of ["/v2"]) {
      await browser.goto("http://rivet.test" + path);
      await browser.waitForFunction(() => document.querySelector("main"));
      // Real typing (keyboard events) into the model input; IME composition through events.
      await browser.fill("#text", "typed");
      results.push(
        await browser.evaluate(async () => {
          const s = (window as unknown as { s: Record<string, any> }).s;
          const $ = <T extends Element>(q: string) => document.querySelector(q) as unknown as T;
          const tick = () => new Promise((r) => setTimeout(r, 0));
          const out: unknown[] = [$<HTMLSelectElement>("#sel").value, $<HTMLSelectElement>("#model").value, s.text()];
          s.items.set(["a", "b", "c"]);
          s.pick.set("c");
          await tick();
          out.push($<HTMLSelectElement>("#sel").value, $<HTMLSelectElement>("#model").value);
          const model = $<HTMLSelectElement>("#model");
          model.value = "a";
          model.dispatchEvent(new Event("input", { bubbles: true }));
          out.push(s.pick(), $<HTMLSelectElement>("#sel").value);
          const text = $<HTMLInputElement>("#text");
          text.dispatchEvent(new CompositionEvent("compositionstart"));
          text.value = "ime";
          text.dispatchEvent(new Event("input", { bubbles: true }));
          out.push(s.text());
          text.dispatchEvent(new CompositionEvent("compositionend"));
          out.push(s.text());
          $<HTMLInputElement>("#box").click();
          s.n.set(2);
          out.push(s.on(), $<HTMLInputElement>("#box").indeterminate, $<HTMLTextAreaElement>("#area").value);
          s.on.set(true);
          await tick();
          out.push(document.querySelectorAll("title").length > 1 && [...document.querySelectorAll("title")][1]!.namespaceURI);
          s.on.set(false);
          s.tip.set("next");
          const titles = [...document.querySelectorAll("title")];
          out.push(
            titles.map((t) => t.namespaceURI + ":" + t.textContent),
            $("#fo").namespaceURI,
            $("#mi").namespaceURI + ":" + $("#mi").textContent,
          );
          window.dispatchEvent(new Event("resize"));
          out.push(s.log.splice(0));
          return out;
        }),
      );
    }
    const SVG = "http://www.w3.org/2000/svg";
    assert.deepEqual(results[0], [
      "b",
      "b",
      "typed",
      "c",
      "c",
      "a",
      "a",
      "typed",
      "ime",
      false,
      true,
      "n=2",
      SVG,
      [SVG + ":next"], // the conditional <title> left with s.on (checkbox clicked)
      "http://www.w3.org/1999/xhtml",
      "http://www.w3.org/1998/Math/MathML:next",
      ["resize"],
    ]);
  });
});
