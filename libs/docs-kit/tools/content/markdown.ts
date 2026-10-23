// Markdown → JSX source for one page. Prose becomes static JSX (the compiler hoists it into
// fragments, so prose ships no JS); a few directives become docs components. No raw HTML.
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { posix } from "node:path";
import { compile } from "@rivetjs/compiler";
import { formatDiagnostic } from "@rivetjs/compiler/format";
import type { Highlight, Line } from "./highlight.ts";
import type { BenchChartSpec } from "../../components/chart-model.ts";
import type { ApiCardData } from "../../components/ApiCard.tsx";
import { COMPILER_NAME } from "../../components/highlight-classes.ts";
import type { Token } from "../../components/highlighter.ts";

/** What a page may reference; unknown references are build errors. */
export interface RenderContext {
  /** Content path of the page (`guides/components`), for errors and relative links. */
  path: string;
  highlight: Highlight;
  /** Glossary terms: id → plain definition. */
  terms: ReadonlyMap<string, { title: string; definition: string }>;
  /** Example ids (`apps/docs/examples/<id>`). */
  examples: ReadonlySet<string>;
  /** API symbols (`@rivetjs/reactivity#signal`) → card data inlined into `<ApiCard>`; undefined skips the check and inlines nothing. */
  symbols?: ReadonlyMap<string, ApiCardData>;
  /** Starter template names. */
  starters: ReadonlySet<string>;
  /** Benchmark charts by id (`content/_charts.ts` `charts`); `::chart{id}` inlines the spec. */
  charts?: ReadonlyMap<string, BenchChartSpec>;
  /** Sibling-site origins for `site:<name>/<path>` links (site config `sites`). */
  sites?: Readonly<Record<string, string>>;
  /**
   * Build-time colouring (fragments: lean pages run no browser highlighter): tokens per line, or undefined for a
   * language it does not colour. Coloured blocks carry `data-hl` (the browser highlighter skips them).
   */
  tokens?: (text: string, lang: string) => Token[][] | undefined;
}

/** Resolve `site:<name>/<path>` against the sibling origins; throws on an unknown site name. */
export function siteHref(url: string, sites: Readonly<Record<string, string>> | undefined): string {
  const m = /^site:([\w-]+)(\/.*)?$/.exec(url);
  const origin = m && sites?.[m[1]!];
  if (!m || !origin)
    throw new Error(`unknown site "${m?.[1] ?? url}" (known: ${Object.keys(sites ?? {}).join(", ") || "none"}; add it to site.config.ts \`sites\`)`);
  return origin.replace(/\/+$/, "") + (m[2] ?? "/");
}

/** A link target that points at the local machine (breaks in production). */
export const isLocalUrl = (url: string): boolean => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url);
export interface Heading {
  depth: 2 | 3 | 4;
  id: string;
  text: string;
}
export interface Rendered {
  /** JSX children for the page body (one block per line). */
  jsx: string;
  headings: Heading[];
  /** Components and helpers the JSX uses (import names). */
  uses: Set<"Example" | "ApiCard" | "StarterButton" | "CopyButton" | "BenchChart">;
  /** Examples embedded in this body: the page loader supplies only these records. */
  examples: Set<string>;
  /** lucide icons the JSX renders through `<Icon icon={Name} />` (import names). */
  icons: Set<string>;
  /** First paragraph as plain text (glossary definitions). */
  firstParagraph?: string;
  /** Internal hrefs (for the link check before the build). */
  links: string[];
  /** Absolute links to localhost / 127.0.0.1 (a hard-coded dev URL; `check-content --strict` fails on them). */
  localLinks: string[];
}

// Minimal mdast shapes (remark's types are not a dependency).
interface Node {
  type: string;
  value?: string;
  children?: Node[];
  depth?: number;
  ordered?: boolean;
  start?: number | null;
  spread?: boolean;
  url?: string;
  title?: string | null;
  alt?: string;
  lang?: string | null;
  meta?: string | null;
  align?: (string | null)[];
  checked?: boolean | null;
  name?: string;
  attributes?: Record<string, string | null | undefined> | null;
  data?: { directiveLabel?: boolean };
  position?: { start: { line: number } };
}

/** JSX text: entities for characters JSX would read as syntax; newlines become spaces. */
export const text = (value: string): string =>
  value.replace(/[&<>{}]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "{": "&#123;", "}": "&#125;" })[c]!).replace(/\r?\n/g, " ");
/** JSX attribute string value. */
export const attr = (value: string): string =>
  value.replace(/[&"<>{}]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;", "{": "&#123;", "}": "&#125;" })[c]!).replace(/\r?\n/g, " ");

/** Heading slug: lowercase words joined by hyphens; repeats get `-1`, `-2`. */
export function slugger(): (value: string) => string {
  const seen = new Map<string, number>();
  return (value) => {
    const base =
      value
        .toLowerCase()
        .replace(/[`'"’]/g, "")
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "") || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base}-${count}` : base;
  };
}

const plain = (node: Node): string =>
  node.type === "text" || node.type === "inlineCode" ? (node.value ?? "") : node.type === "break" ? " " : (node.children ?? []).map(plain).join("");

/** Example compiler warnings already printed (fence, position, message): once per process. */
const fenceWarnings = new Set<string>();

const CALLOUTS: Record<string, string> = { note: "Note", tip: "Tip", warning: "Warning", gotcha: "Gotcha" };
/** lucide icon per callout kind. */
const CALLOUT_ICONS: Record<string, string> = { note: "Info", tip: "Lightbulb", warning: "TriangleAlert", gotcha: "OctagonAlert" };

/**
 * Fence meta: `title="file.ts"`, `avoid` / `prefer` (labelled header), `group="name"` (adjacent fences of
 * one group = file tabs), `compiled` (JSX fences: the real compiler output, DOM + server; `compiled="tabs"`
 * / `compiled="stacked"` picks the presentation, default stacked unless the output is long), `open`
 * (compiled output shown on load).
 */
export interface FenceMeta {
  title?: string;
  group?: string;
  verdict?: "avoid" | "prefer";
  compiled?: "auto" | "stacked" | "tabs";
  open?: boolean;
}
export function fenceMeta(meta: string): FenceMeta {
  const title = /(?:^|\s)title="([^"]*)"/.exec(meta)?.[1];
  const group = /(?:^|\s)group="([^"]*)"/.exec(meta)?.[1];
  const layout = /(?:^|\s)compiled="([^"]*)"/.exec(meta)?.[1];
  const bare = meta.replace(/\w+="[^"]*"/g, " ").split(/\s+/);
  const verdict = bare.includes("avoid") ? "avoid" : bare.includes("prefer") ? "prefer" : undefined;
  const compiled = layout === "tabs" || layout === "stacked" ? layout : bare.includes("compiled") ? "auto" : undefined;
  if (layout !== undefined && compiled === undefined) throw new Error(`fence meta compiled="${layout}": use compiled, compiled="stacked" or compiled="tabs"`);
  return {
    ...(title !== undefined ? { title } : {}),
    ...(group ? { group } : {}),
    ...(verdict ? { verdict } : {}),
    ...(compiled ? { compiled } : {}),
    ...(bare.includes("open") ? { open: true } : {}),
  };
}

/** Compiled output longer than this (lines, either target) uses editor tabs instead of the stacked panel. */
export const STACKED_MAX_LINES = 32;

/** Normalize an internal href: `.md` paths resolve against the page; page paths get a trailing slash. */
export function internalHref(url: string, from: string): string {
  const [pathPart = "", hash] = url.split("#", 2) as [string, string | undefined];
  if (!pathPart) return "#" + (hash ?? "");
  let path = pathPart;
  if (path.endsWith(".md")) {
    const resolved = path.startsWith("/") ? path.slice(1) : posix.join(posix.dirname(from), path);
    path = "/" + resolved.replace(/\.md$/, "").replace(/(^|\/)index$/, "");
  }
  if (!/\.[a-z0-9]+$/i.test(path) && !path.endsWith("/")) path += "/";
  return path + (hash !== undefined ? "#" + hash : "");
}

/** Render one Markdown body (frontmatter already removed). `line` offsets error positions. */
export function renderMarkdown(body: string, context: RenderContext, lineOffset = 0): Rendered {
  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).parse(body) as unknown as Node;
  const slug = slugger();
  const headings: Heading[] = [];
  const uses: Rendered["uses"] = new Set();
  const examples = new Set<string>();
  const icons = new Set<string>();
  const icon = (name: string, size: number, cls?: string) => {
    icons.add(name);
    return `<Icon icon={${name}} size={${size}}${cls ? ` class="${cls}"` : ""} />`;
  };
  let tabSets = 0;
  // Radio names must be unique per document: fragments (`_<name>`) share the home page, so they get a prefix.
  const radioPrefix = context.path.startsWith("_") ? context.path.slice(1).replace(/[^\w-]/g, "-") + "-" : "";
  const links: string[] = [];
  const localLinks: string[] = [];
  let firstParagraph: string | undefined;
  const fail = (node: Node, message: string): never => {
    const line = node.position ? node.position.start.line + lineOffset : undefined;
    throw new Error(`content/${context.path}.md${line ? ":" + line : ""}: ${message}`);
  };

  const inline = (nodes: readonly Node[] | undefined): string => (nodes ?? []).map(inlineNode).join("");
  const inlineNode = (node: Node): string => {
    switch (node.type) {
      case "text":
        return text(node.value ?? "");
      case "inlineCode":
        return `<code>${text(node.value ?? "")}</code>`;
      case "emphasis":
        return `<em>${inline(node.children)}</em>`;
      case "strong":
        return `<strong>${inline(node.children)}</strong>`;
      case "delete":
        return `<del>${inline(node.children)}</del>`;
      case "break":
        return "<br />";
      case "link": {
        const url = node.url ?? "";
        const label = inline(node.children);
        if (url.startsWith("site:")) {
          try {
            return `<a href="${attr(siteHref(url, context.sites))}" rel="noopener">${label}</a>`;
          } catch (error) {
            return fail(node, (error as Error).message);
          }
        }
        if (isLocalUrl(url)) localLinks.push(url);
        if (/^(https?:|mailto:)/.test(url)) return `<a href="${attr(url)}" rel="noopener">${label}</a>`;
        if (/^[a-z]+:/i.test(url)) fail(node, `unsupported link scheme: ${url}`);
        const href = internalHref(url, context.path);
        links.push(href);
        return `<a href="${attr(href)}" data-rivet-reload="">${label}</a>`;
      }
      case "textDirective": {
        const label = inline(node.children);
        if (node.name === "term") {
          const id = node.attributes?.id ?? slugger()(plain(node));
          const term = context.terms.get(id);
          if (!term) fail(node, `unknown glossary term "${id}" (add it to content/reference/glossary.md)`);
          return `<a class="term" href="/reference/glossary/#${attr(id)}" title="${attr(term!.definition)}" data-rivet-reload="">${label}</a>`;
        }
        if (node.name === "kbd") return `<kbd>${label}</kbd>`;
        // Not a directive we know: keep the text as written (`a:b`).
        return text(":" + (node.name ?? "")) + (node.children?.length ? "[" + label + "]" : "");
      }
      case "html":
        if (/^<!--[\s\S]*-->$/.test(node.value ?? "")) return "";
        return fail(node, `raw HTML is not supported (${(node.value ?? "").slice(0, 40)}); use Markdown or a directive`);
      case "image":
        return fail(node, "images are not supported yet (use an example or inline SVG in a component)");
      case "footnoteReference":
        return fail(node, "footnotes are not supported");
      default:
        return fail(node, `unsupported inline node "${node.type}"`);
    }
  };

  /**
   * `<pre data-lang>` of plain lines (`span.line`, marks as `mark-*`): the browser colours it when visible
   * (components/highlighter.ts). `rv` (`data-rv`) marks compiler-inserted names (`code-rv`), here and in the browser.
   */
  const preOf = (lines: Line[], lang: string, attrs = "", rv = false): string => {
    const piece = (part: string, cls: string, i: number) => {
      const name = rv && i % 2 ? (cls ? cls + " code-rv" : "code-rv") : cls;
      return !part ? "" : name ? `<span class="${name}">${text(part)}</span>` : text(part);
    };
    const pieces = (content: string, cls: string) => (rv ? content.split(COMPILER_NAME) : [content]).map((part, i) => piece(part, cls, i)).join("");
    const tokens = context.tokens?.(lines.map((line) => line.text).join("\n"), lang);
    const inner = (line: Line, index: number) =>
      tokens ? (tokens[index] ?? []).map((token) => pieces(token.content, token.cls)).join("") : pieces(line.text, "");
    const body = lines.map((line, index) => `<span class="${"line" + (line.mark ? " mark-" + line.mark : "")}">${inner(line, index)}</span>`).join("&#10;");
    return `<pre tabIndex={0}${attrs} data-lang="${attr(lang)}"${rv ? ' data-rv=""' : ""}${tokens ? ' data-hl=""' : ""}><code>${body}</code></pre>`;
  };
  /** Plain `<pre>` of one fence. */
  const pre = (node: Node, attrs = ""): string => {
    const lang = (node.lang ?? "txt").toLowerCase();
    return preOf(context.highlight.lines(node.value ?? "", lang), lang, attrs);
  };
  const VERDICTS = { avoid: ["Avoid", "CircleX"], prefer: ["Prefer", "CircleCheck"] } as const;
  const langChip = (lang: string) => `<span class="code-lang">${text(lang === "txt" ? "text" : lang)}</span>`;
  const pillOf = (verdict: FenceMeta["verdict"]) => (verdict ? `<span class="code-pill">${icon(VERDICTS[verdict][1], 14)}${VERDICTS[verdict][0]}</span>` : "");
  /** A switch (checkbox, no JS): CSS shows or arranges panes from its state. */
  const toggle = (cls: string, label: string, checked: boolean) =>
    `<label class="code-switch ${cls}"><input type="checkbox" role="switch" class="code-switch-input"${checked ? " checked" : ""} /><span class="code-switch-text">${label}</span><span class="code-switch-track" aria-hidden="true" /></label>`;

  /** One fence: header (Avoid / Prefer pill, language, file name, copy), code. */
  const code = (node: Node): string => {
    const lang = (node.lang ?? "txt").toLowerCase();
    let meta: FenceMeta;
    try {
      meta = fenceMeta(node.meta ?? "");
    } catch (error) {
      return fail(node, (error as Error).message);
    }
    if (meta.compiled) return compiled(node, lang, meta);
    uses.add("CopyButton");
    const title = meta.title ? `<span class="code-title">${text(meta.title)}</span>` : "";
    const head = `<div class="code-head">${pillOf(meta.verdict)}${langChip(lang)}${title}<span class="code-grow" /><CopyButton /></div>`;
    const cls = "code-block" + (meta.verdict ? " code-" + meta.verdict : "");
    return `<figure class="${cls}" data-lang="${attr(lang)}">` + head + pre(node) + `</figure>`;
  };

  /**
   * A JSX fence with its real compiler output (`@rivetjs/compiler`, DOM and server targets, compiled at
   * build time). Stacked: source, then a "Compiles to" panel (Browser / Server radio tabs) behind the
   * "Compiled output" switch. Tabs: `File.tsx` / `dom.js` / `server.js` editor tabs plus a "Side by side"
   * switch. Radio inputs and checkboxes only: works without JS.
   */
  const compiled = (node: Node, lang: string, meta: FenceMeta): string => {
    if (lang !== "tsx" && lang !== "jsx") return fail(node, `\`compiled\` needs a tsx or jsx fence (got ${lang})`);
    const source = node.value ?? "";
    const filename = meta.title ?? "Example." + lang;
    const out = (["dom", "server"] as const).map((target) => {
      const result = compile(source, { target, filename });
      const errors = result.diagnostics.filter((d) => d.severity === "error");
      if (errors.length) return fail(node, `compiled fence does not compile (${target}): ${errors.map((d) => `${d.code} ${d.message}`).join("; ")}`);
      // Compiler warnings (RV2104) of an example: printed once per fence and message, never dropped.
      for (const w of result.warnings ?? []) {
        const key = `${filename}\0${source}\0${w.line ?? 0}:${w.column ?? 0}\0${w.message}`;
        if (fenceWarnings.has(key)) continue;
        fenceWarnings.add(key);
        console.warn(
          formatDiagnostic({ origin: "docs-kit", code: w.code, message: w.message, file: filename, line: w.line, column: w.column, source }, { frame: true }),
        );
      }
      return result.code.trimEnd();
    });
    const [dom, server] = out as [string, string];
    const long = Math.max(dom.split("\n").length, server.split("\n").length) > STACKED_MAX_LINES;
    const layout = meta.compiled === "auto" ? (long ? "tabs" : "stacked") : meta.compiled!;
    const name = `${radioPrefix}compiled-${++tabSets}`;
    uses.add("CopyButton");
    const domPre = preOf(context.highlight.lines(dom, "js"), "js", ' data-pane="dom" aria-label="Browser output (dom.js)"', true);
    const serverPre = preOf(context.highlight.lines(server, "js"), "js", ' data-pane="server" aria-label="Server output (server.js)"', true);
    const sourcePre = pre(node, ' data-pane="source"');
    const radio = (value: string, label: string, checked: boolean) =>
      `<input type="radio" name="${name}" id="${name}-${value}" value="${value}"${checked ? " checked" : ""} /><label for="${name}-${value}">${text(label)}</label>`;
    if (layout === "stacked") {
      const title = meta.title ? `<span class="code-title">${text(meta.title)}</span>` : "";
      return (
        `<figure class="code-block code-compiled" data-lang="${lang}" data-layout="stacked">` +
        `<div class="code-head">${langChip(lang)}${title}<span class="code-grow" />${toggle("code-show", "Compiled output", meta.open === true)}<CopyButton /></div>` +
        sourcePre +
        `<div class="code-out" data-pagefind-ignore="">` +
        `<div class="code-out-bar"><span class="code-out-label">${icon("ArrowDownToLine", 14)}Compiles to</span>` +
        `<fieldset class="code-out-tabs"><legend class="sr-only">Compiler target</legend>${radio("dom", "Browser", true)}${radio("server", "Server", false)}</fieldset></div>` +
        domPre +
        serverPre +
        `</div></figure>`
      );
    }
    const file = (meta.title ?? filename).split("/").pop()!;
    return (
      `<figure class="code-block code-compiled" data-lang="${lang}" data-layout="tabs">` +
      `<div class="code-head"><fieldset class="code-tabs"><legend class="sr-only">Source and compiled output</legend>` +
      `${radio("source", file, true)}${radio("dom", "dom.js", false)}${radio("server", "server.js", false)}</fieldset>` +
      `<span class="code-grow" />${toggle("code-split", "Side by side", false)}<CopyButton /></div>` +
      `<div class="code-panes">${sourcePre}<div class="code-out" data-pagefind-ignore="">${domPre}${serverPre}</div></div>` +
      `</figure>`
    );
  };

  /** Adjacent fences of one `group`: file tabs (radio inputs, no JS) over one panel per file. */
  const codeTabs = (nodes: Node[]): string => {
    if (nodes.length > 8) return fail(nodes[8]!, "a code tab set holds at most 8 files (site.css shows panels 0–7)");
    const name = `${radioPrefix}code-tabs-${++tabSets}`;
    uses.add("CopyButton");
    const label = (node: Node) => fenceMeta(node.meta ?? "").title ?? node.lang ?? "txt";
    const tabs = nodes
      .map(
        (node, i) =>
          `<input type="radio" name="${name}" id="${name}-${i}" value="${i}"${i === 0 ? " checked" : ""} /><label for="${name}-${i}">${text(label(node))}</label>`,
      )
      .join("");
    const panels = nodes.map((node, i) => `<div class="code-tab-panel" data-panel="${i}">${pre(node)}</div>`).join("");
    // Avoid / Prefer of a tab set = the first fence's (one verdict per set).
    const verdict = fenceMeta(nodes[0]!.meta ?? "").verdict;
    return (
      `<figure class="code-block code-group${verdict ? " code-" + verdict : ""}" data-lang="${attr((nodes[0]!.lang ?? "txt").toLowerCase())}">` +
      `<div class="code-head">${pillOf(verdict)}<fieldset class="code-tabs"><legend class="sr-only">Files</legend>${tabs}</fieldset><span class="code-grow" /><CopyButton /></div>` +
      panels +
      `</figure>`
    );
  };

  /** Block children, with adjacent same-`group` fences merged into tab sets. */
  const blocks = (nodes: readonly Node[] | undefined): string[] => {
    const out: string[] = [];
    const list = nodes ?? [];
    for (let i = 0; i < list.length; i++) {
      const node = list[i]!;
      const group = node.type === "code" ? fenceMeta(node.meta ?? "").group : undefined;
      if (group) {
        const set = [node];
        while (list[i + 1]?.type === "code" && fenceMeta(list[i + 1]!.meta ?? "").group === group) set.push(list[++i]!);
        if (set.length > 1) {
          out.push(codeTabs(set));
          continue;
        }
      }
      out.push(block(node));
    }
    return out;
  };

  const listItem = (node: Node, spread: boolean): string => {
    const parts = spread ? blocks(node.children) : (node.children ?? []).map((child) => (child.type === "paragraph" ? inline(child.children) : block(child)));
    const check = node.checked === true || node.checked === false ? `<input type="checkbox" disabled checked={${node.checked}} /> ` : "";
    return `<li>${check}${parts.join("")}</li>`;
  };

  const block = (node: Node): string => {
    switch (node.type) {
      case "heading": {
        if (node.depth === 1) fail(node, "use frontmatter `title` for the page title; content headings start at ##");
        if (node.depth! > 4) fail(node, "headings deeper than #### are not supported");
        const label = plain(node);
        const id = slug(label);
        const depth = node.depth as 2 | 3 | 4;
        headings.push({ depth, id, text: label });
        // Anchor link; h2 / h3 show a link icon on hover / focus.
        const mark = depth <= 3 ? icon("Link", depth === 2 ? 20 : 18, "anchor-icon") : "";
        return `<h${depth} id="${attr(id)}"><a class="heading-anchor" href="#${attr(id)}">${inline(node.children)}${mark}</a></h${depth}>`;
      }
      case "paragraph": {
        firstParagraph ??= plain(node);
        return `<p>${inline(node.children)}</p>`;
      }
      case "list": {
        const tag = node.ordered ? "ol" : "ul";
        const start = node.ordered && node.start && node.start !== 1 ? ` start={${node.start}}` : "";
        return `<${tag}${start}>${(node.children ?? []).map((item) => listItem(item, Boolean(node.spread || item.spread))).join("")}</${tag}>`;
      }
      case "blockquote":
        return `<blockquote>${blocks(node.children).join("")}</blockquote>`;
      case "code":
        return code(node);
      case "thematicBreak":
        return "<hr />";
      case "table": {
        const align = node.align ?? [];
        const cell = (tag: "th" | "td", c: Node, i: number) => {
          const a = align[i];
          return `<${tag}${a ? ` class="text-${a}"` : ""}${tag === "th" ? ' scope="col"' : ""}>${inline(c.children)}</${tag}>`;
        };
        const [head, ...rows] = node.children ?? [];
        return (
          `<div class="table-wrap"><table>` +
          `<thead><tr>${(head?.children ?? []).map((c, i) => cell("th", c, i)).join("")}</tr></thead>` +
          `<tbody>${rows.map((r) => `<tr>${(r.children ?? []).map((c, i) => cell("td", c, i)).join("")}</tr>`).join("")}</tbody>` +
          `</table></div>`
        );
      }
      case "containerDirective": {
        const kind = node.name ?? "";
        const fallback = CALLOUTS[kind];
        if (!fallback) return fail(node, `unknown container directive :::${kind} (use ${Object.keys(CALLOUTS).join(", ")})`);
        const children = node.children ?? [];
        const labelNode = children[0]?.data?.directiveLabel ? children[0] : undefined;
        const title = labelNode ? inline(labelNode.children) : fallback;
        const content = blocks(labelNode ? children.slice(1) : children).join("");
        return `<aside class="callout callout-${kind}" aria-label="${attr(labelNode ? plain(labelNode) : fallback)}"><p class="callout-title">${icon(CALLOUT_ICONS[kind]!, 18)}${title}</p>${content}</aside>`;
      }
      case "leafDirective": {
        const attrs = node.attributes ?? {};
        if (node.name === "example") {
          const id = attrs.id ?? "";
          if (!context.examples.has(id)) fail(node, `unknown example "${id}" (create apps/docs/examples/${id}/example.ts)`);
          uses.add("Example");
          examples.add(id);
          return `<Example id="${attr(id)}" example={data.examples[${JSON.stringify(id)}]} />`;
        }
        if (node.name === "api") {
          const symbol = attrs.symbol ?? "";
          const card = context.symbols?.get(symbol);
          if (context.symbols && !card) fail(node, `unknown API symbol "${symbol}"`);
          uses.add("ApiCard");
          // The card data is a literal in the page module: `virtual:docs/api` is empty in the browser, and the page renders there on client navigation.
          return `<ApiCard card={${JSON.stringify(card ?? { name: symbol, kind: "", entry: "", href: "", summary: "", runs: "" })}} />`;
        }
        if (node.name === "starter") {
          const template = attrs.template ?? "starter-static";
          if (!context.starters.has(template)) fail(node, `unknown starter "${template}" (templates/${template})`);
          uses.add("StarterButton");
          return `<StarterButton template="${attr(template)}" />`;
        }
        if (node.name === "chart") {
          const id = attrs.id ?? "";
          const chart = context.charts?.get(id);
          if (!chart) return fail(node, `unknown chart "${id}" (add it to content/_charts.ts)`);
          uses.add("BenchChart");
          return `<BenchChart chart={${JSON.stringify(chart)}}${attrs.compact !== undefined ? " compact" : ""} />`;
        }
        return fail(node, `unknown directive ::${node.name}`);
      }
      case "html":
        if (/^<!--[\s\S]*-->$/.test((node.value ?? "").trim())) return "";
        return fail(node, `raw HTML is not supported (${(node.value ?? "").slice(0, 40)}); use Markdown or a directive`);
      case "definition":
        return "";
      default:
        return fail(node, `unsupported block "${node.type}"`);
    }
  };

  const jsx = blocks(tree.children).filter(Boolean).join("\n");
  return { jsx, headings, uses, examples, icons, links, localLinks, ...(firstParagraph !== undefined ? { firstParagraph } : {}) };
}
