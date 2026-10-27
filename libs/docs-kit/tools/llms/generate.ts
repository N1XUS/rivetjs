// AI outputs of one docs site (llmstxt.org): `llms.txt` (index: pages by nav section, API entries, examples),
// `llms-full.txt` (every content page, examples inlined), `<page>.md` next to each HTML page (`/guides/x/` →
// `/guides/x.md`, home → `/index.md`), `api/<entry>.md` per API entry (`/api/rivetjs/ui/select/` →
// `/api/rivetjs/ui/select.md`), `examples/<id>.md` per example. A pure function of the committed sources
// (`source.ts`); written into the built site by `buildSite` and by `docs-kit llms`. The same pages feed
// `@rivetjs/mcp` (`libs/mcp/data.ts`).
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ApiSymbol } from "../api.ts";
import { exampleMarkdown, llmsMarkdown, symbolMarkdown, type LlmsLinkTarget } from "./markdown.ts";
import { loadLlmsSource, type LlmsSource } from "./source.ts";

/** One Markdown document of the outputs. */
export interface LlmsDoc {
  /** `page` (content page), `api` (one API entry), `example`. */
  kind: "page" | "api" | "example";
  /** URL path of the HTML page (`/guides/components/`). */
  href: string;
  /** Output file (`guides/components.md`). */
  file: string;
  title: string;
  description: string;
  /** Nav section title (pages), package entry (api), "Examples". */
  section: string;
  /** Full Markdown (`# Title`, `> description`, body). */
  markdown: string;
  /** Pages: content tags; api: symbol names; examples: tags. */
  tags: string[];
}

export interface LlmsOutput {
  site: LlmsSource["site"];
  app: string;
  docs: LlmsDoc[];
  /** Output files (relative to the site root) → contents: llms.txt, llms-full.txt and every doc's file. */
  files: Map<string, string>;
}

export interface LlmsOptions {
  /**
   * URL of a link target in the outputs. Default: absolute URLs on `site.origin`, content pages and the other
   * documents with a Markdown version as their `.md` file.
   */
  link?: (target: LlmsLinkTarget, source: LlmsSource) => string;
}

/** `/guides/components/#x` → `guides/components.md#x`; `/` → `index.md`. */
export function mdFileOf(href: string): string {
  const [path = "/", hash] = href.split("#", 2) as [string, string | undefined];
  const trimmed = path.replace(/^\/+|\/+$/g, "");
  return (trimmed || "index") + ".md" + (hash !== undefined ? "#" + hash : "");
}

/** Generate every AI output of the site at `root` (no writes). */
export async function generateLlms(root: string, options: LlmsOptions = {}): Promise<LlmsOutput> {
  return llmsFrom(await loadLlmsSource(root), options);
}

/** Generate from an already loaded source. */
export function llmsFrom(source: LlmsSource, options: LlmsOptions = {}): LlmsOutput {
  const { site, api } = source;
  const origin = site.origin.replace(/\/+$/, "");
  const docHrefs = new Set<string>([
    ...source.pages.map((page) => page.href),
    ...api.entries.map((entry) => entry.href),
    ...[...source.examples.keys()].map((id) => `/examples/${id}/`),
  ]);
  const defaultLink = (target: LlmsLinkTarget): string => {
    if (target.kind === "external") return target.href;
    const path = target.href.split("#")[0]!;
    if (docHrefs.has(path)) return origin + "/" + mdFileOf(target.href);
    // An API symbol page: its entry's Markdown, anchored at the symbol heading.
    const entry = api.entries.find((candidate) => path.startsWith(candidate.href) && path !== candidate.href);
    if (entry) return origin + "/" + mdFileOf(entry.href) + "#" + path.slice(entry.href.length).replace(/\/$/, "").toLowerCase();
    return origin + target.href;
  };
  const link = options.link ? (target: LlmsLinkTarget) => options.link!(target, source) : defaultLink;
  const symbols = new Map<string, ApiSymbol[]>();
  for (const symbol of api.symbols) symbols.set(symbol.key, [...(symbols.get(symbol.key) ?? []), symbol]);
  // A custom link callback can mutate its source; retain live joins in that case.
  const symbolsByEntry = options.link ? null : new Map<string, ApiSymbol[]>();
  if (symbolsByEntry)
    for (const symbol of api.symbols) {
      const list = symbolsByEntry.get(symbol.entry);
      if (list) list.push(symbol);
      else symbolsByEntry.set(symbol.entry, [symbol]);
    }
  const pageByPath = options.link ? null : new Map<string, LlmsSource["pages"][number]>();
  if (pageByPath) for (const page of source.pages) if (!pageByPath.has(page.path)) pageByPath.set(page.path, page);
  const pageHrefs = new Set(source.pages.map((page) => page.href));
  const docs: LlmsDoc[] = [];
  const header = (title: string, description: string, href: string) =>
    `# ${title}\n\n${description ? `> ${description}\n\n` : ""}Source: ${origin}${href} (${site.name})\n\n`;

  for (const page of source.pages) {
    const body = llmsMarkdown(page.body, {
      path: page.path,
      examples: source.examples,
      symbols,
      charts: source.charts,
      ...(site.sites ? { sites: site.sites } : {}),
      pages: pageHrefs,
      link,
    });
    docs.push({
      kind: "page",
      href: page.href,
      file: mdFileOf(page.href),
      title: page.title,
      description: page.description,
      section: page.sectionTitle,
      markdown: header(page.title, page.description, page.href) + body,
      tags: page.tags,
    });
  }
  for (const entry of api.entries) {
    const entrySymbols = symbolsByEntry ? (symbolsByEntry.get(entry.entry) ?? []) : api.symbols.filter((symbol) => symbol.entry === entry.entry);
    const body = entrySymbols.map((symbol) => symbolMarkdown(symbol, 2)).join("\n\n");
    docs.push({
      kind: "api",
      href: entry.href,
      file: mdFileOf(entry.href),
      title: entry.entry,
      description: entry.summary,
      section: "API reference",
      markdown: header(entry.entry, entry.summary, entry.href) + `Import: \`import { … } from "${entry.entry}"\` · runs on: ${entry.runsOn}\n\n` + body + "\n",
      tags: [...new Set(entrySymbols.map((symbol) => symbol.name))],
    });
  }
  for (const example of source.examples.values()) {
    const href = `/examples/${example.id}/`;
    const usedOn = example.usedOn.map((path) => (pageByPath ? pageByPath.get(path) : source.pages.find((page) => page.path === path))!).filter(Boolean);
    const used = usedOn.length ? `Used on: ${usedOn.map((page) => `[${page.title}](${link({ href: page.href, kind: "page" })})`).join(", ")}\n\n` : "";
    docs.push({
      kind: "example",
      href,
      file: mdFileOf(href),
      title: example.title,
      description: example.summary,
      section: "Examples",
      markdown: header(example.title, example.summary, href) + used + exampleMarkdown(example, "Source") + "\n",
      tags: example.tags,
    });
  }

  const files = new Map<string, string>();
  for (const doc of docs) files.set(doc.file, doc.markdown);
  files.set("llms.txt", indexText(source, docs, link));
  files.set(
    "llms-full.txt",
    `# ${site.name}\n\n> ${site.tagline}\n\n` +
      docs
        .filter((doc) => doc.kind === "page")
        .map((doc) => doc.markdown.trim())
        .join("\n\n---\n\n") +
      "\n",
  );
  return { site, app: source.app, docs, files };
}

function indexText(source: LlmsSource, docs: LlmsDoc[], link: (target: LlmsLinkTarget) => string): string {
  const { site } = source;
  const line = (doc: LlmsDoc) =>
    `- [${doc.title}](${link({ href: doc.href, kind: doc.kind === "page" ? "page" : "site" })})${doc.description ? `: ${doc.description}` : ""}`;
  const out = [`# ${site.name}`, "", `> ${site.tagline}`, ""];
  out.push(
    `Every page below is Markdown (the HTML page's URL with \`.md\`). [llms-full.txt](${site.origin.replace(/\/+$/, "")}/llms-full.txt) holds all pages in one file, examples inlined as source code.` +
      (site.sites && Object.keys(site.sites).length
        ? ` Sibling sites: ${Object.entries(site.sites)
            .map(([name, origin]) => `[${name}](${origin.replace(/\/+$/, "")}/llms.txt)`)
            .join(", ")}.`
        : "") +
      " Rivet MCP server (offline docs search, components, diagnostics): `npx @rivetjs/mcp`.",
    "",
  );
  const pages = docs.filter((doc) => doc.kind === "page");
  const bySection = new Map<string, LlmsDoc[]>();
  for (const doc of pages) bySection.set(doc.section, [...(bySection.get(doc.section) ?? []), doc]);
  for (const [section, list] of bySection) out.push(`## ${section}`, "", ...list.map(line), "");
  const api = docs.filter((doc) => doc.kind === "api");
  if (api.length) out.push("## API reference", "", ...api.map(line), "");
  const examples = docs.filter((doc) => doc.kind === "example");
  if (examples.length) out.push("## Optional", "", ...examples.map((doc) => line({ ...doc, title: `Example: ${doc.title}` })), "");
  return out.join("\n");
}

/** Write the outputs under `dir` (a built site's `dist/client`). Returns the file count. */
export async function writeLlms(output: LlmsOutput, dir: string): Promise<number> {
  for (const [file, contents] of output.files) {
    const target = resolve(dir, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents);
  }
  return output.files.size;
}

/** sha256 over every output file (sorted), for determinism checks. */
export function llmsDigest(output: LlmsOutput): string {
  const hash = createHash("sha256");
  for (const file of [...output.files.keys()].sort()) hash.update(file + "\0" + output.files.get(file)! + "\0");
  return hash.digest("hex");
}

/** Problems of an output: missing page docs, `.md` links (same origin) that point at no generated file. */
export function llmsProblems(output: LlmsOutput, source: { pages: readonly { href: string }[] }): string[] {
  const problems: string[] = [];
  const origin = output.site.origin.replace(/\/+$/, "");
  for (const page of source.pages) if (!output.files.has(mdFileOf(page.href))) problems.push(`no Markdown for page ${page.href}`);
  for (const [file, contents] of output.files)
    for (const match of contents.matchAll(/\]\((\S+?\.md)(?:#[^)\s]*)?\)/g)) {
      const url = match[1]!;
      if (!url.startsWith(origin + "/")) continue;
      const target = url.slice(origin.length + 1);
      if (!output.files.has(target)) problems.push(`${file}: link to ${url}, which is not generated`);
    }
  return problems;
}

/**
 * CLI: `docs-kit llms <app root> [--out dir] [--check] [--dist dir]`. Default: write into `<root>/dist/client`.
 * `--check`: no writes; fails when two generations differ (non-deterministic), when a page has no Markdown or a
 * same-site `.md` link dangles, and (with `--dist`, or when `<root>/dist/client/llms.txt` exists and `--dist` is given)
 * when a built site's files differ from a fresh generation (stale build).
 */
export async function llmsCommand(root: string, args: string[]): Promise<void> {
  const value = (flag: string) => {
    const at = args.indexOf(flag);
    if (at < 0) return undefined;
    const next = args[at + 1];
    if (!next || next.startsWith("--")) throw new Error(`docs-kit llms: ${flag} needs a directory`);
    return resolve(next);
  };
  const started = performance.now();
  const source = await loadLlmsSource(root);
  const output = llmsFrom(source);
  const size = [...output.files.values()].reduce((sum, text) => sum + Buffer.byteLength(text), 0);
  const summary = `${output.files.size} files, ${(size / 1024 / 1024).toFixed(1)} MB (llms.txt ${(Buffer.byteLength(output.files.get("llms.txt")!) / 1024).toFixed(0)} KB, llms-full.txt ${(Buffer.byteLength(output.files.get("llms-full.txt")!) / 1024 / 1024).toFixed(1)} MB)`;
  if (args.includes("--check")) {
    const problems = llmsProblems(output, source);
    const again = llmsFrom(await loadLlmsSource(root));
    if (llmsDigest(again) !== llmsDigest(output)) problems.push("two generations differ (output is not deterministic)");
    const dist = value("--dist");
    if (dist) {
      if (!existsSync(resolve(dist, "llms.txt"))) problems.push(`${dist}: no llms.txt (build the site first)`);
      else
        for (const [file, contents] of output.files) {
          const built = await readFile(resolve(dist, file), "utf8").catch(() => null);
          if (built !== contents) problems.push(`${dist}/${file}: ${built === null ? "missing" : "stale"} (rebuild the site or run docs-kit llms)`);
          if (problems.length > 50) break;
        }
    }
    if (problems.length) {
      console.error(`docs-kit llms --check (${source.app}): ${problems.length} problem(s)\n  ${problems.slice(0, 50).join("\n  ")}`);
      process.exit(1);
    }
    console.log(`llms --check ${source.app}: ok, ${summary}, deterministic (${((performance.now() - started) / 1000).toFixed(1)} s)`);
    return;
  }
  const out = value("--out") ?? resolve(root, "dist/client");
  await writeLlms(output, out);
  console.log(`llms ${source.app}: ${summary} → ${out}`);
}
