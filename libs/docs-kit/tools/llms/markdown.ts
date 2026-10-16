// Docs Markdown → plain Markdown for language models: the author's text is kept byte for byte (source slices), only
// the docs-specific syntax is replaced: `::example{id}` → the example's source files as fenced code, `::api{symbol}` →
// signature + summary from api.json, `::starter` / `::chart` → text, `:::note` callouts → blockquotes, `:term[x]` /
// `:kbd[x]` → text / code, `site:` and internal links → URLs the caller maps (`link`). Same parser as the content
// pipeline (remark + gfm + directive), so what parses there parses here.
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import type { ApiSymbol } from "../api.ts";
import { advantage, formatValue, type BenchChartSpec } from "../../components/chart-model.ts";
import { internalHref, siteHref } from "../content/markdown.ts";
import { fenceLang, type LlmsExample } from "./source.ts";

interface Node {
  type: string;
  name?: string;
  url?: string;
  value?: string;
  attributes?: Record<string, string | null | undefined>;
  children?: Node[];
  data?: { directiveLabel?: boolean };
  position?: { start: { offset?: number; line: number }; end: { offset?: number } };
}

export interface LlmsLinkTarget {
  /** Internal page href (`/guides/components/#x`) of this site, or an absolute URL of a sibling site / the web. */
  href: string;
  /** `page`: a content page of this site; `site`: another path of this site (API, examples); `external`: anything else. */
  kind: "page" | "site" | "external";
}

export interface LlmsMarkdownContext {
  /** Content path of the page (relative links, errors). */
  path: string;
  examples: ReadonlyMap<string, LlmsExample>;
  symbols: ReadonlyMap<string, ApiSymbol[]>;
  charts: ReadonlyMap<string, BenchChartSpec>;
  sites?: Readonly<Record<string, string>>;
  /** Content page hrefs of this site (`/guides/components/`). */
  pages: ReadonlySet<string>;
  /** Final URL of a link target. */
  link: (target: LlmsLinkTarget) => string;
  /** Starter templates: `::starter{template}` → its create command. */
  starterCommand?: (template: string) => string;
}

const CALLOUT_TITLES: Record<string, string> = { note: "Note", tip: "Tip", warning: "Warning", gotcha: "Gotcha" };

/** A fence that cannot be closed by any backtick run inside `text`. */
export function fence(text: string, info: string): string {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
  const ticks = "`".repeat(longest + 1);
  return `${ticks}${info}\n${text.replace(/\n+$/, "")}\n${ticks}`;
}

/** One example as Markdown: title, summary, each shown file as a fenced block. */
export function exampleMarkdown(example: LlmsExample, heading = "Example"): string {
  const parts = [`**${heading}: ${example.title}.** ${example.summary}`];
  for (const file of example.files) parts.push(fence(file.text, `${fenceLang(file.path)} title="${file.path}"`));
  return parts.join("\n\n");
}

/** One API symbol as Markdown (`level` = heading depth). */
export function symbolMarkdown(symbol: ApiSymbol, level = 3): string {
  const parts = [`${"#".repeat(level)} \`${symbol.name}\` (${symbol.kind})`];
  const notes = [`import from \`${symbol.entry}\``, `runs on: ${symbol.runsOn}`];
  if (symbol.status !== "stable") notes.push(symbol.status);
  if (symbol.since) notes.push(`since ${symbol.since}`);
  if (symbol.deprecated) notes.push(`deprecated: ${symbol.deprecated}`);
  parts.push(notes.join(" · "));
  // `remarks` usually repeats the summary as its first sentence (TypeDoc summary = first sentence of the comment).
  const flat = (text: string) => text.replace(/\s+/g, " ").trim();
  if (symbol.summary && !flat(symbol.remarks).startsWith(flat(symbol.summary))) parts.push(symbol.summary);
  if (symbol.remarks) parts.push(symbol.remarks);
  if (symbol.signatures.length) parts.push(fence(symbol.signatures.join("\n"), "ts"));
  if (symbol.params.length)
    parts.push(
      table(
        ["Parameter", "Type", "Default", "Description"],
        symbol.params.map((param) => [param.name + (param.optional ? "?" : ""), code(param.type), param.default ? code(param.default) : "", param.doc]),
      ),
    );
  if (symbol.returns) parts.push(`Returns: ${symbol.returns}`);
  if (symbol.members.length)
    parts.push(
      table(
        ["Member", "Signature", "Default", "Description"],
        symbol.members.map((member) => [
          member.name + (member.optional ? "?" : ""),
          code(member.signature),
          member.default ? code(member.default) : "",
          member.doc,
        ]),
      ),
    );
  for (const example of symbol.examples) parts.push(/^```/.test(example.trim()) ? example.trim() : fence(example, "tsx"));
  return parts.join("\n\n");
}

const cellText = (value: string) =>
  value
    .replace(/\r?\n+/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
const code = (value: string) => (value ? "`" + value.replace(/`/g, "'").replace(/\s+/g, " ") + "`" : "");
function table(head: string[], rows: string[][]): string {
  return [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${row.map(cellText).join(" | ")} |`)].join("\n");
}

function chartMarkdown(chart: BenchChartSpec): string {
  const rows: string[][] = [];
  const value = (n: number) => formatValue(n, chart.digits ?? 1);
  for (const group of chart.groups)
    for (const point of group.points)
      rows.push([
        group.label,
        point.label + (point.note ? ` (${point.note})` : ""),
        value(point.value),
        point.min !== undefined ? `${value(point.min)}–${value(point.max!)}` : "",
      ]);
  const lines = [`**Benchmark: ${chart.title}** (${chart.unit}, ${chart.better} is better)`];
  if (chart.kind === "stat") {
    const [rivet, reference] = [chart.groups[0].points.find((point) => point.rivet), chart.groups[0].points.find((point) => !point.rivet)];
    const ratio = rivet && reference ? `${formatValue(advantage(rivet.value, reference.value, chart.better), 2)}× ` : "";
    lines.push(`${ratio}${chart.lead}. ${chart.claim}`);
  }
  lines.push(table(["Group", "Lane", `Median (${chart.unit})`, "Range"], rows));
  lines.push(`${chart.caption.machine}, ${chart.caption.date}. ${chart.caption.method} Source: [${chart.caption.source.label}](${chart.caption.source.href})`);
  return lines.join("\n\n");
}

const plain = (node: Node): string => (node.value ?? "") + (node.children ?? []).map(plain).join("");

/** Convert one page body. Throws on the references the content build rejects too (unknown example / symbol / chart). */
export function llmsMarkdown(body: string, context: LlmsMarkdownContext): string {
  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).parse(body) as unknown as Node;
  const fail = (node: Node, message: string): never => {
    throw new Error(`content/${context.path}.md:${node.position?.start.line ?? "?"}: ${message}`);
  };
  const start = (node: Node) => node.position!.start.offset!;
  const end = (node: Node) => node.position!.end.offset!;
  /** Source text in [from, to) with every child's replacement applied. */
  const splice = (from: number, to: number, children: readonly Node[]): string => {
    let out = "";
    let at = from;
    for (const child of children) {
      if (!child.position || child.position.start.offset === undefined) continue;
      out += body.slice(at, start(child)) + render(child);
      at = end(child);
    }
    return out + body.slice(at, to);
  };
  /** Indentation / quote prefix of the line a block starts on, for the following lines of a multi-line replacement. */
  const continuation = (node: Node): string => {
    const lineStart = body.lastIndexOf("\n", start(node) - 1) + 1;
    return body.slice(lineStart, start(node)).replace(/[^\s>]/g, " ");
  };
  const block = (node: Node, text: string): string => {
    const prefix = continuation(node);
    return prefix ? text.replace(/\n/g, "\n" + prefix).replace(new RegExp(`\\n${escape(prefix)}(?=\\n)`, "g"), "\n" + prefix.trimEnd()) : text;
  };
  const linkUrl = (node: Node, url: string): string => {
    if (url.startsWith("site:")) {
      try {
        return context.link({ href: siteHref(url, context.sites), kind: "external" });
      } catch (error) {
        return fail(node, (error as Error).message);
      }
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//")) return url;
    if (url.startsWith("#")) return url;
    const href = internalHref(url, context.path);
    const path = href.split("#")[0]!;
    return context.link({ href, kind: context.pages.has(path) ? "page" : "site" });
  };
  const render = (node: Node): string => {
    switch (node.type) {
      case "link": {
        const url = node.url ?? "";
        const mapped = linkUrl(node, url);
        if (mapped === url) return splice(start(node), end(node), node.children ?? []);
        const children = node.children ?? [];
        const label = children.length && children[0]!.position ? splice(start(children[0]!), end(children.at(-1)!), children) : "";
        // Autolinks (`<https://…>`, bare URLs) have no label syntax: their text is the URL.
        if (body[start(node)] !== "[") return `[${label || mapped}](${mapped})`;
        return `[${label}](${mapped})`;
      }
      case "textDirective": {
        const label = (node.children ?? []).length ? splice(start(node.children![0]!), end(node.children!.at(-1)!), node.children!) : "";
        if (node.name === "term") return label;
        if (node.name === "kbd") return "`" + plain(node) + "`";
        return body.slice(start(node), end(node));
      }
      case "leafDirective": {
        const attrs = node.attributes ?? {};
        if (node.name === "example") {
          const example = context.examples.get(attrs.id ?? "");
          if (!example) return fail(node, `unknown example "${attrs.id}"`);
          return block(node, exampleMarkdown(example));
        }
        if (node.name === "api") {
          const symbols = context.symbols.get(attrs.symbol ?? "");
          if (!symbols?.length) return fail(node, `unknown API symbol "${attrs.symbol}"`);
          const first = symbols[0]!;
          const lines = [
            `**API: \`${first.name}\`** from \`${first.entry}\`${first.summary ? ` — ${first.summary}` : ""} ([reference](${context.link({ href: first.href, kind: "site" })}))`,
          ];
          const signatures = symbols.flatMap((symbol) => symbol.signatures);
          if (signatures.length) lines.push(fence(signatures.join("\n"), "ts"));
          return block(node, lines.join("\n\n"));
        }
        if (node.name === "starter") {
          const template = attrs.template ?? "starter-static";
          return block(
            node,
            `**Starter \`${template}\`:** \`${context.starterCommand?.(template) ?? `npm create rivet@latest -- --template ${template.replace(/^starter-/, "")}`}\``,
          );
        }
        if (node.name === "chart") {
          const chart = context.charts.get(attrs.id ?? "");
          if (!chart) return fail(node, `unknown chart "${attrs.id}"`);
          return block(node, chartMarkdown(chart));
        }
        return body.slice(start(node), end(node));
      }
      case "containerDirective": {
        const children = node.children ?? [];
        const labelNode = children[0]?.data?.directiveLabel ? children[0] : undefined;
        const content = labelNode ? children.slice(1) : children;
        const kind = CALLOUT_TITLES[node.name ?? ""] ?? node.name ?? "Note";
        const title = labelNode?.children?.length
          ? `${kind}: ${splice(start(labelNode.children[0]!), end(labelNode.children.at(-1)!), labelNode.children)}`
          : kind;
        const inner = content.length ? splice(start(content[0]!), end(content.at(-1)!), content) : "";
        const quoted = [`**${title}.**`, "", ...dedent(inner).split("\n")].map((line) => (line ? "> " + line : ">")).join("\n");
        return block(node, quoted);
      }
      case "html":
        return /^<!--[\s\S]*-->$/.test((node.value ?? "").trim()) ? "" : body.slice(start(node), end(node));
      case "code":
      case "inlineCode":
      case "text":
        return body.slice(start(node), end(node));
      default:
        return node.children?.length ? splice(start(node), end(node), node.children) : body.slice(start(node), end(node));
    }
  };
  const out = splice(0, body.length, tree.children ?? []);
  return out.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Remove the common leading indentation of continuation lines (container content nested in a list). */
function dedent(text: string): string {
  const lines = text.split("\n");
  const indents = lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => /^ */.exec(line)![0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return cut ? [lines[0]!, ...lines.slice(1).map((line) => line.slice(Math.min(cut, /^ */.exec(line)![0].length)))].join("\n") : text;
}
