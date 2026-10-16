// Code highlighting: plain server lines (tools/content/highlight.ts `codeLines`), coloured in the browser
// (components/highlighter.ts `highlightPre`, Shiki core + JavaScript regex engine) with classes whose rules come
// from the themes' palettes (`highlightCSS`): every class a token gets has a rule; text and marks survive.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Window } from "happy-dom";
import { afterAll, test } from "vitest";
import { codeLines, highlightCSS } from "../tools/content/highlight.ts";

const window = new Window();
const globals = globalThis as unknown as { document?: unknown };
const before = globals.document;
globals.document = window.document;
afterAll(() => {
  globals.document = before;
  void window.happyDOM.close();
});
const { highlightPre } = await import("../components/highlighter.ts");

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
/** Server markup of a block (as markdown.ts / Example.tsx render it). */
function block(code: string, lang: string, attrs = ""): HTMLElement {
  const lines = codeLines(code)
    .map((line) => `<span class="line${line.mark ? " mark-" + line.mark : ""}">${escape(line.text)}</span>`)
    .join("\n");
  const host = window.document.createElement("div");
  host.innerHTML = `<pre data-lang="${lang}"${attrs}><code>${lines}</code></pre>`;
  return host.firstElementChild as unknown as HTMLElement;
}

test("codeLines: notation stripped into marks, trailing newline dropped", () => {
  assert.deepEqual(codeLines("a\n  b // [!code ++]\nc # [!code highlight]\n"), [{ text: "a" }, { text: "  b", mark: "add" }, { text: "c", mark: "highlight" }]);
});

test("highlightPre: every token class has a rule; text, lines and marks unchanged", async () => {
  const css = highlightCSS();
  const rules = new Set([...css.matchAll(/\.([\w-]+)\{/g)].map((match) => match[1]!));
  const sources: [string, string][] = [
    [readFileSync(resolve(import.meta.dirname, "../components/Example.tsx"), "utf8"), "tsx"],
    [readFileSync(resolve(import.meta.dirname, "../site.css"), "utf8").slice(0, 20_000), "css"],
    ['<!doctype html><html lang="en"><head><script>var a = 1;</script></head><body class="x">&amp;</body></html>\n', "html"],
    ['{ "a": [1, true, null] }\n', "json"],
    ["export PATH=/x:$PATH && npx vite build # [!code highlight]\n", "bash"],
  ];
  for (const [code, lang] of sources) {
    const pre = block(code, lang);
    const text = pre.textContent;
    await highlightPre(pre);
    assert.equal(pre.textContent, text, lang);
    assert.ok(pre.hasAttribute("data-hl"));
    const tokens = [...pre.querySelectorAll(".line span")];
    assert.ok(tokens.length > 0, `${lang}: coloured`);
    for (const token of tokens) for (const cls of token.className.split(" ")) assert.ok(rules.has(cls), `${lang}: no rule for .${cls}`);
  }
  const marked = block("const a = 1; // [!code --]\n", "ts");
  await highlightPre(marked);
  assert.equal(marked.querySelector(".line")!.className, "line mark-remove");
});

test("highlightPre: compiler names marked in `data-rv` blocks; unknown languages stay plain", async () => {
  const rv = block("const _el$1 = __rivetTpl();\n", "js", ' data-rv=""');
  await highlightPre(rv);
  assert.deepEqual(
    [...rv.querySelectorAll(".code-rv")].map((span) => span.textContent),
    ["_el$1", "__rivetTpl"],
  );
  const plain = block("some text\n", "txt");
  await highlightPre(plain);
  assert.equal(plain.querySelectorAll(".line span").length, 0);
});
