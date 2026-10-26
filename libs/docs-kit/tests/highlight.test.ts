// Code highlighting: plain server lines (tools/content/highlight.ts `codeLines`), coloured by the browser highlighter
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

test("highlightHTML (build pass, tools/highlight-pages.ts): same markup as the browser highlighter; data-src left, unknown languages plain", async () => {
  const { highlightHTML, pageTokenizer } = await import("../tools/highlight-pages.ts");
  const tokenize = await pageTokenizer();
  const sources: [string, string, string?][] = [
    [readFileSync(resolve(import.meta.dirname, "../components/Example.tsx"), "utf8").slice(0, 6_000), "tsx"],
    ['<a href="x">&amp; "q"</a>\n', "html"],
    ["const _el$1 = __rivetTpl(); // [!code highlight]\n", "js", ' data-rv=""'],
  ];
  for (const [code, lang, attrs] of sources) {
    const pre = block(code, lang, attrs);
    const stats = { blocks: 0, plain: 0, left: 0 };
    const host = window.document.createElement("div");
    host.innerHTML = highlightHTML(pre.outerHTML, tokenize, stats);
    await highlightPre(pre);
    assert.equal(stats.blocks, 1, lang);
    assert.ok(host.querySelector("pre")!.hasAttribute("data-hl"), lang);
    assert.equal(host.querySelector("code")!.innerHTML, pre.querySelector("code")!.innerHTML, lang);
  }
  const stats = { blocks: 0, plain: 0, left: 0 };
  const src = '<pre data-lang="html" data-src="/x/"><code></code></pre>';
  assert.equal(highlightHTML(src, tokenize, stats), src);
  const txt = block("some text\n", "txt").outerHTML;
  assert.match(highlightHTML(txt, tokenize, stats), /^<pre data-lang="txt" data-hl=""><code><span class="line">some text<\/span><\/code><\/pre>$/);
  assert.deepEqual(stats, { blocks: 0, plain: 1, left: 1 });
});
