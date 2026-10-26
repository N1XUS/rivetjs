// Build-time syntax highlighting of prerendered docs pages (DOCS-FAST 2026-10-26): every plain code block of a page
// (`<pre data-lang>` of `span.line`s: Markdown fences, `Example` code tabs, hand-written routes) is coloured in the
// HTML with the browser highlighter's tokens and classes (`components/highlighter.ts` `loadTokenizer`, the same Shiki
// grammars + github-light / github-dark palettes → `components/highlight-classes.ts` classes) and marked `data-hl`,
// so the page ships no highlighter JS (was: a 52 KB br Shiki chunk + a grammar per page, tokenised on the main
// thread). Left for the browser (`page-script.ts` → `highlight-browser.ts`): blocks filled at runtime (`data-src`:
// an example's "Server HTML" tab, fetched when shown) and code the browser renders itself (dev server, client
// renders). Example frame pages are not touched (`sitePages`).
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { COMPILER_NAME, LANGS, langOf } from "../components/highlight-classes.ts";
import type { Token } from "../components/highlighter.ts";
import { sitePages } from "./critical-css.ts";

/** Tokens per line of `text` in `lang` (fence / file-extension name), or undefined for a language it does not colour. */
export type Tokenize = (text: string, lang: string) => Token[][] | undefined;

/** Same cap as the browser highlighter (`highlighter.ts` `MAX_LINES`): longer blocks stay plain. */
const MAX_LINES = 4000;

/** A plain code block: `<pre …data-lang="x"…><code>…</code></pre>` (attributes in any order, no `data-hl` yet). */
const PRE = /<pre(\s[^>]*?\bdata-lang="([^"]*)"[^>]*)><code>([\s\S]*?)<\/code><\/pre>/g;
/** One line: `<span class="line[ mark-*]">…</span>` (inner: text, entities, `code-rv` spans). */
const LINE = /<span class="(line(?: mark-[a-z]+)?)">((?:[^<]|<span class="code-rv">[^<]*<\/span>)*)<\/span>/y;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (html: string) =>
  html.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) =>
    name[0] === "#"
      ? String.fromCodePoint(name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1)))
      : (ENTITIES[name] ?? whole),
  );
const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Inner HTML of one coloured line (compiler names split out as `code-rv` in `data-rv` blocks, like the browser). */
function lineHTML(tokens: readonly Token[], rv: boolean): string {
  let out = "";
  for (const { content, cls } of tokens) {
    const parts = rv ? content.split(COMPILER_NAME) : [content];
    parts.forEach((part, i) => {
      if (!part) return;
      const name = rv && i % 2 ? (cls ? cls + " code-rv" : "code-rv") : cls;
      out += name ? `<span class="${name}">${escape(part)}</span>` : escape(part);
    });
  }
  return out;
}

export interface HighlightStats {
  /** Blocks coloured. */
  blocks: number;
  /** Blocks marked `data-hl` without colours (unknown language, longer than `MAX_LINES`). */
  plain: number;
  /** Blocks left for the browser: runtime-filled (`data-src`) or markup this pass does not recognise. */
  left: number;
}

/**
 * Colour every plain code block of one page's HTML; `cache` memoises tokens by language + text (the same example
 * sources appear on several pages). Blocks it cannot parse line by line are left as they are (the browser highlighter colours them).
 */
export function highlightHTML(
  html: string,
  tokenize: Tokenize,
  stats: HighlightStats = { blocks: 0, plain: 0, left: 0 },
  cache?: Map<string, Token[][] | undefined>,
): string {
  if (!html.includes(" data-lang=")) return html;
  return html.replace(PRE, (whole, attrs: string, name: string, body: string) => {
    if (/\sdata-(?:hl|src)(?:[\s=>]|$)/.test(attrs)) {
      if (/\sdata-src[\s=]/.test(attrs)) stats.left++;
      return whole;
    }
    // Lines: `span.line`s separated by newlines (both generators: Markdown fences, `Example` `Lines`).
    const lines: { cls: string; text: string }[] = [];
    let at = 0;
    while (at < body.length) {
      if (lines.length) {
        if (body[at] !== "\n") return (stats.left++, whole);
        at++;
      }
      LINE.lastIndex = at;
      const found = LINE.exec(body);
      if (!found) return (stats.left++, whole);
      lines.push({ cls: found[1]!, text: decode(found[2]!.replace(/<\/?span[^>]*>/g, "")) });
      at = LINE.lastIndex;
    }
    const mark = `<pre${attrs} data-hl="">`;
    const lang = langOf(name);
    const text = lines.map((line) => line.text).join("\n");
    const key = name + "\0" + text;
    let tokens = cache?.get(key);
    if (tokens === undefined && !cache?.has(key)) {
      tokens = lang && lines.length && lines.length <= MAX_LINES ? tokenize(text, lang) : undefined;
      cache?.set(key, tokens);
    }
    if (!tokens) {
      stats.plain++;
      return mark + `<code>${body}</code></pre>`;
    }
    stats.blocks++;
    const rv = /\sdata-rv(?:[\s=>]|$)/.test(attrs);
    return mark + "<code>" + lines.map((line, index) => `<span class="${line.cls}">${lineHTML(tokens![index] ?? [], rv)}</span>`).join("\n") + "</code></pre>";
  });
}

/** Tokenizer over every highlighted language (`LANGS`), loaded once per process. */
let loading: Promise<Tokenize> | undefined;
export function pageTokenizer(): Promise<Tokenize> {
  return (loading ??= import("../components/highlighter.ts").then((module) => module.loadTokenizer(LANGS)));
}

/** Colour the code blocks of a built client dir's docs pages (default: `sitePages`, frames excluded); rewrites changed files. */
export async function highlightPages(client: string, options: { files?: readonly string[] } = {}): Promise<HighlightStats & { pages: number }> {
  const tokenize = await pageTokenizer();
  const files = options.files ?? (await sitePages(client));
  const stats: HighlightStats = { blocks: 0, plain: 0, left: 0 };
  const cache = new Map<string, Token[][] | undefined>();
  let pages = 0;
  for (const file of files) {
    const path = resolve(client, file);
    const html = await readFile(path, "utf8");
    const out = highlightHTML(html, tokenize, stats, cache);
    if (out === html) continue;
    await writeFile(path, out);
    pages++;
  }
  return { ...stats, pages };
}
