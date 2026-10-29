// Critical CSS for prerendered docs pages (`buildSite`, after prerender). Each page's head stylesheets are replaced
// by ONE inline `<style data-rivet-critical>`: the rules of those sheets whose selectors can match the page (class /
// id / tag / attribute names present in its HTML, outside `[data-css-defer]` subtrees), in source order, plus every
// at-rule statement, `@font-face`, `@keyframes` and `@property`. The full sheets stay in the head as
// `<link rel="x-rivet-defer" href>` (not fetched) + a `<noscript>` stylesheet copy; the document shell's script
// (`document.ts`) turns them into stylesheets after the first paint (load → frame → task) or on the first input.
// A sheet of `@font-face` rules only (docs-kit fonts.ts: kit `?font` sheets) is inline whole: its link becomes
// `<link rel="x-rivet-inline" href>` (never fetched; `restoreLinks` keeps it) — the full copy re-declared the faces
// after the first paint, an extra VeryHigh request that moved Lighthouse's simulated LCP (cdk-docs home 1.65 → 2.25 s).
// The inline rules are a subsequence of the full sheets in the same order, so the cascade is the same before and
// after the full sheets apply. DOM that scripts add before the full sheets may have loaded is invisible in the HTML:
// its names are declared (`CLIENT_SELECTORS` + the site's `criticalCss.extraSelectors`, counted as present on every
// page); anything else (deferred subtrees, overlays of other components) comes with the full sheets, which the shell
// also loads on the first pointer / touch / key input. Matching is by name presence, conservative: combinators, attribute
// values and the arguments of functional pseudo-classes (`:not()`, `:is()`, `:where()`, `:has()`, …) are ignored.
// Only pages carrying the shell's activation script (`DEFER_ACTIVATOR`) and plain `<link rel="stylesheet" href>` head
// links (any attribute order; links with other attributes, e.g. `media`, stay render-blocking) are rewritten;
// `criticalSkip` names the reason for the others (the build logs them). `restoreLinks` undoes it (incremental
// prerender compares and rewrites pages without it).
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { frameIdOf } from "../frame-theme.ts";

/** Names a selector needs present in the page; `null` = always kept (no class / id / tag / attribute). */
interface Needs {
  classes: string[];
  ids: string[];
  tags: string[];
  attrs: string[];
}
type Node = { kind: "rule"; text: string; needs: Needs[] | null } | { kind: "block"; head: string; children: Node[] } | { kind: "raw"; text: string };

/** Names present in a page (what `Needs` are checked against). */
export interface Presence {
  classes: Set<string>;
  /** Class names scripts add to this page before its full stylesheets may have loaded (counted as present). */
  added?: RegExp;
  ids: Set<string>;
  tags: Set<string>;
  attrs: Set<string>;
}

// Attributes the document shell's pre-paint script sets on <html> (`document.ts`): rules keyed on them are critical.
const SCRIPT_ATTRS = ["data-theme", "data-theme-pref", "data-fonts"];

/**
 * DOM that docs pages add in the browser before their full stylesheets may have loaded (selectors; their class / id /
 * tag / attribute names count as present on every page): the shell's overlays (theme menu, mobile drawer: cdk Menu /
 * Modal content mounts on open), the cdk overlay layer and interaction states, `@rivetjs/kit` `<Transition>` data
 * attributes, docs-kit components that set attributes or create elements (code highlighter lines, copy button, charts,
 * hero glow, proof strip). A site adds its own with `site.config.ts` `criticalCss.extraSelectors`.
 */
export const CLIENT_SELECTORS: readonly string[] = [
  // Shell overlays (components/theme-menu-open.tsx, mobile-menu-open.tsx: mounted on the first activation).
  ".menu-popover .menu .menu-item .menu-item-label .menu-check",
  ".drawer-overlay .drawer .drawer-dialog .drawer-body .drawer-sections .drawer-close .top-link",
  // cdk overlay layer (portal, positioned popovers, overlay service panes) + interaction states set on mount / input.
  "[data-rivet-portal] [data-placement] [data-open] [data-hovered] [data-pressed] [data-focused] [data-focus-visible] [data-selected]",
  ".cdk-overlay-container .cdk-overlay-pane .cdk-overlay-backdrop .cdk-overlay-backdrop-showing .cdk-global-overlay-wrapper",
  // @rivetjs/kit <Transition> (Headless UI v2 + react-aria-components attributes).
  "[data-closed] [data-enter] [data-leave] [data-transition] [data-entering] [data-exiting]",
  // docs-kit components: highlighter, CodeBlock copy, charts, hero glow, bench proof, TOC.
  ".line [data-hl] [data-copied] [data-live] [data-in] [aria-current] strong span",
];

/** The names of `selectors` (see `CLIENT_SELECTORS`). */
export function selectorNames(selectors: readonly string[]): Omit<Presence, "added"> {
  const names = { classes: new Set<string>(), ids: new Set<string>(), tags: new Set<string>(), attrs: new Set<string>() };
  for (const selector of selectors)
    for (const needs of selectorNeeds(selector) ?? []) {
      for (const key of ["classes", "ids", "tags", "attrs"] as const) for (const name of needs[key]) names[key].add(name);
    }
  return names;
}

/** Text of the shell script that turns deferred links into stylesheets (`document.ts` `AFTER_PAINT`). */
export const DEFER_ACTIVATOR = 'link[rel="x-rivet-defer"]';
// At-rules whose blocks hold style rules (filtered); any other block at-rule is kept whole.
const GROUPING = /^@(?:media|supports|layer|container|scope|starting-style)\b/i;

/** Index of the first `stops` character at nesting depth 0 from `i` (strings, escapes, comments skipped), or the end. */
function scan(css: string, i: number, stops: string): number {
  let depth = 0;
  for (; i < css.length; i++) {
    const c = css[i]!;
    if (depth === 0 && stops.includes(c)) return i;
    if (c === "\\") i++;
    else if (c === '"' || c === "'") {
      for (i++; i < css.length && css[i] !== c; i++) if (css[i] === "\\") i++;
    } else if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end < 0 ? css.length : end + 1;
    } else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
  }
  return css.length;
}

/** Splits a stylesheet into rules and at-rules (top level or inside a block). */
function parse(css: string): Node[] {
  const nodes: Node[] = [];
  let i = 0;
  while (i < css.length) {
    while (i < css.length && /\s/.test(css[i]!)) i++;
    if (i >= css.length) break;
    if (css.startsWith("/*", i)) {
      const end = css.indexOf("*/", i + 2);
      i = end < 0 ? css.length : end + 2;
      continue;
    }
    const prelude = scan(css, i, "{;");
    if (css[prelude] !== "{") {
      // Statement (`@layer a, b;`, `@import …;`) or a stray `;`.
      const text = css.slice(i, prelude + 1).trim();
      if (text && text !== ";") nodes.push({ kind: "raw", text });
      i = prelude + 1;
      continue;
    }
    const head = css.slice(i, prelude).trim();
    const end = Math.min(scan(css, prelude + 1, "}") + 1, css.length);
    const body = css.slice(prelude + 1, end - 1);
    if (head.startsWith("@")) {
      if (GROUPING.test(head)) nodes.push({ kind: "block", head, children: parse(body) });
      else nodes.push({ kind: "raw", text: css.slice(i, end) });
    } else if (body.includes("{"))
      nodes.push({ kind: "raw", text: css.slice(i, end) }); // nested rules: kept whole
    else nodes.push({ kind: "rule", text: css.slice(i, end), needs: selectorNeeds(head) });
    i = end;
  }
  return nodes;
}

/** Top-level comma split (parentheses / brackets / strings respected). */
function splitList(list: string): string[] {
  const parts: string[] = [];
  for (let from = 0; from <= list.length;) {
    const end = scan(list, from, ",");
    parts.push(list.slice(from, end).trim());
    from = end + 1;
  }
  return parts.filter(Boolean);
}

const unescape = (ident: string) =>
  ident.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (_, hex: string | undefined, char: string | undefined) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : char!,
  );
const IDENT = /^(?:\\[0-9a-fA-F]{1,6}\s?|\\[\s\S]|[\w -￿-])+/;

const empty = (needs: Needs) => !needs.classes.length && !needs.ids.length && !needs.tags.length && !needs.attrs.length;
const merge = (a: Needs, b: Needs): Needs => ({
  classes: [...a.classes, ...b.classes],
  ids: [...a.ids, ...b.ids],
  tags: [...a.tags, ...b.tags],
  attrs: [...a.attrs, ...b.attrs],
});
// Functional pseudo-classes whose argument list must match (some of it) for the selector to match: their names count.
const ANY_OF = /^(?:is|where|has|matches|-webkit-any|-moz-any)$/i;
const MAX_ALTERNATIVES = 32;

/** Alternatives (any one suffices) of names one complex selector needs; `[]`-free: an empty `Needs` = always. */
function complexNeeds(selector: string): Needs[] {
  let alternatives: Needs[] = [{ classes: [], ids: [], tags: [], attrs: [] }];
  const add = (into: keyof Needs, name: string) => {
    for (const needs of alternatives) needs[into].push(name);
  };
  let i = 0;
  let compoundStart = true;
  while (i < selector.length) {
    const c = selector[i]!;
    if (c === "." || c === "#") {
      const name = IDENT.exec(selector.slice(i + 1))?.[0] ?? "";
      add(c === "." ? "classes" : "ids", unescape(name));
      i += 1 + name.length;
      compoundStart = false;
    } else if (c === "[") {
      const close = scan(selector, i + 1, "]");
      const name = /^\s*(?:[\w*-]*\|)?((?:\\.|[\w-])+)/.exec(selector.slice(i + 1, close))?.[1];
      if (name) add("attrs", unescape(name).toLowerCase());
      i = close + 1;
      compoundStart = false;
    } else if (c === ":") {
      // Pseudo-class / pseudo-element. `:is()` / `:where()` / `:has()` arguments: one of them must match (expanded,
      // up to MAX_ALTERNATIVES); other arguments (`:not()`, `:nth-child(… of S)`, …) are skipped.
      i++;
      if (selector[i] === ":") i++;
      const name = IDENT.exec(selector.slice(i))?.[0] ?? "";
      i += name.length;
      if (selector[i] === "(") {
        const close = scan(selector, i + 1, ")");
        if (ANY_OF.test(name)) {
          const options = splitList(selector.slice(i + 1, close)).flatMap(complexNeeds);
          if (!options.some(empty) && options.length * alternatives.length <= MAX_ALTERNATIVES)
            alternatives = alternatives.flatMap((needs) => options.map((option) => merge(needs, option)));
        }
        i = close + 1;
      }
      compoundStart = false;
    } else if (c === " " || c === ">" || c === "+" || c === "~") {
      i++;
      compoundStart = true;
    } else if (c === "*" || c === "&" || c === "|") {
      i++;
      compoundStart = false;
    } else if (compoundStart && IDENT.test(selector.slice(i))) {
      const name = IDENT.exec(selector.slice(i))![0];
      add("tags", unescape(name).toLowerCase());
      i += name.length;
      compoundStart = false;
    } else i++;
  }
  return alternatives;
}

/** What a selector list needs (any entry suffices); `null` when one selector needs no names (always kept). */
export function selectorNeeds(list: string): Needs[] | null {
  const all: Needs[] = [];
  for (const selector of splitList(list)) {
    const alternatives = complexNeeds(selector);
    if (alternatives.some(empty)) return null;
    all.push(...alternatives);
  }
  return all.length ? all : null;
}

const ENTITY: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", "#34": '"' };
const decode = (value: string) => value.replace(/&(amp|lt|gt|quot|apos|#39|#34);/g, (_, name: string) => ENTITY[name]!);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const TAG = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTR = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

/** Class / id / tag / attribute names in a page's HTML, skipping raw-text contents and `[data-css-defer]` subtrees. */
export function presence(html: string): Presence {
  const found: Presence = { classes: new Set(), ids: new Set(), tags: new Set(["html", "head", "body"]), attrs: new Set(SCRIPT_ATTRS) };
  const text = html.replace(/(<(script|style|textarea|title)\b[^>]*>)[\s\S]*?(<\/\2>)/gi, "$1$3");
  let skip: { tag: string; depth: number } | null = null;
  for (const match of text.matchAll(TAG)) {
    const [, close, rawTag, attrs] = match;
    const tag = rawTag!.toLowerCase();
    if (skip) {
      if (tag === skip.tag && !VOID.has(tag) && !attrs!.endsWith("/")) skip.depth += close ? -1 : 1;
      if (skip.depth === 0) skip = null;
      continue;
    }
    if (close) continue;
    // The deferred element's own names count (its box keeps its styles); its descendants are skipped.
    if (/(?:^|\s)data-css-defer(?:[\s=]|$)/.test(attrs!) && !VOID.has(tag)) skip = { tag, depth: 1 };
    found.tags.add(tag);
    for (const attr of attrs!.matchAll(ATTR)) {
      const name = attr[1]!.toLowerCase();
      found.attrs.add(name);
      const value = decode(attr[2] ?? attr[3] ?? attr[4] ?? "");
      if (name === "class") for (const token of value.split(/\s+/)) token && found.classes.add(token);
      else if (name === "id") found.ids.add(value);
    }
  }
  return found;
}

const has = (needs: Needs, page: Presence) =>
  needs.classes.every((name) => page.classes.has(name) || page.added?.test(name) === true) &&
  needs.ids.every((name) => page.ids.has(name)) &&
  needs.tags.every((name) => page.tags.has(name)) &&
  needs.attrs.every((name) => page.attrs.has(name));

function emit(nodes: readonly Node[], page: Presence): string {
  let out = "";
  for (const node of nodes) {
    if (node.kind === "raw") out += node.text;
    else if (node.kind === "rule") {
      if (node.needs === null || node.needs.some((needs) => has(needs, page))) out += node.text;
    } else {
      const inner = emit(node.children, page);
      // A named `@layer x{…}` keeps its place in the layer order even when none of its rules are used.
      if (inner || /^@layer\s+[^\s{]/i.test(node.head)) out += `${node.head}{${inner}}`;
    }
  }
  return out;
}

/** A parsed stylesheet (parse once per build, emit per page). */
export interface Sheet {
  nodes: Node[];
}
export const parseSheet = (css: string): Sheet => ({ nodes: parse(css) });

/** The rules of `sheets` (in order) a page with `page` names can use. */
export const criticalCSS = (sheets: readonly Sheet[], page: Presence): string => sheets.map((sheet) => emit(sheet.nodes, page)).join("");

/** `--name` tokens (custom property references: `var(--x)`, a `--x` in a value, script text). */
const CUSTOM = /--[\w-]+/g;
const NAMED_LAYER = /^@layer\b/i;

/** A nameless rule's declarations (`:root{--a:1;color:red}` → `["--a:1", "color:red"]`), top-level `;` split. */
function declarations(rule: string): { selector: string; decls: string[] } {
  const open = scan(rule, 0, "{");
  const body = rule.slice(open + 1, rule.lastIndexOf("}"));
  const decls: string[] = [];
  for (let from = 0; from < body.length;) {
    const end = scan(body, from, ";");
    const decl = body.slice(from, end).trim();
    if (decl) decls.push(decl);
    from = end + 1;
  }
  return { selector: rule.slice(0, open).trim(), decls };
}
const propertyOf = (decl: string) => (decl.startsWith("--") ? decl.slice(0, decl.indexOf(":")).trim() : undefined);

/**
 * Drops custom properties nothing on the page reads from a critical CSS string (`criticalCSS` output), then the
 * duplicates of the ones left. Only rules with no names (`:root`, `*`, `*,:before,:after,::backdrop` — always kept by
 * name matching) and `@property` are touched: a `--x` declaration there, or `@property --x`, stays when `--x` is
 * referenced by a kept rule (`var(--x)` or any `--x` token outside these declarations, `@keyframes` / `@font-face`
 * included), by the value of another kept custom property (to a fixpoint), or anywhere in `html` (inline styles,
 * inline scripts reading it). Then a declaration identical (same selector, same non-`@layer` at-rule chain, same text)
 * to an earlier kept one is dropped when every declaration of that property in the output has the same text: its
 * value is the same whichever wins, so the cascade does not change (Tailwind emits one properties fallback per sheet).
 * Emptied rules and grouping blocks go (a named `@layer x{…}` stays: layer order).
 */
export function pruneCustomProperties(css: string, html = ""): string {
  type Item =
    { kind: "decls"; selector: string; decls: string[]; chain: string } | { kind: "property"; name: string; text: string } | { kind: "keep"; text: string };
  type Tree = { head: string; items: (Item | Tree)[] };
  const build = (nodes: Node[], chain: string): (Item | Tree)[] =>
    nodes.map((node) => {
      if (node.kind === "block") return { head: node.head, items: build(node.children, NAMED_LAYER.test(node.head) ? chain : `${chain}${node.head}\0`) };
      if (node.kind === "rule" && node.needs === null) return { kind: "decls", ...declarations(node.text), chain };
      const property = node.kind === "raw" && /^@property\s+(--[\w-]+)/.exec(node.text);
      if (property) return { kind: "property", name: property[1]!, text: node.text };
      return { kind: "keep", text: node.text };
    });
  const tree = build(parse(css), "");
  const items: Item[] = [];
  const flat = (list: (Item | Tree)[]) => {
    for (const item of list) "items" in item ? flat(item.items) : items.push(item);
  };
  flat(tree);
  // References: kept rules + nameless rules' ordinary declarations + the page.
  const used = new Set<string>(html.match(CUSTOM) ?? []);
  const values = new Map<string, string[]>();
  for (const item of items) {
    if (item.kind === "keep") for (const name of item.text.match(CUSTOM) ?? []) used.add(name);
    else if (item.kind === "decls")
      for (const decl of item.decls) {
        const name = propertyOf(decl);
        if (name === undefined) for (const ref of decl.match(CUSTOM) ?? []) used.add(ref);
        else values.set(name, [...(values.get(name) ?? []), decl.slice(decl.indexOf(":") + 1)]);
      }
  }
  for (let grew = true; grew;) {
    grew = false;
    for (const [name, list] of values)
      if (used.has(name)) for (const value of list) for (const ref of value.match(CUSTOM) ?? []) if (!used.has(ref)) (used.add(ref), (grew = true));
  }
  // Dedupe: properties whose every declaration in the output (named rules too) has one text.
  const texts = new Map<string, Set<string>>();
  const note = (decl: string) => {
    const name = propertyOf(decl);
    if (name) texts.set(name, (texts.get(name) ?? new Set()).add(decl));
  };
  for (const item of items)
    if (item.kind === "decls") item.decls.forEach(note);
    else if (item.kind === "keep") for (const m of item.text.matchAll(/(?<=[{;])\s*(--[\w-]+\s*:[^;{}]*)/g)) note(m[1]!.trim());
  const seen = new Set<string>();
  const emitTree = (list: (Item | Tree)[]): string => {
    let out = "";
    for (const item of list) {
      if ("items" in item) {
        const inner = emitTree(item.items);
        if (inner || /^@layer\s+[^\s{]/i.test(item.head)) out += `${item.head}{${inner}}`;
      } else if (item.kind === "keep") out += item.text;
      else if (item.kind === "property") {
        if (used.has(item.name)) out += item.text;
      } else {
        const decls = item.decls.filter((decl) => {
          const name = propertyOf(decl);
          if (name === undefined) return true;
          if (!used.has(name)) return false;
          if (texts.get(name)!.size !== 1) return true;
          const key = `${item.chain}\0${item.selector}\0${decl}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        if (decls.length) out += `${item.selector}{${decls.join(";")}}`;
      }
    }
    return out;
  };
  return emitTree(tree);
}

const HEAD_LINK = /<link\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
/** The href of a plain head stylesheet link (`rel="stylesheet"` + a site-absolute `.css` href, nothing else). */
function stylesheetHref(attrs: string): string | undefined {
  const found = new Map<string, string>();
  for (const attr of attrs.matchAll(ATTR)) found.set(attr[1]!.toLowerCase(), attr[2] ?? attr[3] ?? attr[4] ?? "");
  const href = found.get("href");
  if (found.get("rel")?.toLowerCase() !== "stylesheet" || found.size !== 2 || !href || !/^\/[^"]+\.css$/.test(href)) return undefined;
  return href;
}
const CRITICAL = /<style data-rivet-critical>[\s\S]*?<\/style>/;
const DEFERRED = /<link rel="x-rivet-(?:defer|inline)" href="([^"]+)">/g;
/** A sheet the inline CSS carries whole: `@font-face` rules only (no selectors to filter, nothing pruned). */
const wholeInline = (sheet: Sheet) => sheet.nodes.length > 0 && sheet.nodes.every((node) => node.kind === "raw" && /^@font-face\s*\{/i.test(node.text));
const NOSCRIPT = /<noscript data-rivet-css>[\s\S]*?<\/noscript>/;
const HTML_MARK = "<html data-rivet-critical ";

/** The page as prerendered (head stylesheet links, no inline critical CSS). Pages without it are returned unchanged. */
export function restoreLinks(html: string): string {
  if (!CRITICAL.test(html)) return html;
  const links = [...html.matchAll(DEFERRED)].map((m) => `<link rel="stylesheet" href="${m[1]}">`).join("");
  return html.replace(HTML_MARK, "<html ").replace(NOSCRIPT, "").replace(DEFERRED, "").replace(CRITICAL, links);
}

/** Why `inlineCritical` leaves a page as it is (`undefined` = it is rewritten). */
export function criticalSkip(html: string): string | undefined {
  if (CRITICAL.test(html)) return undefined;
  if (!html.startsWith("<!doctype html><html ")) return "no <!doctype html><html> start";
  const head = html.slice(0, html.indexOf("</head>") + 1 || html.length);
  if (![...head.matchAll(HEAD_LINK)].some((m) => stylesheetHref(m[1]!))) return "no plain head stylesheet link";
  if (!html.includes(DEFER_ACTIVATOR)) return `no activation script (${DEFER_ACTIVATOR})`;
  return undefined;
}

/**
 * Inline a page's critical CSS (see the file header). `sheet(href)` returns the parsed sheet of a head stylesheet
 * (`/assets/…`); `added` = class names scripts add on this page; `extra` = names of DOM added in the browser (default
 * `CLIENT_SELECTORS`). Pages `criticalSkip` names a reason for are returned unchanged.
 */
export async function inlineCritical(
  html: string,
  sheet: (href: string) => Promise<Sheet>,
  added?: RegExp,
  extra: Omit<Presence, "added"> = selectorNames(CLIENT_SELECTORS),
): Promise<string> {
  if (criticalSkip(html) !== undefined || CRITICAL.test(html)) return html;
  const head = html.slice(0, html.indexOf("</head>") + 1);
  const hrefs = [...head.matchAll(HEAD_LINK)].flatMap((m) => stylesheetHref(m[1]!) ?? []);
  const page = presence(html);
  for (const key of ["classes", "ids", "tags", "attrs"] as const) for (const name of extra[key]) page[key].add(name);
  if (added) page.added = added;
  const sheets = await Promise.all(hrefs.map(sheet));
  const css = pruneCustomProperties(criticalCSS(sheets, page), html);
  const inline = new Set(hrefs.filter((_, i) => wholeInline(sheets[i]!)));
  let first = true;
  const end = head.length;
  const out =
    html.slice(0, end).replace(HEAD_LINK, (link0, attrs: string) => {
      const href = stylesheetHref(attrs);
      if (!href) return link0;
      const link = `<link rel="x-rivet-${inline.has(href) ? "inline" : "defer"}" href="${href}">`;
      if (!first) return link;
      first = false;
      return `<style data-rivet-critical>${css.replaceAll("</style", "<\\/style")}</style>${link}`;
    }) + html.slice(end);
  const noscript = `<noscript data-rivet-css>${hrefs.map((href) => `<link rel="stylesheet" href="${href}">`).join("")}</noscript>`;
  return out.replace("</head>", noscript + "</head>").replace("<html ", HTML_MARK);
}

/** Docs page files of a built client dir (`*.html`; not example frame pages, which carry no shell script, nor assets / search). */
export async function sitePages(client: string): Promise<string[]> {
  const entries = await readdir(client, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".html"))
    .map((e) => relative(client, join(e.parentPath, e.name)).split(sep).join("/"))
    .filter((file) => !/^(assets|\.vite|pagefind)\//.test(file) && frameIdOf("/" + file) === undefined);
}

/** Inline critical CSS into page files of a built client dir (default: `sitePages`); counts pages and inline bytes. */
export async function inlineCriticalPages(
  client: string,
  options: { files?: readonly string[]; added?: (html: string) => RegExp | undefined; extraSelectors?: readonly string[] } = {},
): Promise<{ pages: number; bytes: number; skipped: { file: string; why: string }[] }> {
  const files = options.files ?? (await sitePages(client));
  const extra = selectorNames([...CLIENT_SELECTORS, ...(options.extraSelectors ?? [])]);
  const sheets = new Map<string, Promise<Sheet>>();
  const sheet = (href: string) => {
    let parsed = sheets.get(href);
    if (!parsed) sheets.set(href, (parsed = readFile(resolve(client, "." + href), "utf8").then(parseSheet)));
    return parsed;
  };
  let pages = 0;
  let bytes = 0;
  const skipped: { file: string; why: string }[] = [];
  for (const file of files) {
    const path = resolve(client, file);
    const html = await readFile(path, "utf8");
    const source = restoreLinks(html);
    const why = criticalSkip(source);
    if (why !== undefined) {
      skipped.push({ file, why });
      continue;
    }
    const out = await inlineCritical(source, sheet, options.added?.(source), extra);
    if (out === html) continue;
    await writeFile(path, out);
    pages++;
    bytes += CRITICAL.exec(out)?.[0].length ?? 0;
  }
  return { pages, bytes, skipped };
}
