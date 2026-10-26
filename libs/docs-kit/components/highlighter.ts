// Browser syntax highlighter: a lazy entry + Shiki core, JavaScript regex engine and the two themes in the
// `highlighter-core` chunk (`vite.ts` `docsChunks`: kept out of this entry so rolldown's runtime does not merge here), loaded by
// highlight-browser.ts when the first code block scrolls into view; each grammar is its own chunk, loaded on first
// use. It colours the server's plain `<pre data-lang><code>` of `span.line`s in place: same lines (marks, padding),
// token spans inside (`highlight-classes.ts` classes, rules in `src/generated/highlight.css`). A block with
// `data-src` (an example's "Server HTML" tab) is first filled with that page's HTML, fetched and formatted.
import { createHighlighterCore, type HighlighterCore, type LanguageInput } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import githubDark from "shiki/themes/github-dark.mjs";
import githubLight from "shiki/themes/github-light.mjs";
import { COMPILER_NAME, langOf, THEMES, tokenClass, type Lang } from "./highlight-classes.ts";
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

/** Replace the lines of `code` with the formatted HTML of the page at `src` (same origin). */
async function fill(code: HTMLElement, src: string): Promise<void> {
  const response = await fetch(src, { credentials: "same-origin" });
  if (!response.ok) return;
  const lines = formatHTML(await response.text())
    .replace(/\n$/, "")
    .split("\n");
  const fragment = document.createDocumentFragment();
  lines.forEach((text, index) => {
    if (index) fragment.append("\n");
    const line = document.createElement("span");
    line.className = "line";
    line.textContent = text;
    fragment.append(line);
  });
  code.replaceChildren(fragment);
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

/** Colour one `<pre data-lang>` (once: sets `data-hl`). Unknown languages and very long blocks stay plain. */
export async function highlightPre(pre: HTMLElement): Promise<void> {
  if (pre.hasAttribute("data-hl")) return;
  pre.setAttribute("data-hl", "");
  const lang = langOf(pre.dataset.lang ?? "");
  const code = pre.querySelector("code");
  if (!lang || !code) return;
  if (pre.dataset.src) await fill(code, pre.dataset.src);
  const lines = [...code.children].filter((child): child is HTMLElement => child.classList.contains("line"));
  if (!lines.length || lines.length > MAX_LINES) return;
  const highlighter = await core();
  await grammar(highlighter, lang);
  const text = lines.map((line) => line.textContent ?? "").join("\n");
  const rv = pre.hasAttribute("data-rv");
  tokensOf(highlighter, text, lang).forEach((tokenLine, index) => {
    const line = lines[index];
    if (!line) return;
    const fragment = document.createDocumentFragment();
    for (const { content, cls } of tokenLine) {
      const parts = rv ? content.split(COMPILER_NAME) : [content];
      parts.forEach((part, i) => {
        if (!part) return;
        const name = rv && i % 2 ? (cls ? cls + " code-rv" : "code-rv") : cls;
        if (!name) return fragment.append(part);
        const span = document.createElement("span");
        span.className = name;
        span.textContent = part;
        fragment.append(span);
      });
    }
    line.replaceChildren(fragment);
  });
}
