// Code highlighting: plain server lines (tools/content/highlight.ts `codeLines`), coloured by the browser highlighter
// (components/highlighter.ts `highlightPre`, Shiki core + JavaScript regex engine) through CSS Custom Highlights: the
// lines' nodes stay as the server rendered them (they belong to resumable components: a token `<span>` made their adopt
// run re-render the page, ADOPT-CONTENT), every highlight has a `::highlight()` rule, and its classes have rules in the
// build's `highlightCSS` (build-coloured fragments use the same classes).
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Window } from "happy-dom";
import { afterAll, test } from "vitest";
import { codeLines, highlightCSS } from "../tools/content/highlight.ts";
import { highlightRule } from "../components/highlight-classes.ts";

const window = new Window();
const globals = globalThis as unknown as Record<string, unknown>;
const saved = Object.fromEntries(["document", "NodeFilter", "CSSStyleSheet", "CSS", "Highlight", "StaticRange"].map((name) => [name, globals[name]]));
globals.document = window.document;
globals.NodeFilter = window.NodeFilter;
globals.CSSStyleSheet = window.CSSStyleSheet;
// happy-dom has no CSS Custom Highlight API: the registry, `Highlight` (a set of ranges) and `StaticRange`, as specified.
const highlights = new Map<string, Set<Range> & { priority: number }>();
globals.CSS = { highlights };
globals.Highlight = class extends Set<Range> {
  priority = 0;
};
globals.StaticRange = class {
  constructor(init: object) {
    Object.assign(this, init);
  }
};
afterAll(() => {
  Object.assign(globals, saved);
  void window.happyDOM.close();
});
const { highlightPre } = await import("../components/highlighter.ts");

type Piece = { startContainer: Text; startOffset: number; endContainer: Text; endOffset: number };
const textOf = (range: Piece) =>
  range.startContainer === range.endContainer
    ? range.startContainer.data.slice(range.startOffset, range.endOffset)
    : range.startContainer.data.slice(range.startOffset) + range.endContainer.data.slice(0, range.endOffset);
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Server markup of a block (as markdown.ts / Example.tsx render it). */
function block(code: string, lang: string, attrs = ""): HTMLElement {
  const lines = codeLines(code)
    .map((line) => `<span class="line${line.mark ? " mark-" + line.mark : ""}">${escape(line.text)}</span>`)
    .join("\n");
  const host = window.document.createElement("div");
  host.innerHTML = `<pre data-lang="${lang}"${attrs}><code>${lines}</code></pre>`;
  return host.firstElementChild as unknown as HTMLElement;
}
/** Ranges added to each highlight since `before` (name → texts). */
function added(before: Map<string, number>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [name, set] of highlights) {
    const texts = [...set].slice(before.get(name) ?? 0).map((range) => textOf(range as unknown as Piece));
    if (texts.length) out.set(name, texts);
  }
  return out;
}
const sizes = () => new Map([...highlights].map(([name, set]) => [name, set.size]));

test("codeLines: notation stripped into marks, trailing newline dropped", () => {
  assert.deepEqual(codeLines("a\n  b // [!code ++]\nc # [!code highlight]\n"), [{ text: "a" }, { text: "  b", mark: "add" }, { text: "c", mark: "highlight" }]);
});

test("highlightPre: markup untouched; every highlight has a rule and its classes have build rules", async () => {
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
    const markup = pre.innerHTML;
    const before = sizes();
    await highlightPre(pre);
    assert.equal(pre.innerHTML, markup, `${lang}: nodes unchanged`);
    assert.ok(pre.hasAttribute("data-hl"));
    const painted = added(before);
    assert.ok(painted.size > 0, `${lang}: coloured`);
    for (const [name, texts] of painted) {
      for (const cls of name.split("_")) assert.ok(rules.has(cls), `${lang}: no build rule for .${cls}`);
      for (const text of texts) assert.ok(text.length > 0 && code.includes(text), `${lang}: range "${text}" is code text`);
    }
  }
  // The rules the page's constructed sheet gets (happy-dom cannot parse `::highlight()`: checked as written).
  for (const name of highlights.keys()) {
    const [ruleName, rule] = highlightRule(name.replace(/_/g, " "));
    assert.equal(ruleName, name);
    assert.match(
      rule,
      name === "code-rv"
        ? /^::highlight\(code-rv\)\{color:var\(--accent-strong\)\}$/
        : /^::highlight\([\w-]+\)\{color:light-dark\(#[0-9a-f]{6},#[0-9a-f]{6}\)(;text-decoration:underline)?\}$/,
    );
  }
  const marked = block("const a = 1; // [!code --]\n", "ts");
  await highlightPre(marked);
  assert.equal(marked.querySelector(".line")!.className, "line mark-remove");
});

test("highlightPre: compiler names marked in `data-rv` blocks; unknown languages stay plain", async () => {
  const rv = block("const _el$1 = __rivetTpl();\n", "js", ' data-rv=""');
  let before = sizes();
  await highlightPre(rv);
  assert.deepEqual(added(before).get("code-rv"), ["_el$1", "__rivetTpl"]);
  assert.equal(highlights.get("code-rv")!.priority, 1, "above the token colours");
  const plain = block("some text\n", "txt");
  before = sizes();
  await highlightPre(plain);
  assert.equal(added(before).size, 0);
});

test("highlightHTML (build pass, tools/highlight-pages.ts): the browser highlighter's tokens as spans, marked decoration; data-src left, unknown languages plain", async () => {
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
    const before = sizes();
    await highlightPre(pre);
    assert.equal(stats.blocks, 1, lang);
    const built = host.querySelector("pre")!;
    assert.ok(built.hasAttribute("data-hl"), lang);
    // Token spans are decoration around the rendered text: the resumed unit adopts them (runtime `decorated`).
    assert.ok(built.hasAttribute("data-rv-text"), lang);
    assert.equal(built.textContent, pre.textContent, lang);
    // Same tokens as the browser's highlights: per class set, the same texts in order (compiler names: `code-rv`).
    const spans = new Map<string, string[]>();
    for (const span of built.querySelectorAll(".line span")) {
      const classes = span.className.split(" ");
      const name = attrs ? (classes.includes("code-rv") ? "code-rv" : null) : classes.join("_");
      if (name) spans.set(name, [...(spans.get(name) ?? []), span.textContent!]);
    }
    const painted = added(before);
    if (attrs) assert.deepEqual(spans.get("code-rv"), painted.get("code-rv"), lang);
    else assert.deepEqual(spans, painted, lang);
  }
  const stats = { blocks: 0, plain: 0, left: 0 };
  const src = '<pre data-lang="html" data-src="/x/"><code></code></pre>';
  assert.equal(highlightHTML(src, tokenize, stats), src);
  const txt = block("some text\n", "txt").outerHTML;
  assert.match(highlightHTML(txt, tokenize, stats), /^<pre data-lang="txt" data-hl=""><code><span class="line">some text<\/span><\/code><\/pre>$/);
  assert.deepEqual(stats, { blocks: 0, plain: 1, left: 1 });
});
