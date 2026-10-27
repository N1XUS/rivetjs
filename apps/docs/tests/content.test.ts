import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "@rivetjs/compiler";
import { splitFrontmatter, validateFrontmatter } from "@rivetjs/docs-kit/tools/content/frontmatter.ts";
import { createHighlight } from "@rivetjs/docs-kit/tools/content/highlight.ts";
import { internalHref, renderMarkdown, slugger, type RenderContext } from "@rivetjs/docs-kit/tools/content/markdown.ts";
import { glossaryTerms } from "@rivetjs/docs-kit/tools/content/generate.ts";
import { loadTokenizer } from "@rivetjs/docs-kit/components/highlighter.ts";

const highlight = await createHighlight();
const context = (extra: Partial<RenderContext> = {}): RenderContext => ({
  path: "guides/sample",
  highlight,
  terms: new Map([["resume", { title: "Resume", definition: "The browser continues from server HTML." }]]),
  examples: new Set(["counter"]),
  starters: new Set(["starter-static"]),
  ...extra,
});
/** Compile a page body the way generated routes are compiled (server target). */
const serverHTML = (jsx: string): string => {
  const result = compile(`export default function P() { return <div>${jsx}</div>; }`, { filename: "p.tsx", target: "server" });
  assert.deepEqual(result.diagnostics, []);
  return result.code;
};

test("frontmatter: parses scalars and lists, validates the schema", () => {
  const { raw, body } = splitFrontmatter('---\ntitle: "Signals: values"\ndescription: Short.\ntags: [state, basics]\nstatus: experimental\n---\nBody\n', "x.md");
  assert.equal(body, "Body\n");
  const fm = validateFrontmatter(raw, "x.md");
  assert.deepEqual(fm, { title: "Signals: values", description: "Short.", template: "page", status: "experimental", tags: ["state", "basics"], related: [] });
  assert.throws(() => validateFrontmatter({ title: "x" }, "x.md"), /"description" is required/);
  assert.throws(() => validateFrontmatter({ title: "x", description: "y".repeat(161) }, "x.md"), /max 160/);
  assert.throws(() => validateFrontmatter({ title: "x", description: "y", colour: "red" }, "x.md"), /unknown frontmatter field "colour"/);
  assert.throws(() => validateFrontmatter({ title: "x", description: "y", template: "stub" }, "x.md"), /stub pages must have status: planned/);
  assert.throws(() => splitFrontmatter("no frontmatter", "x.md"), /missing frontmatter/);
});

test("frontmatter: flow lists wrapped across indented lines (prettier)", () => {
  const source = "---\ntitle: T\nrelated:\n  [a/b, c/d]\ntags: [x,\n  y]\ndescription: D\n---\n";
  const { raw } = splitFrontmatter(source, "x.md");
  assert.deepEqual(raw.related, ["a/b", "c/d"]);
  assert.deepEqual(raw.tags, ["x", "y"]);
  assert.equal(raw.description, "D");
  assert.throws(() => splitFrontmatter("---\ntitle: T\ntags: [x,\ndescription: D\n---\n", "x.md"), /x\.md:3: unterminated list for tags/);
});

test("markdown: text that looks like JSX stays text after compilation", () => {
  const { jsx } = renderMarkdown("Use `<Async>` and {braces} & 1 < 2?\n", context());
  assert.match(jsx, /&lt;Async&gt;/);
  assert.throws(() => renderMarkdown("<b>raw</b>\n", context()), /raw HTML is not supported/);
  const out = serverHTML(renderMarkdown("Use `<Async>` and {braces} & more.\n", context()).jsx);
  assert.match(out, /<code>&lt;Async&gt;<\/code> and \{braces\} &amp; more\./);
});

test("markdown: headings get unique slugs and anchors; h1 is rejected", () => {
  const { jsx, headings } = renderMarkdown("## Load data\n\n### Options\n\n## Load data\n", context());
  assert.deepEqual(headings, [
    { depth: 2, id: "load-data", text: "Load data" },
    { depth: 3, id: "options", text: "Options" },
    { depth: 2, id: "load-data-1", text: "Load data" },
  ]);
  assert.match(jsx, /<h2 id="load-data"><a class="heading-anchor" href="#load-data">Load data<Icon icon=\{Link\} size=\{20\} class="anchor-icon" \/><\/a><\/h2>/);
  assert.throws(() => renderMarkdown("# Title\n", context()), /frontmatter `title`/);
  const slug = slugger();
  assert.equal(slug("What's `signal()`?"), "whats-signal");
});

test("markdown: build-time tokens colour a block (fragments of lean pages) and mark it data-hl", async () => {
  const tokens = await loadTokenizer(["tsx", "bash"]);
  const { jsx } = renderMarkdown("```tsx\nconst a = 1;\n```\n\n```yaml\na: 1\n```\n", context({ tokens }));
  const [coloured, plain] = jsx.split("<pre").slice(1);
  assert.match(coloured!, /data-hl=""/);
  assert.match(coloured!, /<span class="hl-[0-9a-f]+ hd-[0-9a-f]+">const<\/span>/);
  assert.doesNotMatch(plain!, /data-hl/);
});

test("markdown: code blocks keep newlines and indentation through the compiler", () => {
  const { jsx, uses } = renderMarkdown('```tsx title="src/a.tsx"\nconst a = 1;\n  if (a) {} // [!code highlight]\n```\n', context());
  assert.ok(uses.has("CopyButton"));
  assert.match(jsx, /<div class="code-head"><span class="code-lang">tsx<\/span><span class="code-title">src\/a\.tsx<\/span><span class="code-grow" \/><CopyButton \/><\/div>/);
  assert.match(jsx, /class="line mark-highlight"/);
  assert.doesNotMatch(jsx, /\[!code/);
  const out = serverHTML(jsx.replace("<CopyButton />", "").replace(/<Icon [^>]*\/>/g, ""));
  // Plain lines (coloured after prerender, tools/highlight-pages.ts): newline and indentation kept, the mark on its line.
  assert.match(out, /<span class=\\"line\\">const a = 1;<\/span>\\n<span class=\\"line mark-highlight\\">  if \(a\) \{\}<\/span>/);
});

test("markdown: fence meta — Avoid / Prefer headers, file tabs for adjacent fences of one group", () => {
  const verdict = renderMarkdown('```ts avoid title="bad.ts"\nlet a = 1;\n```\n\n```ts prefer\nconst a = 1;\n```\n', context());
  assert.match(verdict.jsx, /<figure class="code-block code-avoid" data-lang="ts"><div class="code-head"><span class="code-pill"><Icon icon=\{CircleX\} size=\{14\} \/>Avoid<\/span><span class="code-lang">ts<\/span><span class="code-title">bad\.ts<\/span>/);
  assert.match(verdict.jsx, /class="code-block code-prefer"[^]*Prefer<\/span><span class="code-lang">ts<\/span><span class="code-grow" \/>/);
  assert.deepEqual([...verdict.icons].sort(), ["CircleCheck", "CircleX"]);
  const tabs = renderMarkdown('```ts group="app" title="a.ts"\nexport const a = 1;\n```\n\n```tsx group="app" title="b.tsx"\nexport const b = 2;\n```\n\n```ts group="other"\nconst c = 3;\n```\n', context());
  assert.equal(tabs.jsx.match(/<figure /g)?.length, 2, "two fences of one group = one figure; a lone group fence stays plain");
  assert.match(tabs.jsx, /<input type="radio" name="code-tabs-1" id="code-tabs-1-0" value="0" checked \/><label for="code-tabs-1-0">a\.ts<\/label><input type="radio" name="code-tabs-1" id="code-tabs-1-1" value="1" \/><label for="code-tabs-1-1">b\.tsx<\/label>/);
  assert.equal(tabs.jsx.match(/<div class="code-tab-panel" data-panel="\d">/g)?.length, 2);
  assert.equal(tabs.jsx.match(/<CopyButton \/>/g)?.length, 2, "one copy button per tab set (in its header) + the plain fence");
});

test("markdown: compiled fences carry the real compiler output, CSS-only switches", () => {
  const source =
    'import { signal } from "@rivetjs/reactivity";\nexport default function C() {\n  const n = signal(0);\n  return <button onClick={() => n.update((v) => v + 1)}>{n()}</button>;\n}\n';
  const stacked = renderMarkdown('```tsx compiled title="C.tsx"\n' + source + "```\n", context());
  assert.match(stacked.jsx, /<figure class="code-block code-compiled" data-lang="tsx" data-layout="stacked">/);
  assert.match(stacked.jsx, /<label class="code-switch code-show"><input type="checkbox" role="switch" class="code-switch-input" \/>/);
  assert.match(stacked.jsx, /<pre tabIndex=\{0\} data-pane="dom"[^>]*>/);
  assert.match(stacked.jsx, /<pre tabIndex=\{0\} data-pane="server"[^>]*>/);
  assert.match(stacked.jsx, /class="[^"]*code-rv[^"]*">__rivet/, "compiler-inserted names are marked");
  assert.match(stacked.jsx, /<div class="code-out" data-pagefind-ignore="">/);
  const open = renderMarkdown("```tsx compiled open\n" + source + "```\n", context());
  assert.match(open.jsx, /class="code-switch-input" checked \/>/);
  const tabs = renderMarkdown('```tsx compiled="tabs" title="src/C.tsx"\n' + source + "```\n", context());
  assert.match(tabs.jsx, /data-layout="tabs"/);
  assert.match(
    tabs.jsx,
    /<label for="compiled-1-source">C\.tsx<\/label>[^]*<label for="compiled-1-dom">dom\.js<\/label>[^]*<label for="compiled-1-server">server\.js<\/label>/,
  );
  assert.match(tabs.jsx, /code-split/);
  // Fragments share the home page: their radio groups carry the fragment name.
  const fragment = renderMarkdown('```tsx compiled="tabs"\n' + source + "```\n", { ...context(), path: "_home-hero" });
  assert.match(fragment.jsx, /name="home-hero-compiled-1" id="home-hero-compiled-1-source"/);
  assert.throws(() => renderMarkdown("```ts compiled\nconst a = 1;\n```\n", context()), /needs a tsx or jsx fence/);
  assert.throws(() => renderMarkdown('```tsx compiled="side"\nconst a = 1;\n```\n', context()), /compiled/);
  // The page compiles (server target) with the switches and panes intact.
  assert.match(serverHTML(stacked.jsx.replace(/<CopyButton \/>/g, "").replace(/<Icon [^>]*\/>/g, "")), /code-switch-input/);
});

test("markdown: internal links get a trailing slash and full-load navigation; .md links resolve", () => {
  assert.equal(internalHref("../learn/signals.md#why", "guides/state/signals"), "/guides/learn/signals/#why");
  assert.equal(internalHref("/learn/signals.md", "guides/x"), "/learn/signals/");
  assert.equal(internalHref("/learn/signals", "guides/x"), "/learn/signals/");
  assert.equal(internalHref("#top", "guides/x"), "#top");
  assert.equal(internalHref("/start/tutorial/index.md", "x"), "/start/tutorial/");
  const { jsx, links } = renderMarkdown("[Signals](/learn/signals) and [Vite](https://vite.dev)\n", context());
  assert.deepEqual(links, ["/learn/signals/"]);
  assert.match(jsx, /<a href="\/learn\/signals\/" data-rivet-reload="">Signals<\/a>/);
  assert.match(jsx, /<a href="https:\/\/vite\.dev" rel="noopener">Vite<\/a>/);
});

test("markdown: directives — callouts, examples, terms, starters; unknown references fail", () => {
  const { jsx, uses } = renderMarkdown(':::warning[Careful]\nText\n:::\n\n::example{id=counter}\n\nThe page :term[resumes]{id=resume}. Press :kbd[Esc]. A ratio 3:2 stays.\n\n::starter{template=starter-static}\n', context());
  assert.match(jsx, /<aside class="callout callout-warning" aria-label="Careful"><p class="callout-title"><Icon icon=\{TriangleAlert\} size=\{18\} \/>Careful<\/p><p>Text<\/p><\/aside>/);
  assert.match(jsx, /<Example id="counter" example=\{data.examples\["counter"\]\} \/>/);
  assert.match(jsx, /<a class="term" href="\/reference\/glossary\/#resume" title="The browser continues from server HTML\." data-rivet-reload="">resumes<\/a>/);
  assert.match(jsx, /<kbd>Esc<\/kbd>/);
  assert.match(jsx, /3:2 stays/);
  assert.match(jsx, /<StarterButton template="starter-static" \/>/);
  assert.deepEqual([...uses].sort(), ["Example", "StarterButton"]);
  assert.throws(() => renderMarkdown("::example{id=nope}\n", context()), /unknown example "nope"/);
  assert.throws(() => renderMarkdown("A :term[thing].\n", context()), /unknown glossary term "thing"/);
  assert.throws(() => renderMarkdown(":::aside\nx\n:::\n", context()), /unknown container directive/);
  assert.throws(() => renderMarkdown("::api{symbol=x#y}\n", context({ symbols: new Map() })), /unknown API symbol/);
  // The card data is a literal in the page: the browser has no API model (client navigation renders the page there).
  const card = { name: "y", kind: "function", entry: "x", href: "/api/x/y/", summary: "Does y.", signature: "y(): void", runs: "Runs on the server" };
  assert.match(renderMarkdown("::api{symbol=x#y}\n", context({ symbols: new Map([["x#y", card]]) })).jsx, /<ApiCard card=\{\{"name":"y","kind":"function"[^}]*"runs":"Runs on the server"\}\} \/>/);
});

test("markdown: tables and task lists", () => {
  const { jsx } = renderMarkdown("| Name | Default |\n| :-- | --: |\n| `when` | `idle` |\n\n- [x] done\n- [ ] todo\n", context());
  assert.match(jsx, /<th class="text-left" scope="col">Name<\/th><th class="text-right" scope="col">Default<\/th>/);
  assert.match(jsx, /<input type="checkbox" disabled checked=\{true\} \/> done/);
});

test("glossary: each ## heading with its first paragraph", () => {
  const terms = glossaryTerms("## Signal\n\nA value that tells its readers when it changes.\n\nMore.\n\n## Resume\nThe browser *continues* from [server HTML](/x).\n");
  assert.deepEqual([...terms], [
    ["signal", { title: "Signal", definition: "A value that tells its readers when it changes." }],
    ["resume", { title: "Resume", definition: "The browser continues from server HTML." }],
  ]);
});
