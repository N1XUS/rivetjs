// Browser syntax highlighter: a lazy entry + Shiki core, JavaScript regex engine and the two themes in the
// `highlighter-core` chunk (`vite.ts` `docsChunks`: kept out of this entry so rolldown's runtime does not merge here), loaded by
// highlight-browser.ts when the first code block scrolls into view; each grammar is its own chunk, loaded on first
// use. It colours the server's plain `<pre data-lang><code>` of `span.line`s WITHOUT touching their nodes: CSS Custom
// Highlights (`CSS.highlights`, one `Highlight` per token class list, `StaticRange`s over the lines' text nodes; rules
// `highlight-classes.ts` `highlightRule` in one constructed stylesheet). The lines belong to resumable components
// (`DocPage`, `Example`): a token `<span>` inside them made their adopt run fail to align with the server's markup, so
// the first chrome click (theme / mobile menu) re-rendered the page content and reloaded every example frame
// (ADOPT-CONTENT 2026-10-26). Browsers without the API keep the code plain. A block with `data-src` (an example's
// "Server HTML" tab) is first filled with that page's HTML, fetched and formatted, inside a shadow root of its
// placeholder line (again outside the component's nodes).
import { createHighlighterCore, type HighlighterCore, type LanguageInput } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import githubDark from "shiki/themes/github-dark.mjs";
import githubLight from "shiki/themes/github-light.mjs";
import { COMPILER_NAME, highlightRule, langOf, RV_HIGHLIGHT, THEMES, tokenClass, type Lang } from "./highlight-classes.ts";
import { formatHTML } from "./format-html.ts";

const GRAMMARS: Record<Lang, () => Promise<{ default: LanguageInput }>> = {
  tsx: () => import("shiki/langs/tsx.mjs"),
  ts: () => import("shiki/langs/typescript.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  js: () => import("shiki/langs/javascript.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  bash: () => import("shiki/langs/shellscript.mjs"),
  diff: () => import("shiki/langs/diff.mjs"),
  md: () => import("shiki/langs/markdown.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  dockerfile: () => import("shiki/langs/docker.mjs"),
};
/** Shiki's id of each grammar (what `codeToTokensWithThemes` takes). */
const IDS: Record<Lang, string> = {
  tsx: "tsx",
  ts: "typescript",
  jsx: "jsx",
  js: "javascript",
  json: "json",
  css: "css",
  html: "html",
  bash: "shellscript",
  diff: "diff",
  md: "markdown",
  yaml: "yaml",
  toml: "toml",
  dockerfile: "docker",
};
/** Blocks longer than this stay plain (tokenizing blocks the main thread). */
const MAX_LINES = 4000;

const state: { core?: Promise<HighlighterCore>; loaded: Map<Lang, Promise<void>> } = { loaded: new Map() };

function core(): Promise<HighlighterCore> {
  return (state.core ??= createHighlighterCore({ themes: [githubLight, githubDark], langs: [], engine: createJavaScriptRegexEngine() }));
}

async function grammar(highlighter: HighlighterCore, lang: Lang): Promise<void> {
  let loading = state.loaded.get(lang);
  if (!loading) state.loaded.set(lang, (loading = GRAMMARS[lang]().then((module) => highlighter.loadLanguage(module.default))));
  return loading;
}

/**
 * The formatted HTML of the page at `src` (same origin), as lines in a shadow root of `code`'s placeholder line (the
 * component's own nodes stay as the server rendered them); its lines, or none.
 */
async function fill(code: HTMLElement, src: string): Promise<HTMLElement[]> {
  const host = code.querySelector<HTMLElement>(".line");
  if (!host || host.shadowRoot || typeof host.attachShadow !== "function") return [];
  const response = await fetch(src, { credentials: "same-origin" });
  if (!response.ok) return [];
  const root = host.attachShadow({ mode: "open" });
  const lines = formatHTML(await response.text())
    .replace(/\n$/, "")
    .split("\n")
    .map((text, index) => {
      if (index) root.append("\n");
      const line = document.createElement("span");
      line.textContent = text;
      root.append(line);
      return line;
    });
  const sheet = paints().sheet;
  if (sheet) root.adoptedStyleSheets = [sheet];
  return lines;
}

/** The page's highlights: their constructed stylesheet (null: no CSS Custom Highlight API) and the names it has rules for. */
let painter: { sheet: CSSStyleSheet | null; names: Set<string> } | undefined;
function paints(): { sheet: CSSStyleSheet | null; names: Set<string> } {
  if (painter) return painter;
  let sheet: CSSStyleSheet | null = null;
  try {
    if (typeof CSS !== "undefined" && CSS.highlights && typeof Highlight === "function" && typeof StaticRange === "function") {
      sheet = new CSSStyleSheet();
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }
  } catch {
    sheet = null;
  }
  return (painter = { sheet, names: new Set() });
}
/** The registered highlight `cls` (rule added on first use; compiler names paint above the token colours). */
function highlightOf(cls: string): Highlight {
  const { sheet, names } = paints();
  const [name, rule] = highlightRule(cls);
  let highlight = CSS.highlights.get(name);
  if (!highlight) {
    highlight = new Highlight();
    if (cls === RV_HIGHLIGHT) highlight.priority = 1;
    CSS.highlights.set(name, highlight);
  }
  if (!names.has(name)) {
    names.add(name);
    try {
      sheet!.insertRule(rule, sheet!.cssRules.length);
    } catch {
      // (a browser that cannot parse the rule paints the token plain)
    }
  }
  return highlight;
}
/** A range over `line`'s text from `start` to `end` (character offsets across its text nodes). */
function rangeOf(texts: Text[], ends: number[], start: number, end: number): StaticRange | null {
  let a = 0;
  while (a < ends.length && ends[a]! <= start) a++;
  let b = a;
  while (b < ends.length && ends[b]! < end) b++;
  if (a >= texts.length || b >= texts.length) return null;
  const from = a ? ends[a - 1]! : 0,
    to = b ? ends[b - 1]! : 0;
  return new StaticRange({ startContainer: texts[a]!, startOffset: start - from, endContainer: texts[b]!, endOffset: end - to });
}

/** One coloured piece of a line: its text and its class list ("" = the theme's default colour). */
export interface Token {
  content: string;
  cls: string;
}

/** Tokens per line of `text` (grammar loaded); shared by the browser (`highlightPre`) and the build (`loadTokenizer`). */
function tokensOf(highlighter: HighlighterCore, text: string, lang: Lang): Token[][] {
  const lightFg = highlighter.getTheme(THEMES.light).fg;
  const darkFg = highlighter.getTheme(THEMES.dark).fg;
  const fg = { light: lightFg, dark: darkFg };
  return highlighter.codeToTokensWithThemes(text, { lang: IDS[lang], themes: THEMES }).map((tokenLine) =>
    tokenLine.map((token) => {
      const light = token.variants.light!,
        dark = token.variants.dark!;
      return { content: token.content, cls: tokenClass(light.color ?? lightFg, dark.color ?? darkFg, light.fontStyle ?? 0, fg) };
    }),
  );
}

/**
 * Build-time colouring (docs-kit content generator: fragments of lean pages, which run no highlighter in the browser):
 * loads `langs` once, then tokenizes synchronously — the same tokens and classes as `highlightPre`.
 */
export async function loadTokenizer(langs: readonly Lang[]): Promise<(text: string, lang: string) => Token[][] | undefined> {
  const highlighter = await core();
  for (const lang of langs) await grammar(highlighter, lang);
  return (text, name) => {
    const lang = langOf(name);
    return lang && langs.includes(lang) ? tokensOf(highlighter, text, lang) : undefined;
  };
}

/** Colour one `<pre data-lang>` (once: sets `data-hl`). Unknown languages, very long blocks and browsers without CSS Custom Highlights stay plain. */
export async function highlightPre(pre: HTMLElement): Promise<void> {
  if (pre.hasAttribute("data-hl")) return;
  pre.setAttribute("data-hl", "");
  const lang = langOf(pre.dataset.lang ?? "");
  const code = pre.querySelector("code");
  if (!lang || !code) return;
  const lines = pre.dataset.src
    ? await fill(code, pre.dataset.src)
    : [...code.children].filter((child): child is HTMLElement => child.classList.contains("line"));
  if (!lines.length || lines.length > MAX_LINES || !paints().sheet) return;
  const highlighter = await core();
  await grammar(highlighter, lang);
  const text = lines.map((line) => line.textContent ?? "").join("\n");
  const rv = pre.hasAttribute("data-rv");
  tokensOf(highlighter, text, lang).forEach((tokenLine, index) => {
    const line = lines[index];
    if (!line) return;
    // The line's text nodes and where each ends (one, as the server renders a line; walked in case of more).
    const texts: Text[] = [],
      ends: number[] = [];
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(), at = 0; node; node = walker.nextNode()) {
      texts.push(node as Text);
      ends.push((at += (node as Text).data.length));
    }
    let at = 0;
    for (const { content, cls } of tokenLine) {
      const start = at;
      at += content.length;
      if (cls) {
        const range = rangeOf(texts, ends, start, at);
        if (range) highlightOf(cls).add(range);
      }
      if (!rv) continue;
      for (let match, re = new RegExp(COMPILER_NAME.source, "g"); (match = re.exec(content));) {
        const range = rangeOf(texts, ends, start + match.index, start + match.index + match[0].length);
        if (range) highlightOf(RV_HIGHLIGHT).add(range);
      }
    }
  });
}
